/**
 * Configuration for data consistency features
 */

import { DataConsistencyConfig } from '../services/data-consistency-manager.js';

export const defaultDataConsistencyConfig: DataConsistencyConfig = {
  // Event bus configuration
  eventBus: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'joallm:events:',
    retryAttempts: 3,
    retryDelay: 1000,
    maxRetries: 5,
    circuitBreakerThreshold: 5,
    deadLetterQueue: true,
    eventTtl: 3600 // 1 hour
  },
  
  // Backup configuration
  backup: {
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'joallm',
      username: process.env.POSTGRES_USER || 'joallm',
      password: process.env.POSTGRES_PASSWORD || 'joallm_password'
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    },
    storage: {
      localPath: process.env.BACKUP_PATH || './backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      compressionEnabled: process.env.BACKUP_COMPRESSION === 'true'
    },
    schedule: {
      enabled: process.env.BACKUP_SCHEDULE_ENABLED === 'true',
      interval: process.env.BACKUP_INTERVAL || '0 2 * * *', // Daily at 2 AM
      fullBackupInterval: process.env.BACKUP_FULL_INTERVAL || '0 2 * * 0' // Weekly on Sunday
    },
    notifications: {
      enabled: process.env.BACKUP_NOTIFICATIONS_ENABLED === 'true',
      webhookUrl: process.env.BACKUP_WEBHOOK_URL,
      email: process.env.BACKUP_EMAIL
    }
  },
  
  // Recovery configuration
  recovery: {
    strategies: {
      retry: {
        enabled: true,
        maxAttempts: 3,
        backoffMultiplier: 2,
        maxDelay: 30000 // 30 seconds
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000 // 1 minute
      },
      dataRepair: {
        enabled: true,
        autoRepair: true,
        validationEnabled: true
      },
      eventReplay: {
        enabled: true,
        maxReplayEvents: 1000,
        replayDelay: 100 // 100ms between events
      }
    },
    monitoring: {
      healthCheckInterval: 30000, // 30 seconds
      alertThresholds: {
        errorRate: 0.1, // 10%
        responseTime: 5000, // 5 seconds
        memoryUsage: 0.8 // 80%
      }
    },
    notifications: {
      enabled: process.env.RECOVERY_NOTIFICATIONS_ENABLED === 'true',
      webhookUrl: process.env.RECOVERY_WEBHOOK_URL,
      email: process.env.RECOVERY_EMAIL
    }
  },
  
  // Data validation
  validation: {
    enabled: true,
    strictMode: process.env.VALIDATION_STRICT_MODE === 'true',
    autoRepair: process.env.VALIDATION_AUTO_REPAIR === 'true'
  },
  
  // Monitoring and alerting
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsInterval: 60000, // 1 minute
    alertThresholds: {
      errorRate: 0.05, // 5%
      dataInconsistencyRate: 0.01, // 1%
      backupFailureRate: 0.1 // 10%
    }
  }
};

// Environment-specific configurations
export const developmentConfig: Partial<DataConsistencyConfig> = {
  eventBus: {
    ...defaultDataConsistencyConfig.eventBus,
    retryAttempts: 2,
    maxRetries: 3
  },
  backup: {
    ...defaultDataConsistencyConfig.backup,
    storage: {
      ...defaultDataConsistencyConfig.backup.storage,
      retentionDays: 7 // Keep backups for 7 days in development
    }
  },
  recovery: {
    ...defaultDataConsistencyConfig.recovery,
    strategies: {
      ...defaultDataConsistencyConfig.recovery.strategies,
      retry: {
        ...defaultDataConsistencyConfig.recovery.strategies.retry,
        maxAttempts: 2
      }
    }
  },
  monitoring: {
    ...defaultDataConsistencyConfig.monitoring,
    metricsInterval: 30000 // 30 seconds in development
  }
};

export const productionConfig: Partial<DataConsistencyConfig> = {
  eventBus: {
    ...defaultDataConsistencyConfig.eventBus,
    retryAttempts: 5,
    maxRetries: 10,
    circuitBreakerThreshold: 10
  },
  backup: {
    ...defaultDataConsistencyConfig.backup,
    storage: {
      ...defaultDataConsistencyConfig.backup.storage,
      retentionDays: 90 // Keep backups for 90 days in production
    },
    schedule: {
      ...defaultDataConsistencyConfig.backup.schedule,
      enabled: true
    }
  },
  recovery: {
    ...defaultDataConsistencyConfig.recovery,
    strategies: {
      ...defaultDataConsistencyConfig.recovery.strategies,
      retry: {
        ...defaultDataConsistencyConfig.recovery.strategies.retry,
        maxAttempts: 5,
        maxDelay: 60000 // 1 minute in production
      }
    }
  },
  validation: {
    ...defaultDataConsistencyConfig.validation,
    strictMode: true
  }
};

// Get configuration based on environment
export function getDataConsistencyConfig(): DataConsistencyConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return { ...defaultDataConsistencyConfig, ...productionConfig };
    case 'development':
      return { ...defaultDataConsistencyConfig, ...developmentConfig };
    default:
      return defaultDataConsistencyConfig;
  }
}




