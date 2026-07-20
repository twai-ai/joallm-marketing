import Redis from 'ioredis';
import { Event, EventBus, EventHandler, EventPublisher, EventSubscriber, validateEvent } from './index.js';
import { logger } from '../utils/logger.js';

export interface RedisEventBusConfig {
  url: string;
  keyPrefix?: string;
  retryAttempts?: number;
  retryDelay?: number;
  maxRetries?: number;
  circuitBreakerThreshold?: number;
  deadLetterQueue?: boolean;
  eventTtl?: number; // TTL for events in seconds
}

export interface EventBusStats {
  isRunning: boolean;
  isHealthy: boolean;
  eventTypes: string[];
  totalHandlers: number;
  publishedEvents: number;
  failedEvents: number;
  retryCount: number;
  circuitBreakerOpen: boolean;
}

export class RedisEventBus implements EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers: Map<string, EventHandler[]> = new Map();
  private isRunning: boolean = false;
  private config: RedisEventBusConfig;
  private stats: EventBusStats;
  private circuitBreakerOpen: boolean = false;
  private circuitBreakerFailures: number = 0;
  private lastFailureTime: number = 0;
  private deadLetterQueue: Redis;

  constructor(config: RedisEventBusConfig) {
    this.config = {
      keyPrefix: 'joallm:events:',
      retryAttempts: 3,
      retryDelay: 1000,
      maxRetries: 5,
      circuitBreakerThreshold: 5,
      deadLetterQueue: true,
      eventTtl: 3600, // 1 hour
      ...config
    };

    this.stats = {
      isRunning: false,
      isHealthy: false,
      eventTypes: [],
      totalHandlers: 0,
      publishedEvents: 0,
      failedEvents: 0,
      retryCount: 0,
      circuitBreakerOpen: false
    };

    this.publisher = new Redis(this.config.url, {
      retryDelayOnFailover: this.config.retryDelay,
      maxRetriesPerRequest: this.config.retryAttempts,
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.subscriber = new Redis(this.config.url, {
      retryDelayOnFailover: this.config.retryDelay,
      maxRetriesPerRequest: this.config.retryAttempts,
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.deadLetterQueue = new Redis(this.config.url, {
      lazyConnect: true,
    });

    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.publisher.on('error', (error) => {
      logger.error('Redis publisher error:', error);
      this.handleCircuitBreakerFailure();
    });

    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error:', error);
      this.handleCircuitBreakerFailure();
    });

    this.publisher.on('connect', () => {
      logger.info('Redis publisher connected');
      this.resetCircuitBreaker();
    });

    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
      this.resetCircuitBreaker();
    });

    this.deadLetterQueue.on('error', (error) => {
      logger.error('Dead letter queue error:', error);
    });
  }

  private handleCircuitBreakerFailure(): void {
    this.circuitBreakerFailures++;
    this.lastFailureTime = Date.now();
    this.stats.failedEvents++;

    if (this.circuitBreakerFailures >= this.config.circuitBreakerThreshold!) {
      this.circuitBreakerOpen = true;
      this.stats.circuitBreakerOpen = true;
      logger.warn('Circuit breaker opened due to repeated failures');
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreakerFailures = 0;
    this.circuitBreakerOpen = false;
    this.stats.circuitBreakerOpen = false;
    logger.info('Circuit breaker reset');
  }

  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreakerOpen) return false;
    
    // Reset circuit breaker after 5 minutes
    const resetTime = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - this.lastFailureTime > resetTime) {
      this.resetCircuitBreaker();
      return false;
    }
    
    return true;
  }

  async start(): Promise<void> {
    try {
      await this.publisher.connect();
      await this.subscriber.connect();
      
      // Subscribe to all event channels
      await this.subscriber.psubscribe(`${this.config.keyPrefix}*`);
      
      // Set up message handler
      this.subscriber.on('pmessage', (pattern, channel, message) => {
        this.handleMessage(channel, message);
      });

      this.isRunning = true;
      logger.info('Redis Event Bus started successfully');
    } catch (error) {
      logger.error('Failed to start Redis Event Bus:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      await this.subscriber.punsubscribe();
      await this.subscriber.disconnect();
      await this.publisher.disconnect();
      logger.info('Redis Event Bus stopped');
    } catch (error) {
      logger.error('Error stopping Redis Event Bus:', error);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const publisherPing = await this.publisher.ping();
      const subscriberPing = await this.subscriber.ping();
      return publisherPing === 'PONG' && subscriberPing === 'PONG';
    } catch (error) {
      logger.error('Redis Event Bus health check failed:', error);
      return false;
    }
  }

  async publish(event: Event): Promise<void> {
    // Validate event before publishing
    if (!validateEvent(event)) {
      const error = new Error('Invalid event structure');
      logger.error('Event validation failed:', { event, error: error.message });
      throw error;
    }

    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      const error = new Error('Circuit breaker is open');
      logger.warn('Publishing blocked by circuit breaker');
      throw error;
    }

    return this.publishWithRetry(event, 0);
  }

  private async publishWithRetry(event: Event, attempt: number): Promise<void> {
    try {
      const channel = `${this.config.keyPrefix}${event.type}`;
      const message = JSON.stringify(event);
      
      await this.publisher.publish(channel, message);
      
      // Store event for TTL if configured
      if (this.config.eventTtl) {
        const eventKey = `${this.config.keyPrefix}event:${event.id}`;
        await this.publisher.setex(eventKey, this.config.eventTtl, message);
      }
      
      this.stats.publishedEvents++;
      logger.debug(`Published event ${event.type} to channel ${channel} (attempt ${attempt + 1})`);
    } catch (error) {
      logger.error(`Failed to publish event ${event.type} (attempt ${attempt + 1}):`, error);
      
      if (attempt < this.config.maxRetries!) {
        this.stats.retryCount++;
        const delay = this.config.retryDelay! * Math.pow(2, attempt); // Exponential backoff
        logger.info(`Retrying event ${event.type} in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.publishWithRetry(event, attempt + 1);
      } else {
        this.stats.failedEvents++;
        this.handleCircuitBreakerFailure();
        
        // Send to dead letter queue if enabled
        if (this.config.deadLetterQueue) {
          await this.sendToDeadLetterQueue(event, error);
        }
        
        throw error;
      }
    }
  }

  private async sendToDeadLetterQueue(event: Event, error: any): Promise<void> {
    try {
      const dlqKey = `${this.config.keyPrefix}dlq:${event.type}`;
      const dlqMessage = JSON.stringify({
        event,
        error: error.message,
        timestamp: new Date().toISOString(),
        retryCount: this.config.maxRetries
      });
      
      await this.deadLetterQueue.lpush(dlqKey, dlqMessage);
      logger.info(`Event ${event.type} sent to dead letter queue`);
    } catch (dlqError) {
      logger.error('Failed to send event to dead letter queue:', dlqError);
    }
  }

  async publishBatch(events: Event[]): Promise<void> {
    try {
      const pipeline = this.publisher.pipeline();
      
      for (const event of events) {
        const channel = `${this.config.keyPrefix}${event.type}`;
        const message = JSON.stringify(event);
        pipeline.publish(channel, message);
      }
      
      await pipeline.exec();
      logger.debug(`Published ${events.length} events in batch`);
    } catch (error) {
      logger.error('Failed to publish event batch:', error);
      throw error;
    }
  }

  async subscribe<T extends Event>(eventType: string, handler: EventHandler<T>): Promise<void> {
    try {
      if (!this.handlers.has(eventType)) {
        this.handlers.set(eventType, []);
      }
      
      this.handlers.get(eventType)!.push(handler as EventHandler);
      logger.debug(`Subscribed handler for event type: ${eventType}`);
    } catch (error) {
      logger.error(`Failed to subscribe to event type ${eventType}:`, error);
      throw error;
    }
  }

  async unsubscribe(eventType: string, handler: EventHandler): Promise<void> {
    try {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
          logger.debug(`Unsubscribed handler for event type: ${eventType}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to unsubscribe from event type ${eventType}:`, error);
      throw error;
    }
  }

  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const event = JSON.parse(message) as Event;
      
      // Validate event structure
      if (!validateEvent(event)) {
        logger.error('Received invalid event structure:', { channel, message });
        return;
      }
      
      const eventType = event.type;
      
      const handlers = this.handlers.get(eventType);
      if (handlers && handlers.length > 0) {
        // Execute all handlers for this event type with individual error handling
        const handlerPromises = handlers.map(handler => 
          this.executeHandlerWithRetry(handler, event)
        );
        
        const results = await Promise.allSettled(handlerPromises);
        
        // Log any failed handlers
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            logger.error(`Handler ${index} failed for event ${eventType}:`, result.reason);
          }
        });
        
        logger.debug(`Processed event ${eventType} with ${handlers.length} handlers`);
      } else {
        logger.debug(`No handlers found for event type: ${eventType}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      this.stats.failedEvents++;
    }
  }

  private async executeHandlerWithRetry(handler: EventHandler, event: Event, attempt: number = 0): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      logger.error(`Handler execution failed for event ${event.type} (attempt ${attempt + 1}):`, error);
      
      // Retry handler execution up to 3 times
      if (attempt < 3) {
        const delay = 1000 * Math.pow(2, attempt); // Exponential backoff
        logger.info(`Retrying handler for event ${event.type} in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeHandlerWithRetry(handler, event, attempt + 1);
      } else {
        logger.error(`Handler permanently failed for event ${event.type} after ${attempt + 1} attempts`);
        throw error;
      }
    }
  }

  // Utility methods
  async getEventTypes(): Promise<string[]> {
    return Array.from(this.handlers.keys());
  }

  async getHandlerCount(eventType: string): Promise<number> {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.length : 0;
  }

  async getStats(): Promise<EventBusStats> {
    const isHealthy = await this.isHealthy();
    const eventTypes = await this.getEventTypes();
    const totalHandlers = Array.from(this.handlers.values())
      .reduce((sum, handlers) => sum + handlers.length, 0);

    this.stats.isRunning = this.isRunning;
    this.stats.isHealthy = isHealthy;
    this.stats.eventTypes = eventTypes;
    this.stats.totalHandlers = totalHandlers;
    this.stats.circuitBreakerOpen = this.circuitBreakerOpen;

    return { ...this.stats };
  }

  // Dead letter queue management
  async getDeadLetterQueueEvents(eventType?: string): Promise<any[]> {
    try {
      const pattern = eventType 
        ? `${this.config.keyPrefix}dlq:${eventType}`
        : `${this.config.keyPrefix}dlq:*`;
      
      const keys = await this.deadLetterQueue.keys(pattern);
      const events = [];
      
      for (const key of keys) {
        const messages = await this.deadLetterQueue.lrange(key, 0, -1);
        events.push(...messages.map(msg => JSON.parse(msg)));
      }
      
      return events;
    } catch (error) {
      logger.error('Failed to get dead letter queue events:', error);
      return [];
    }
  }

  async reprocessDeadLetterQueue(eventType: string): Promise<number> {
    try {
      const dlqKey = `${this.config.keyPrefix}dlq:${eventType}`;
      const messages = await this.deadLetterQueue.lrange(dlqKey, 0, -1);
      
      let reprocessed = 0;
      for (const message of messages) {
        try {
          const dlqItem = JSON.parse(message);
          await this.publish(dlqItem.event);
          reprocessed++;
        } catch (error) {
          logger.error('Failed to reprocess dead letter queue event:', error);
        }
      }
      
      // Clear the dead letter queue for this event type
      await this.deadLetterQueue.del(dlqKey);
      
      logger.info(`Reprocessed ${reprocessed} events from dead letter queue for ${eventType}`);
      return reprocessed;
    } catch (error) {
      logger.error('Failed to reprocess dead letter queue:', error);
      return 0;
    }
  }

  // Health monitoring
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      redis: boolean;
      circuitBreaker: boolean;
      handlers: boolean;
    };
  }> {
    const redisHealthy = await this.isHealthy();
    const circuitBreakerHealthy = !this.circuitBreakerOpen;
    const handlersHealthy = this.handlers.size > 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!redisHealthy) {
      status = 'unhealthy';
    } else if (!circuitBreakerHealthy || !handlersHealthy) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        redis: redisHealthy,
        circuitBreaker: circuitBreakerHealthy,
        handlers: handlersHealthy
      }
    };
  }
}

// Factory function
export function createRedisEventBus(config: RedisEventBusConfig): RedisEventBus {
  return new RedisEventBus(config);
}
