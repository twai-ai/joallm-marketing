/**
 * Data Consistency Manager - Orchestrates all data consistency features
 */

import { logger } from '../utils/logger.js';
import { EventBus, createRedisEventBus, RedisEventBusConfig } from '../events/redis-event-bus.js';
import { BackupService, createBackupService, BackupConfig } from './backup-service.js';
import { RecoveryService, createRecoveryService, RecoveryConfig } from './recovery-service.js';
import { DataValidator } from '../utils/validation.js';
import { Event, EventFactory } from '../events/index.js';

export interface DataConsistencyConfig {
  // Event bus configuration
  eventBus: RedisEventBusConfig;
  
  // Backup configuration
  backup: BackupConfig;
  
  // Recovery configuration
  recovery: RecoveryConfig;
  
  // Data validation
  validation: {
    enabled: boolean;
    strictMode: boolean;
    autoRepair: boolean;
  };
  
  // Monitoring and alerting
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      errorRate: number;
      dataInconsistencyRate: number;
      backupFailureRate: number;
    };
  };
}

export interface ConsistencyMetrics {
  // Event bus metrics
  eventBus: {
    publishedEvents: number;
    failedEvents: number;
    retryCount: number;
    circuitBreakerOpen: boolean;
  };
  
  // Backup metrics
  backup: {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    lastBackupTime?: Date;
    totalBackupSize: number;
  };
  
  // Recovery metrics
  recovery: {
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    activeRecoveries: number;
  };
  
  // Data validation metrics
  validation: {
    totalValidations: number;
    successfulValidations: number;
    failedValidations: number;
    autoRepairs: number;
  };
  
  // Overall health
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    services: {
      eventBus: boolean;
      backup: boolean;
      recovery: boolean;
      validation: boolean;
    };
  };
}

export class DataConsistencyManager {
  private config: DataConsistencyConfig;
  private eventBus: EventBus;
  private backupService: BackupService;
  private recoveryService: RecoveryService;
  private validator: DataValidator;
  private isRunning: boolean = false;
  private metrics: ConsistencyMetrics;
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: DataConsistencyConfig) {
    this.config = config;
    this.validator = DataValidator.getInstance();
    
    // Initialize services
    this.eventBus = createRedisEventBus(config.eventBus);
    this.backupService = createBackupService(config.backup);
    this.recoveryService = createRecoveryService(config.recovery, this.eventBus, this.backupService);
    
    // Initialize metrics
    this.metrics = {
      eventBus: {
        publishedEvents: 0,
        failedEvents: 0,
        retryCount: 0,
        circuitBreakerOpen: false
      },
      backup: {
        totalBackups: 0,
        successfulBackups: 0,
        failedBackups: 0,
        totalBackupSize: 0
      },
      recovery: {
        totalRecoveries: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0,
        activeRecoveries: 0
      },
      validation: {
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        autoRepairs: 0
      },
      health: {
        status: 'healthy',
        lastCheck: new Date(),
        services: {
          eventBus: false,
          backup: false,
          recovery: false,
          validation: false
        }
      }
    };
  }

  /**
   * Start the data consistency manager
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting Data Consistency Manager...');
      
      // Start all services
      await this.eventBus.start();
      await this.backupService.start();
      await this.recoveryService.start();
      
      // Set up event handlers
      await this.setupEventHandlers();
      
      // Start monitoring
      if (this.config.monitoring.enabled) {
        this.startMetricsCollection();
      }
      
      this.isRunning = true;
      logger.info('Data Consistency Manager started successfully');
      
    } catch (error) {
      logger.error('Failed to start Data Consistency Manager:', error);
      throw error;
    }
  }

  /**
   * Stop the data consistency manager
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping Data Consistency Manager...');
      
      this.isRunning = false;
      
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      
      await this.recoveryService.stop();
      await this.backupService.stop();
      await this.eventBus.stop();
      
      logger.info('Data Consistency Manager stopped');
      
    } catch (error) {
      logger.error('Error stopping Data Consistency Manager:', error);
      throw error;
    }
  }

  /**
   * Publish an event with data validation and consistency checks
   */
  async publishEvent(event: Event): Promise<void> {
    try {
      // Validate event data
      if (this.config.validation.enabled) {
        const validationResult = this.validator.validateEvent(event);
        if (!validationResult.success) {
          logger.error('Event validation failed:', validationResult.errors);
          
          if (this.config.validation.strictMode) {
            throw new Error(`Event validation failed: ${validationResult.errors?.map(e => e.message).join(', ')}`);
          }
          
          // Auto-repair if enabled
          if (this.config.validation.autoRepair) {
            event = this.repairEvent(event, validationResult.errors || []);
            this.metrics.validation.autoRepairs++;
          }
        }
        
        this.metrics.validation.totalValidations++;
        if (validationResult.success) {
          this.metrics.validation.successfulValidations++;
        } else {
          this.metrics.validation.failedValidations++;
        }
      }
      
      // Publish event
      await this.eventBus.publish(event);
      this.metrics.eventBus.publishedEvents++;
      
      logger.debug(`Event published successfully: ${event.type}`);
      
    } catch (error) {
      this.metrics.eventBus.failedEvents++;
      logger.error('Failed to publish event:', error);
      throw error;
    }
  }

  /**
   * Create a backup
   */
  async createBackup(type: 'full' | 'incremental' = 'incremental'): Promise<void> {
    try {
      logger.info(`Creating ${type} backup...`);
      
      const result = type === 'full' 
        ? await this.backupService.createFullBackup()
        : await this.backupService.createIncrementalBackup();
      
      this.metrics.backup.totalBackups++;
      
      if (result.success) {
        this.metrics.backup.successfulBackups++;
        this.metrics.backup.lastBackupTime = result.metadata.timestamp;
        this.metrics.backup.totalBackupSize += result.metadata.size;
        logger.info(`${type} backup completed successfully`);
      } else {
        this.metrics.backup.failedBackups++;
        logger.error(`${type} backup failed:`, result.error);
      }
      
    } catch (error) {
      this.metrics.backup.failedBackups++;
      logger.error(`Failed to create ${type} backup:`, error);
      throw error;
    }
  }

  /**
   * Handle service failure with automatic recovery
   */
  async handleServiceFailure(serviceName: string, error: Error): Promise<void> {
    try {
      logger.warn(`Handling service failure: ${serviceName}`, { error: error.message });
      
      const action = await this.recoveryService.handleServiceFailure(serviceName, error);
      
      this.metrics.recovery.totalRecoveries++;
      
      if (action.status === 'completed') {
        this.metrics.recovery.successfulRecoveries++;
        logger.info(`Service recovery completed: ${serviceName}`);
      } else {
        this.metrics.recovery.failedRecoveries++;
        logger.error(`Service recovery failed: ${serviceName}`, action.error);
      }
      
    } catch (error) {
      this.metrics.recovery.failedRecoveries++;
      logger.error(`Failed to handle service failure for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Validate data consistency across services
   */
  async validateDataConsistency(): Promise<{
    consistent: boolean;
    inconsistencies: Array<{
      service: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    const inconsistencies: Array<{
      service: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];
    
    try {
      // Check event bus consistency
      const eventBusHealth = await this.eventBus.getHealthStatus();
      if (eventBusHealth.status !== 'healthy') {
        inconsistencies.push({
          service: 'event-bus',
          issue: `Event bus status: ${eventBusHealth.status}`,
          severity: eventBusHealth.status === 'unhealthy' ? 'high' : 'medium'
        });
      }
      
      // Check backup consistency
      const backupStats = this.backupService.getBackupStats();
      if (backupStats.failedBackups > 0) {
        inconsistencies.push({
          service: 'backup',
          issue: `${backupStats.failedBackups} failed backups`,
          severity: 'medium'
        });
      }
      
      // Check recovery consistency
      const recoveryStats = this.recoveryService.getRecoveryStats();
      if (recoveryStats.failedActions > 0) {
        inconsistencies.push({
          service: 'recovery',
          issue: `${recoveryStats.failedActions} failed recovery actions`,
          severity: 'high'
        });
      }
      
      // Check data validation consistency
      if (this.metrics.validation.failedValidations > 0) {
        inconsistencies.push({
          service: 'validation',
          issue: `${this.metrics.validation.failedValidations} validation failures`,
          severity: 'medium'
        });
      }
      
      return {
        consistent: inconsistencies.length === 0,
        inconsistencies
      };
      
    } catch (error) {
      logger.error('Failed to validate data consistency:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): ConsistencyMetrics {
    // Update metrics from services
    this.updateMetricsFromServices();
    return { ...this.metrics };
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      eventBus: boolean;
      backup: boolean;
      recovery: boolean;
      validation: boolean;
    };
    lastCheck: Date;
  }> {
    try {
      const eventBusHealthy = await this.eventBus.isHealthy();
      const backupHealthy = true; // Backup service doesn't have health check yet
      const recoveryHealthy = true; // Recovery service doesn't have health check yet
      const validationHealthy = true; // Validation is always available
      
      const services = {
        eventBus: eventBusHealthy,
        backup: backupHealthy,
        recovery: recoveryHealthy,
        validation: validationHealthy
      };
      
      const healthyCount = Object.values(services).filter(Boolean).length;
      const totalCount = Object.keys(services).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyCount === totalCount) {
        status = 'healthy';
      } else if (healthyCount > totalCount / 2) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      this.metrics.health.status = status;
      this.metrics.health.services = services;
      this.metrics.health.lastCheck = new Date();
      
      return {
        status,
        services,
        lastCheck: this.metrics.health.lastCheck
      };
      
    } catch (error) {
      logger.error('Failed to get health status:', error);
      return {
        status: 'unhealthy',
        services: {
          eventBus: false,
          backup: false,
          recovery: false,
          validation: false
        },
        lastCheck: new Date()
      };
    }
  }

  /**
   * Set up event handlers for monitoring
   */
  private async setupEventHandlers(): Promise<void> {
    // Listen for system events
    await this.eventBus.subscribe('system.service.down', {
      handle: async (event) => {
        await this.handleServiceFailure(event.data.service, new Error('Service down event'));
      }
    });
    
    // Listen for data validation events
    await this.eventBus.subscribe('data.validation.failed', {
      handle: async (event) => {
        logger.warn('Data validation failed:', event.data);
        this.metrics.validation.failedValidations++;
      }
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.updateMetricsFromServices();
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Update metrics from services
   */
  private async updateMetricsFromServices(): Promise<void> {
    try {
      // Update event bus metrics
      const eventBusStats = await this.eventBus.getStats();
      this.metrics.eventBus = {
        publishedEvents: eventBusStats.publishedEvents,
        failedEvents: eventBusStats.failedEvents,
        retryCount: eventBusStats.retryCount,
        circuitBreakerOpen: eventBusStats.circuitBreakerOpen
      };
      
      // Update recovery metrics
      const recoveryStats = this.recoveryService.getRecoveryStats();
      this.metrics.recovery = {
        totalRecoveries: recoveryStats.totalActions,
        successfulRecoveries: recoveryStats.successfulActions,
        failedRecoveries: recoveryStats.failedActions,
        activeRecoveries: recoveryStats.activeActions
      };
      
    } catch (error) {
      logger.error('Failed to update metrics from services:', error);
    }
  }

  /**
   * Repair event data
   */
  private repairEvent(event: Event, errors: Array<{ field: string; message: string }>): Event {
    // Simple repair logic - in a real implementation, this would be more sophisticated
    const repairedEvent = { ...event };
    
    for (const error of errors) {
      switch (error.field) {
        case 'id':
          if (!repairedEvent.id || typeof repairedEvent.id !== 'string') {
            repairedEvent.id = crypto.randomUUID();
          }
          break;
        case 'timestamp':
          if (!repairedEvent.timestamp || typeof repairedEvent.timestamp !== 'string') {
            repairedEvent.timestamp = new Date().toISOString();
          }
          break;
        case 'version':
          if (!repairedEvent.version || typeof repairedEvent.version !== 'string') {
            repairedEvent.version = '1.0.0';
          }
          break;
        // Add more repair logic as needed
      }
    }
    
    return repairedEvent;
  }
}

// Export factory function
export function createDataConsistencyManager(config: DataConsistencyConfig): DataConsistencyManager {
  return new DataConsistencyManager(config);
}




