import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { LocalFileStorage } from './local-file-storage.js';

export interface StorageProvider {
  uploadFile(buffer: Buffer, key: string, contentType: string, metadata?: Record<string, string>): Promise<string>;
  deleteFile(key: string): Promise<void>;
  getFileUrl(key: string): string;
  downloadFile(key: string): Promise<Buffer>;
  getPresignedUrl?(key: string, expiresIn?: number): Promise<string>;
}

// Cloudflare R2 — uses S3-compatible API with a custom endpoint
export class CloudflareR2Storage implements StorageProvider {
  private client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(bucketName?: string) {
    const accountId = config.r2AccountId!;
    this.bucketName = bucketName ?? config.r2BucketName!;
    // R2 public URL (optional): set R2_PUBLIC_URL in env for a custom domain or Workers URL
    this.publicUrl = process.env.R2_PUBLIC_URL || `https://${accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId!,
        secretAccessKey: config.r2SecretAccessKey!,
      },
    });
  }

  async uploadFile(buffer: Buffer, key: string, contentType: string, metadata?: Record<string, string>): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    }));
    // Never expose a public URL — callers must use getPresignedUrl for access
    logger.info(`R2 upload: ${key} (${buffer.length} bytes) → bucket: ${this.bucketName}`);
    return key;
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
    logger.info(`R2 delete: ${key}`);
  }

  getFileUrl(key: string): string {
    // Internal reference only — not a public URL
    return key;
  }

  async downloadFile(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
    const stream = response.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      { expiresIn },
    );
  }
}

// AWS S3 standard storage
export class S3Storage implements StorageProvider {
  private client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || config.r2BucketName!;
    this.region = process.env.S3_REGION || 'us-east-1';

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || config.r2AccessKeyId!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || config.r2SecretAccessKey!,
      },
    });
  }

  async uploadFile(buffer: Buffer, key: string, contentType: string, metadata?: Record<string, string>): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    }));
    const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    logger.info(`S3 upload: ${key} → ${url}`);
    return url;
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
    logger.info(`S3 delete: ${key}`);
  }

  getFileUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async downloadFile(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
    const stream = response.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /** Generate a pre-signed URL for temporary direct access */
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      { expiresIn }
    );
  }
}

export function createStorageProvider(): StorageProvider {
  const hasR2Config = config.r2AccountId &&
    config.r2AccessKeyId &&
    config.r2SecretAccessKey &&
    config.r2BucketName &&
    config.r2AccountId !== 'undefined' &&
    config.r2AccountId !== 'your-r2-account-id';

  switch (config.storageProvider) {
    case 'volume':
      logger.info('📁 Using volume storage (Railway Volume/Local filesystem)');
      try {
        return new LocalFileStorage(config.storagePath) as any;
      } catch (error) {
        logger.error('Failed to initialize volume storage:', error);
        throw new Error('Volume storage initialization failed');
      }

    case 'cloudflare-r2':
      if (!hasR2Config) {
        logger.warn('⚠️ R2 selected but credentials not configured, falling back to volume storage');
        return new LocalFileStorage(config.storagePath) as any;
      }
      logger.info('☁️ Using Cloudflare R2 storage');
      return new CloudflareR2Storage();

    case 'aws-s3':
      logger.info('☁️ Using AWS S3 storage');
      return new S3Storage();

    default:
      logger.warn(`⚠️ Unknown storage provider: ${config.storageProvider}, falling back to volume storage`);
      try {
        return new LocalFileStorage(config.storagePath) as any;
      } catch (error) {
        logger.error('Failed to initialize fallback storage:', error);
        throw new Error('Storage initialization failed');
      }
  }
}

export const storageProvider = createStorageProvider();

/**
 * Training bucket — separate R2 bucket for RLHF signals, feedback exports, and session data.
 * Uses the same R2 credentials but a different bucket (R2_TRAINING_BUCKET_NAME).
 * Falls back to the primary storage provider if not configured.
 *
 * Bucket layout:
 *   signals/{userId}/{date}.jsonl          — implicit training signals (copy, regenerate, session status)
 *   feedback/{userId}/{messageId}.json     — explicit thumbs ratings and corrections
 *   rag-sources/{userId}/{messageId}.json  — RAG grounding records per response
 */
export function createTrainingStorageProvider(): StorageProvider {
  const hasR2Config =
    config.r2AccountId &&
    config.r2AccessKeyId &&
    config.r2SecretAccessKey &&
    config.r2TrainingBucketName &&
    config.r2AccountId !== 'undefined' &&
    config.r2AccountId !== 'your-r2-account-id';

  if (hasR2Config) {
    logger.info(`Training storage: Cloudflare R2 bucket "${config.r2TrainingBucketName}"`);
    return new CloudflareR2Storage(config.r2TrainingBucketName);
  }

  logger.info('Training storage: falling back to primary storage provider');
  return storageProvider;
}

export const trainingStorageProvider = createTrainingStorageProvider();
