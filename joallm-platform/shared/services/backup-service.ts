/**
 * Backup service for JoaLLM platform data consistency
 */

import { logger } from '../utils/logger.js';
import { Event, EventStore } from '../events/index.js';
import { createClient } from 'redis';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export interface BackupConfig {
  // Database backup settings
  postgres: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  
  // Redis backup settings
  redis: {
    url: string;
  };
  
  // Backup storage settings
  storage: {
    localPath: string;
    remotePath?: string;
    retentionDays: number;
    compressionEnabled: boolean;
  };
  
  // Backup schedule
  schedule: {
    enabled: boolean;
    interval: string; // cron expression
    fullBackupInterval: string; // cron expression for full backups
  };
  
  // Notification settings
  notifications: {
    enabled: boolean;
    webhookUrl?: string;
    email?: string;
  };
}

export interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental';
  timestamp: Date;
  size: number;
  checksum: string;
  databases: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface BackupResult {
  success: boolean;
  metadata: BackupMetadata;
  duration: number;
  error?: string;
}

export class BackupService {
  private config: BackupConfig;
  private postgresPool: Pool;
  private redisClient: any;
  private isRunning: boolean = false;
  private backups: Map<string, BackupMetadata> = new Map();

  constructor(config: BackupConfig) {
    this.config = config;
    
    // Initialize PostgreSQL connection
    this.postgresPool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.username,
      password: config.postgres.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Initialize Redis connection
    this.redisClient = createClient({ url: config.redis.url });
  }

  async start(): Promise<void> {
    try {
      await this.redisClient.connect();
      this.isRunning = true;
      
      // Create backup directory if it doesn't exist
      await fs.mkdir(this.config.storage.localPath, { recursive: true });
      
      logger.info('Backup service started successfully');
    } catch (error) {
      logger.error('Failed to start backup service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      await this.redisClient.disconnect();
      await this.postgresPool.end();
      logger.info('Backup service stopped');
    } catch (error) {
      logger.error('Error stopping backup service:', error);
      throw error;
    }
  }

  /**
   * Create a full backup of all data
   */
  async createFullBackup(): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = `full_${Date.now()}`;
    
    const metadata: BackupMetadata = {
      id: backupId,
      type: 'full',
      timestamp: new Date(),
      size: 0,
      checksum: '',
      databases: [],
      status: 'pending'
    };

    this.backups.set(backupId, metadata);

    try {
      logger.info(`Starting full backup: ${backupId}`);
      metadata.status = 'in_progress';

      // Backup PostgreSQL databases
      const postgresBackup = await this.backupPostgreSQL(backupId);
      metadata.databases.push('postgresql');
      metadata.size += postgresBackup.size;

      // Backup Redis data
      const redisBackup = await this.backupRedis(backupId);
      metadata.databases.push('redis');
      metadata.size += redisBackup.size;

      // Backup event store
      const eventBackup = await this.backupEventStore(backupId);
      metadata.databases.push('events');
      metadata.size += eventBackup.size;

      // Calculate checksum
      metadata.checksum = await this.calculateBackupChecksum(backupId);
      metadata.status = 'completed';

      const duration = Date.now() - startTime;
      logger.info(`Full backup completed: ${backupId} (${duration}ms)`);

      return {
        success: true,
        metadata,
        duration
      };

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      
      const duration = Date.now() - startTime;
      logger.error(`Full backup failed: ${backupId}`, error);

      return {
        success: false,
        metadata,
        duration,
        error: metadata.error
      };
    }
  }

  /**
   * Create an incremental backup
   */
  async createIncrementalBackup(): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = `inc_${Date.now()}`;
    
    const metadata: BackupMetadata = {
      id: backupId,
      type: 'incremental',
      timestamp: new Date(),
      size: 0,
      checksum: '',
      databases: [],
      status: 'pending'
    };

    this.backups.set(backupId, metadata);

    try {
      logger.info(`Starting incremental backup: ${backupId}`);
      metadata.status = 'in_progress';

      // Get last backup timestamp
      const lastBackup = this.getLastBackup();
      const since = lastBackup?.timestamp || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      // Backup only changed data
      const postgresBackup = await this.backupPostgreSQLIncremental(backupId, since);
      if (postgresBackup.size > 0) {
        metadata.databases.push('postgresql');
        metadata.size += postgresBackup.size;
      }

      const redisBackup = await this.backupRedisIncremental(backupId, since);
      if (redisBackup.size > 0) {
        metadata.databases.push('redis');
        metadata.size += redisBackup.size;
      }

      const eventBackup = await this.backupEventStoreIncremental(backupId, since);
      if (eventBackup.size > 0) {
        metadata.databases.push('events');
        metadata.size += eventBackup.size;
      }

      metadata.checksum = await this.calculateBackupChecksum(backupId);
      metadata.status = 'completed';

      const duration = Date.now() - startTime;
      logger.info(`Incremental backup completed: ${backupId} (${duration}ms)`);

      return {
        success: true,
        metadata,
        duration
      };

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      
      const duration = Date.now() - startTime;
      logger.error(`Incremental backup failed: ${backupId}`, error);

      return {
        success: false,
        metadata,
        duration,
        error: metadata.error
      };
    }
  }

  /**
   * Backup PostgreSQL database
   */
  private async backupPostgreSQL(backupId: string): Promise<{ size: number }> {
    const backupPath = join(this.config.storage.localPath, `${backupId}_postgres.sql`);
    
    try {
      // Get all table names
      const tablesQuery = `
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `;
      
      const result = await this.postgresPool.query(tablesQuery);
      const tables = result.rows.map(row => row.tablename);

      // Create backup SQL
      let backupSQL = '-- PostgreSQL Backup\n';
      backupSQL += `-- Generated: ${new Date().toISOString()}\n`;
      backupSQL += `-- Database: ${this.config.postgres.database}\n\n`;

      for (const table of tables) {
        // Get table structure
        const structureQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `;
        
        const structure = await this.postgresPool.query(structureQuery, [table]);
        
        backupSQL += `-- Table: ${table}\n`;
        backupSQL += `CREATE TABLE IF NOT EXISTS ${table} (\n`;
        
        const columns = structure.rows.map(col => {
          let colDef = `  ${col.column_name} ${col.data_type}`;
          if (col.is_nullable === 'NO') colDef += ' NOT NULL';
          if (col.column_default) colDef += ` DEFAULT ${col.column_default}`;
          return colDef;
        }).join(',\n');
        
        backupSQL += columns + '\n);\n\n';

        // Get table data
        const dataQuery = `SELECT * FROM ${table}`;
        const data = await this.postgresPool.query(dataQuery);
        
        if (data.rows.length > 0) {
          backupSQL += `-- Data for table: ${table}\n`;
          for (const row of data.rows) {
            const values = Object.values(row).map(val => 
              val === null ? 'NULL' : `'${val.toString().replace(/'/g, "''")}'`
            ).join(', ');
            backupSQL += `INSERT INTO ${table} VALUES (${values});\n`;
          }
          backupSQL += '\n';
        }
      }

      await fs.writeFile(backupPath, backupSQL);
      const stats = await fs.stat(backupPath);
      
      logger.info(`PostgreSQL backup created: ${backupPath} (${stats.size} bytes)`);
      return { size: stats.size };

    } catch (error) {
      logger.error('PostgreSQL backup failed:', error);
      throw error;
    }
  }

  /**
   * Backup Redis data
   */
  private async backupRedis(backupId: string): Promise<{ size: number }> {
    const backupPath = join(this.config.storage.localPath, `${backupId}_redis.json`);
    
    try {
      // Get all keys
      const keys = await this.redisClient.keys('*');
      const backupData: Record<string, any> = {};

      for (const key of keys) {
        const type = await this.redisClient.type(key);
        let value: any;

        switch (type) {
          case 'string':
            value = await this.redisClient.get(key);
            break;
          case 'hash':
            value = await this.redisClient.hgetall(key);
            break;
          case 'list':
            value = await this.redisClient.lrange(key, 0, -1);
            break;
          case 'set':
            value = await this.redisClient.smembers(key);
            break;
          case 'zset':
            value = await this.redisClient.zrange(key, 0, -1, 'WITHSCORES');
            break;
          default:
            continue;
        }

        backupData[key] = {
          type,
          value,
          ttl: await this.redisClient.ttl(key)
        };
      }

      const backupJSON = JSON.stringify(backupData, null, 2);
      await fs.writeFile(backupPath, backupJSON);
      const stats = await fs.stat(backupPath);
      
      logger.info(`Redis backup created: ${backupPath} (${stats.size} bytes)`);
      return { size: stats.size };

    } catch (error) {
      logger.error('Redis backup failed:', error);
      throw error;
    }
  }

  /**
   * Backup event store
   */
  private async backupEventStore(backupId: string): Promise<{ size: number }> {
    const backupPath = join(this.config.storage.localPath, `${backupId}_events.json`);
    
    try {
      // This would integrate with your event store implementation
      // For now, we'll create a placeholder
      const eventsData = {
        backupId,
        timestamp: new Date().toISOString(),
        events: [] // This would be populated from your event store
      };

      const backupJSON = JSON.stringify(eventsData, null, 2);
      await fs.writeFile(backupPath, backupJSON);
      const stats = await fs.stat(backupPath);
      
      logger.info(`Event store backup created: ${backupPath} (${stats.size} bytes)`);
      return { size: stats.size };

    } catch (error) {
      logger.error('Event store backup failed:', error);
      throw error;
    }
  }

  /**
   * Create incremental PostgreSQL backup
   */
  private async backupPostgreSQLIncremental(backupId: string, since: Date): Promise<{ size: number }> {
    // Implementation for incremental PostgreSQL backup
    // This would track changes since the last backup
    return { size: 0 };
  }

  /**
   * Create incremental Redis backup
   */
  private async backupRedisIncremental(backupId: string, since: Date): Promise<{ size: number }> {
    // Implementation for incremental Redis backup
    // This would track changes since the last backup
    return { size: 0 };
  }

  /**
   * Create incremental event store backup
   */
  private async backupEventStoreIncremental(backupId: string, since: Date): Promise<{ size: number }> {
    // Implementation for incremental event store backup
    // This would track events since the last backup
    return { size: 0 };
  }

  /**
   * Calculate backup checksum
   */
  private async calculateBackupChecksum(backupId: string): Promise<string> {
    const files = [
      `${backupId}_postgres.sql`,
      `${backupId}_redis.json`,
      `${backupId}_events.json`
    ];

    const hash = createHash('sha256');
    
    for (const file of files) {
      try {
        const filePath = join(this.config.storage.localPath, file);
        const content = await fs.readFile(filePath);
        hash.update(content);
      } catch (error) {
        // File might not exist for incremental backups
        continue;
      }
    }

    return hash.digest('hex');
  }

  /**
   * Get last backup metadata
   */
  private getLastBackup(): BackupMetadata | undefined {
    const backups = Array.from(this.backups.values())
      .filter(b => b.status === 'completed')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return backups[0];
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const retentionTime = this.config.storage.retentionDays * 24 * 60 * 60 * 1000;
      const cutoffTime = new Date(Date.now() - retentionTime);

      const files = await fs.readdir(this.config.storage.localPath);
      
      for (const file of files) {
        const filePath = join(this.config.storage.localPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffTime) {
          await fs.unlink(filePath);
          logger.info(`Deleted old backup file: ${file}`);
        }
      }

      logger.info('Backup cleanup completed');
    } catch (error) {
      logger.error('Backup cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get backup statistics
   */
  getBackupStats(): {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    totalSize: number;
    lastBackup?: Date;
  } {
    const backups = Array.from(this.backups.values());
    const successful = backups.filter(b => b.status === 'completed');
    const failed = backups.filter(b => b.status === 'failed');
    
    return {
      totalBackups: backups.length,
      successfulBackups: successful.length,
      failedBackups: failed.length,
      totalSize: successful.reduce((sum, b) => sum + b.size, 0),
      lastBackup: successful.length > 0 ? successful[0].timestamp : undefined
    };
  }
}

// Export factory function
export function createBackupService(config: BackupConfig): BackupService {
  return new BackupService(config);
}




