import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { logger } from '../utils/logger.js';

/**
 * Local File Storage Provider
 * 
 * Stores files on the local filesystem (Railway Volume)
 * Perfect for Railway deployment with persistent storage
 */
export class LocalFileStorage {
  private baseDir: string;

  constructor(baseDir: string = '/app/data/uploads') {
    this.baseDir = baseDir;
    logger.info(`Initializing local file storage at: ${this.baseDir}`);
  }

  private getFilePath(key: string): string {
    return join(this.baseDir, key);
  }

  async uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
    try {
      const filePath = this.getFilePath(key);
      
      // Ensure directory exists
      try {
        await fs.mkdir(dirname(filePath), { recursive: true });
      } catch (mkdirError) {
        logger.error(`Failed to create directory for ${key}:`, mkdirError);
        // Try to continue anyway
      }
      
      // Write file
      await fs.writeFile(filePath, buffer);
      
      const fileUrl = `/storage/${key}`;
      logger.info(`✓ File uploaded to local storage: ${key} (${buffer.length} bytes)`);
      
      return fileUrl;
    } catch (error) {
      logger.error(`❌ Failed to upload file to local storage (${key}):`, error);
      logger.error(`Path: ${this.getFilePath(key)}`);
      logger.error(`Base dir: ${this.baseDir}`);
      throw new Error(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    try {
      const filePath = this.getFilePath(key);
      const buffer = await fs.readFile(filePath);
      
      logger.info(`✓ File downloaded from local storage: ${key} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      logger.error(`Failed to download file from local storage (${key}):`, error);
      throw new Error(`File not found: ${key}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
      
      logger.info(`✓ File deleted from local storage: ${key}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn(`File not found for deletion: ${key}`);
        return; // File doesn't exist, consider it deleted
      }
      logger.error(`Failed to delete file from local storage (${key}):`, error);
      throw new Error('File deletion failed');
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getFileUrl(key: string): string {
    return `/storage/${key}`;
  }

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    path: string;
  }> {
    try {
      let totalFiles = 0;
      let totalSize = 0;

      const countFiles = async (dir: string) => {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            
            if (entry.isDirectory()) {
              await countFiles(fullPath);
            } else {
              totalFiles++;
              const stats = await fs.stat(fullPath);
              totalSize += stats.size;
            }
          }
        } catch (error) {
          // Directory might not exist yet
          return;
        }
      };

      await countFiles(this.baseDir);

      return {
        totalFiles,
        totalSize,
        path: this.baseDir
      };
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        path: this.baseDir
      };
    }
  }
}

