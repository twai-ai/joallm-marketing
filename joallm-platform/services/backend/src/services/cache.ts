import { createClient, RedisClientType } from 'redis';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Redis caching service for performance optimization
 */
class CacheService {
  private client: RedisClientType | null = null;
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      this.client = createClient({
        url: config.redisUrl,
      });

      this.client.on('error', (err) => {
        logger.error('Redis cache error:', err);
      });

      await this.client.connect();
      this.connected = true;
      logger.info('Redis cache connected');
    } catch (error) {
      logger.error('Failed to connect to Redis cache:', error);
      this.client = null;
      this.connected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.connected) return null;

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.client || !this.connected) return;

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.connected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async flush(): Promise<void> {
    if (!this.client || !this.connected) return;

    try {
      await this.client.flushDb();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis cache disconnected');
    }
  }
}

export const cacheService = new CacheService();

/**
 * Cache key generators
 */
export const CacheKeys = {
  userProfile: (userId: string) => `user:profile:${userId}`,
  modelsList: () => 'models:list',
  ragSearchResult: (query: string, fileIds: string[]) => 
    `rag:search:${query}:${fileIds.sort().join(',')}`,
};

/**
 * Cache TTL values (in seconds)
 */
export const CacheTTL = {
  userProfile: 5 * 60, // 5 minutes
  modelsList: 30 * 60, // 30 minutes
  ragSearchResult: 10 * 60, // 10 minutes
};



