import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { documentProcessor } from './document-processor.js';
import { embeddingService } from './embedding-service.js';
import { ragService } from './rag-service.js';
import { storageProvider } from './file-storage.js';
import { db } from '../database/connection.js';
import { files, documentChunks, workflowExecutions } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { runWorkflowExecution, resumeWorkflowExecution } from './workflow-runner.js';
import { documentProcessingTime, embeddingGenerationTime, queueProcessingTime, queueSize, ragDocumentsTotal, redisConnections } from '../utils/prometheus-metrics.js';
import { extractMediaMetadata, extractAudio, splitAudioForTranscription, extractFrames, withTempDir } from './media-processing-service.js';
import { transcribeAudio, verifyTranscriptLanguage } from './transcription-service.js';
import { enrichTranscriptSpeakers } from './speaker-intelligence-service.js';
import { generateMediaInsights, type MediaIntelligenceMode } from './media-insight-service.js';
import { analyseVideoFrames, frameIntervalForDuration } from './vision-analysis-service.js';
import { transcriptSegments, mediaInsights, frameAnalyses } from '../database/schema.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import crypto from 'crypto';

type TranscriptSegmentRow = typeof transcriptSegments.$inferSelect;
type MediaInsightRow = typeof mediaInsights.$inferSelect;

// Job interfaces
export interface ProcessDocumentJob {
  fileId: string;
  userId: string;
  buffer: Buffer;
  filename: string;
  mimetype: string;
  size: number;
  storeOriginal?: boolean; // Whether to store the original file (default: false)
}

export interface IndexDocumentJob {
  fileId: string;
}

export interface WorkflowExecutionJob {
  executionId: string;
}

export interface MediaProcessingJob {
  fileId: string;
  userId: string;
  jobType: 'extract_metadata' | 'extract_audio' | 'extract_frames';
  insightModel?: string;
  intelligenceMode?: MediaIntelligenceMode;
  options?: {
    frameInterval?: number;      // seconds between frames (default: 5)
    audioFormat?: 'wav' | 'mp3' | 'flac';
  };
  // Resume metadata — set when this job was enqueued by a suspending workflow node.
  // The worker uses these to resume the execution directly without a DB look-up.
  resumeExecutionId?: string;
  resumeNodeId?: string;
}

export interface AcquisitionIngestJob {
  payload: Record<string, unknown>;
  headers?: Record<string, unknown>;
  ownerUserId?: string;
}

export interface QueueWorkers {
  documentProcessingWorker: Worker<ProcessDocumentJob> | null;
  documentIndexingWorker: Worker<IndexDocumentJob> | null;
  workflowExecutionWorker: Worker<WorkflowExecutionJob> | null;
  mediaProcessingWorker: Worker<MediaProcessingJob> | null;
  acquisitionIngestWorker: Worker<AcquisitionIngestJob> | null;
}

function pickMediaKnowledgeWindow(durationSec: number): number {
  if (durationSec <= 12 * 60) return 120;
  if (durationSec <= 30 * 60) return 300;
  return 600;
}

function clipMediaText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildMediaKnowledgeChunks(
  fileId: string,
  segments: TranscriptSegmentRow[],
  insights: MediaInsightRow[],
  frameResults: Array<{ timestampSec: number; description: string; detectedText: string | null }> = [],
) {
  // Exclude low-confidence segments (silence, noise, garbled audio) from knowledge chunks
  const orderedSegments = [...segments]
    .filter(segment => !(segment.metadata as any)?.lowConfidence)
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const durationSec = orderedSegments.length > 0 ? Math.max(...orderedSegments.map(segment => segment.endTime)) : 0;
  const windowSec = pickMediaKnowledgeWindow(durationSec);
  const rows: Array<typeof documentChunks.$inferInsert> = [];

  for (let index = 0; index < Math.max(1, Math.ceil(durationSec / windowSec)); index += 1) {
    const startTime = index * windowSec;
    const endTime = Math.min(durationSec || windowSec, startTime + windowSec);
    const chapterSegments = orderedSegments.filter(
      segment => segment.startTime < endTime && segment.endTime >= startTime,
    );

    if (chapterSegments.length === 0) continue;

    const chapterInsights = insights.filter(insight => {
      if (insight.startTime === null || insight.startTime === undefined) return false;
      const insightEnd = insight.endTime ?? insight.startTime;
      return insight.startTime < endTime && insightEnd >= startTime;
    });
    const chapterFrames = frameResults.filter(frame => frame.timestampSec >= startTime && frame.timestampSec < endTime);

    const topicTitles = [
      ...new Set(
        chapterInsights
          .filter(insight => insight.insightType === 'topic')
          .map(insight => insight.title)
          .filter(Boolean),
      ),
    ].slice(0, 4);

    const strongestMoment = [...chapterInsights]
      .filter(insight => insight.insightType === 'highlight' || insight.insightType === 'key_moment')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

    const transcriptExcerpt = clipMediaText(
      chapterSegments
        .slice(0, 8)
        .map(segment => `[${segment.startTime.toFixed(1)}-${segment.endTime.toFixed(1)}] ${segment.text}`)
        .join(' '),
      1800,
    );
    const visualExcerpt = clipMediaText(
      chapterFrames
        .slice(0, 3)
        .map(frame => frame.detectedText ? `[${frame.timestampSec.toFixed(1)}] ${frame.description} | "${frame.detectedText}"` : `[${frame.timestampSec.toFixed(1)}] ${frame.description}`)
        .join(' '),
      600,
    );

    const contentParts = [
      `Media chapter ${index + 1}`,
      `Timeline: ${startTime.toFixed(1)}s-${endTime.toFixed(1)}s`,
      topicTitles.length ? `Topics: ${topicTitles.join(', ')}` : '',
      strongestMoment?.title ? `Key moment: ${strongestMoment.title}` : '',
      strongestMoment?.description ? `Why it matters: ${strongestMoment.description}` : '',
      visualExcerpt ? `Visual context: ${visualExcerpt}` : '',
      `Transcript excerpt: ${transcriptExcerpt}`,
    ].filter(Boolean);

    rows.push({
      fileId,
      chunkIndex: index,
      content: contentParts.join('\n'),
      metadata: {
        startChar: 0,
        endChar: transcriptExcerpt.length,
        section: 'media_chapter',
        heading: topicTitles[0] ? `Chapter ${index + 1}: ${topicTitles[0]}` : `Chapter ${index + 1}`,
        mediaStartTime: startTime,
        mediaEndTime: endTime,
        sourceType: strongestMoment ? 'media_summary' : 'media_transcript',
        tags: topicTitles,
      },
    });
  }

  return rows;
}

// Redis connection state
let redis: IORedis | null = null;
let isRedisAvailable = false;
let connectionAttempted = false;
let queueMetricsInterval: NodeJS.Timeout | null = null;

// Initialize Redis connection with proper error handling
function initializeRedis(): IORedis | null {
  if (connectionAttempted) {
    return redis;
  }
  
  connectionAttempted = true;
  
  try {
    logger.info(`Attempting to connect to Redis at ${config.redisUrl}...`);
    
    const redisClient = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      retryStrategy: (times: number) => {
        // Only retry a few times before giving up
        if (times > 3) {
          logger.warn('Redis connection failed after 3 attempts - queue features disabled');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 1000, 5000);
        return delay;
      },
      enableReadyCheck: true,
      connectTimeout: 5000,
      lazyConnect: true, // Don't connect immediately
    });

    // Handle Redis connection events
    redisClient.on('connect', () => {
      logger.info('✓ Redis connected successfully');
      isRedisAvailable = true;
      redisConnections.set(1);
    });

    redisClient.on('ready', () => {
      logger.info('✓ Redis is ready');
      isRedisAvailable = true;
      redisConnections.set(1);
    });

    redisClient.on('error', (err: Error) => {
      if (err.message.includes('ECONNREFUSED')) {
        logger.warn('⚠ Redis connection refused - queue features disabled');
      } else {
        logger.error('Redis error:', err.message);
      }
      isRedisAvailable = false;
      redisConnections.set(0);
    });

    redisClient.on('close', () => {
      isRedisAvailable = false;
      redisConnections.set(0);
    });

    // Try to connect
    redisClient.connect().catch((err: Error) => {
      logger.warn(`⚠ Unable to connect to Redis: ${err.message}`);
      logger.warn('⚠ Background document processing disabled. The API will still work, but documents will be processed synchronously.');
      isRedisAvailable = false;
      redisConnections.set(0);
    });

    redis = redisClient;
    return redisClient;
    
  } catch (error) {
    logger.warn('⚠ Failed to initialize Redis:', error instanceof Error ? error.message : 'Unknown error');
    logger.warn('⚠ Queue features will be unavailable');
    redisConnections.set(0);
    return null;
  }
}

// Initialize Redis
const redisInstance = initializeRedis();

// Export redisInstance for health checks
export { redisInstance };

// Create queues only if Redis is available
export const documentProcessingQueue = redisInstance ? new Queue<ProcessDocumentJob>('document-processing', {
  connection: redisInstance as any,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
}) : null;

export const documentIndexingQueue = redisInstance ? new Queue<IndexDocumentJob>('document-indexing', {
  connection: redisInstance as any,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
}) : null;

export const workflowExecutionQueue = redisInstance ? new Queue<WorkflowExecutionJob>('workflow-execution', {
  connection: redisInstance as any,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
}) : null;

export const mediaProcessingQueue = redisInstance ? new Queue<MediaProcessingJob>('media-processing', {
  connection: redisInstance as any,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
}) : null;

export const acquisitionIngestQueue = redisInstance ? new Queue<AcquisitionIngestJob>('acquisition-ingest', {
  connection: redisInstance as any,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
}) : null;

export let documentProcessingWorker: Worker<ProcessDocumentJob> | null = null;
export let documentIndexingWorker: Worker<IndexDocumentJob> | null = null;
export let workflowExecutionWorker: Worker<WorkflowExecutionJob> | null = null;
export let mediaProcessingWorker: Worker<MediaProcessingJob> | null = null;
export let acquisitionIngestWorker: Worker<AcquisitionIngestJob> | null = null;
let queueWorkersInitialized = false;

function createDocumentProcessingWorker(): Worker<ProcessDocumentJob> | null {
  if (!redisInstance) {
    return null;
  }

  return new Worker<ProcessDocumentJob>(
    'document-processing' as any,
    async (job: Job<ProcessDocumentJob>) => {
      const { fileId, userId, buffer, filename, mimetype, size, storeOriginal = false } = job.data;
      const startedAt = Date.now();
      
      try {
        logger.info(`Processing document: ${filename} (${fileId}), storeOriginal: ${storeOriginal}`);

        // Convert buffer back from serialized object (Redis serializes Buffers as objects)
        const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from((buffer as any).data || buffer);
        logger.info(`Buffer type: ${Buffer.isBuffer(buffer) ? 'Buffer' : typeof buffer}, size: ${fileBuffer.length} bytes`);

        // Update file status to processing
        await db
          .update(files)
          .set({
            status: 'processing',
            metadata: {
              processingStage: 'extracting',
              indexingStatus: 'pending',
              keywordSearchAvailable: false,
              vectorSearchAvailable: false,
            } as any,
          })
          .where(eq(files.id, fileId));

        // Conditionally upload file to storage based on storeOriginal flag
        let storageUrl: string | null = null;
        let storageKey: string | null = null;
        
        if (storeOriginal) {
          const ext = filename.split('.').pop() || 'bin';
          storageKey = `documents/${userId}/${fileId}/original.${ext}`;
          const objectMetadata: Record<string, string> = {
            'user-id': userId,
            'file-id': fileId,
            'original-filename': encodeURIComponent(filename),
            'uploaded-at': new Date().toISOString(),
          };
          try {
            storageUrl = await storageProvider.uploadFile(fileBuffer, storageKey, mimetype, objectMetadata);
            logger.info(`✓ Original file stored at key: ${storageKey}`);
          } catch (storageError) {
            logger.warn(`Failed to store original file (continuing with processing):`, storageError);
            // Continue processing even if storage fails - we can still index the content
          }
        } else {
          logger.info(`⚡ Processing without storing original file (process-only mode)`);
        }

        // Process document (extract text and create chunks) with proper buffer
        const { extractedText, chunks } = await documentProcessor.processDocument(
          fileBuffer,
          filename,
          mimetype
        );

        // Update file with storage URL (if stored) and metadata
        await db
          .update(files)
          .set({
            storageUrl,
            storageKey,
            storageProvider: config.storageProvider as 'volume' | 'cloudflare-r2' | 'aws-s3',
            metadata: {
              pages: extractedText.metadata.pages,
              language: extractedText.metadata.language,
              extractedText: extractedText.content.substring(0, 1000), // Store first 1000 chars
              storeOriginal: storeOriginal,
              chunks: chunks.length,
              processingStage: documentIndexingQueue ? 'awaiting_indexing' : 'processed_without_indexing',
              indexingStatus: documentIndexingQueue ? 'queued' : 'unavailable',
              keywordSearchAvailable: true,
              vectorSearchAvailable: false,
            } as any,
          })
          .where(eq(files.id, fileId));

        // Insert document chunks into database with adaptive chunking metadata
        const chunkInserts = chunks.map(chunk => ({
          fileId,
          content: chunk.content,
          chunkIndex: chunk.index,
          metadata: {
            startChar: chunk.startChar,
            endChar: chunk.endChar,
            wordCount: chunk.metadata.wordCount,
            characterCount: chunk.metadata.characterCount,
            // Adaptive chunking metadata
            sizeClass: chunk.metadata.sizeClass,
            chunkTarget: chunk.metadata.chunkTarget,
            chunkOverlap: chunk.metadata.chunkOverlap,
            retrievalK: chunk.metadata.retrievalK,
            heading: chunk.metadata.heading,
            elementTypes: chunk.metadata.elementTypes,
            isShadow: chunk.metadata.isShadow,
          },
        }));

        await db.insert(documentChunks).values(chunkInserts);

        // Update file status to processed
        await db
          .update(files)
          .set({
            status: 'processed',
            metadata: {
              pages: extractedText.metadata.pages,
              language: extractedText.metadata.language,
              extractedText: extractedText.content.substring(0, 1000),
              storeOriginal: storeOriginal,
              chunks: chunks.length,
              processingStage: documentIndexingQueue ? 'awaiting_indexing' : 'ready_with_limited_search',
              indexingStatus: documentIndexingQueue ? 'queued' : 'unavailable',
              keywordSearchAvailable: true,
              vectorSearchAvailable: false,
            } as any,
          })
          .where(eq(files.id, fileId));

        // Queue document for indexing (embedding generation) if indexing queue is available
        if (documentIndexingQueue) {
          await documentIndexingQueue.add('index-document' as any, { fileId });
        }

        documentProcessingTime.observe(
          { document_type: mimetype || 'unknown', operation: 'extract_and_chunk' },
          (Date.now() - startedAt) / 1000
        );
        queueProcessingTime.observe(
          { queue_name: 'document-processing', status: 'success' },
          (Date.now() - startedAt) / 1000
        );
        ragDocumentsTotal.inc({ operation: 'process', status: 'success' });
        logger.info(`Successfully processed document: ${filename} (${fileId})`);

      } catch (error) {
        logger.error(`Failed to process document ${fileId}:`, error);
        
        // Update file status to failed
        await db
          .update(files)
          .set({ 
            status: 'failed',
            processingError: error instanceof Error ? error.message : 'Unknown error'
          })
          .where(eq(files.id, fileId));

        queueProcessingTime.observe(
          { queue_name: 'document-processing', status: 'error' },
          (Date.now() - startedAt) / 1000
        );
        ragDocumentsTotal.inc({ operation: 'process', status: 'error' });

        throw error;
      }
    },
    {
      connection: redisInstance as any,
      concurrency: 2, // Process 2 documents at a time
    }
  );
}

function createDocumentIndexingWorker(): Worker<IndexDocumentJob> | null {
  if (!redisInstance) {
    return null;
  }

  return new Worker<IndexDocumentJob>(
    'document-indexing' as any,
    async (job: Job<IndexDocumentJob>) => {
      const { fileId } = job.data;
      const startedAt = Date.now();
      
      try {
        logger.info(`🔍 Indexing document: ${fileId}`);

        const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
        const currentMetadata = (file?.metadata || {}) as Record<string, any>;
        const isMediaKnowledgeAsset = Boolean(currentMetadata?.mediaType);
        await db
          .update(files)
          .set({
            metadata: {
              ...currentMetadata,
              processingStage: isMediaKnowledgeAsset
                ? 'generating_embeddings'
                : 'indexing',
              indexingStatus: 'running',
              indexingAttemptedAt: new Date().toISOString(),
            } as any,
          })
          .where(eq(files.id, fileId));

        // Index the document (generate embeddings)
        await ragService.indexDocument(fileId);

        const [indexedFile] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
        const indexedMetadata = (indexedFile?.metadata || {}) as Record<string, any>;
        await db
          .update(files)
          .set({
            status: 'processed',
            metadata: {
              ...indexedMetadata,
              processingStage: isMediaKnowledgeAsset
                ? 'insights_ready'
                : 'ready',
              indexingStatus: 'completed',
              indexingFailed: false,
              indexedAt: new Date().toISOString(),
              keywordSearchAvailable: true,
              vectorSearchAvailable: true,
              mediaKnowledgeSyncedAt: isMediaKnowledgeAsset ? new Date().toISOString() : indexedMetadata.mediaKnowledgeSyncedAt,
            } as any,
          })
          .where(eq(files.id, fileId));

        logger.info(`Successfully indexed document: ${fileId}`);
        embeddingGenerationTime.observe(
          { model: 'document-indexing', document_type: 'unknown' },
          (Date.now() - startedAt) / 1000
        );
        queueProcessingTime.observe(
          { queue_name: 'document-indexing', status: 'success' },
          (Date.now() - startedAt) / 1000
        );
        ragDocumentsTotal.inc({ operation: 'index', status: 'success' });
        
        // Job completed successfully
        return { success: true, fileId };

      } catch (error) {
        // Log the error but don't fail the document
        // Documents can still be searched via keyword search even without embeddings
        logger.error(`Failed to index document ${fileId}:`, error);
        
        // Update metadata to indicate indexing failed but don't change status
        // The document is still "processed" and searchable via keyword search
        try {
          const file = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
          if (file.length > 0) {
            // Ensure status remains processed even if it was somehow changed
            if (file[0].status !== 'processed') {
              logger.warn(`Document ${fileId} status is ${file[0].status}, ensuring it's set to processed`);
              await db
                .update(files)
                .set({ status: 'processed' })
                .where(eq(files.id, fileId));
            }
            
            // Update metadata to track indexing failure
            const currentMetadata = (file[0].metadata || {}) as Record<string, any>;
            const isMediaKnowledgeAsset = Boolean(currentMetadata?.mediaType);
            await db
              .update(files)
              .set({
                status: 'processed', // Explicitly ensure status is processed
                metadata: {
                  ...currentMetadata,
                  processingStage: isMediaKnowledgeAsset
                    ? 'insights_ready'
                    : 'ready_with_limited_search',
                  indexingStatus: 'failed',
                  indexingFailed: true,
                  indexingError: error instanceof Error ? error.message : 'Unknown error',
                  indexingAttemptedAt: new Date().toISOString(),
                  keywordSearchAvailable: true,
                  vectorSearchAvailable: false,
                } as any
              })
              .where(eq(files.id, fileId));
            
            logger.info(`Document ${fileId} remains processed despite indexing failure - keyword search available`);
          } else {
            logger.warn(`Document ${fileId} not found in database`);
          }
        } catch (updateError) {
          logger.error(`Failed to update metadata for document ${fileId}:`, updateError);
        }

        queueProcessingTime.observe(
          { queue_name: 'document-indexing', status: 'error' },
          (Date.now() - startedAt) / 1000
        );
        ragDocumentsTotal.inc({ operation: 'index', status: 'error' });
        
        // Return success even though indexing failed - job completes successfully
        // This prevents BullMQ from marking the job as failed and retrying
        // The document is still usable without embeddings via keyword search
        return { success: false, fileId, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
    {
      connection: redisInstance as any,
      concurrency: 1, // Process 1 document at a time for indexing
    }
  );
}

function createWorkflowExecutionWorker(): Worker<WorkflowExecutionJob> | null {
  if (!redisInstance) {
    return null;
  }

  return new Worker<WorkflowExecutionJob>(
    'workflow-execution' as any,
    async (job: Job<WorkflowExecutionJob>) => {
      const { executionId } = job.data;
      const startedAt = Date.now();
      logger.info(`Executing workflow job: ${executionId}`);
      try {
        await runWorkflowExecution(executionId);
        queueProcessingTime.observe(
          { queue_name: 'workflow-execution', status: 'success' },
          (Date.now() - startedAt) / 1000
        );
        return { success: true, executionId };
      } catch (error) {
        queueProcessingTime.observe(
          { queue_name: 'workflow-execution', status: 'error' },
          (Date.now() - startedAt) / 1000
        );
        throw error;
      }
    },
    {
      connection: redisInstance as any,
      concurrency: 2,
    }
  );
}

function createMediaProcessingWorker(): Worker<MediaProcessingJob> | null {
  if (!redisInstance) {
    return null;
  }

  return new Worker<MediaProcessingJob>(
    'media-processing' as any,
    async (job: Job<MediaProcessingJob>) => {
      const { fileId, userId, jobType, options = {} } = job.data;
      const startedAt = Date.now();

      try {
        logger.info(`Media processing job [${jobType}]: ${fileId}`);

        // Fetch file record to get storageKey
        const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
        if (!file) throw new Error(`File not found: ${fileId}`);
        if (!file.storageKey) throw new Error(`File ${fileId} has no storageKey — cannot process`);

        await db
          .update(files)
          .set({ status: 'processing' })
          .where(eq(files.id, fileId));

        if (jobType === 'extract_metadata') {
          // Download to temp file, probe with FFmpeg, persist metadata
          await withTempDir(async (tmpDir) => {
            const ext = path.extname(file.filename) || '.bin';
            const tmpPath = path.join(tmpDir, `media${ext}`);

            logger.info(`Downloading ${file.storageKey} for FFmpeg probe`);
            const buffer = await storageProvider.downloadFile(file.storageKey!);
            await fs.writeFile(tmpPath, buffer);

            const mediaMeta = await extractMediaMetadata(tmpPath);
            const currentMeta = (file.metadata || {}) as Record<string, any>;

            await db
              .update(files)
              .set({
                status: 'processed',
                metadata: {
                  ...currentMeta,
                  // Media-specific fields
                  mediaType: mediaMeta.mediaType,
                  duration: mediaMeta.duration,
                  width: mediaMeta.width,
                  height: mediaMeta.height,
                  fps: mediaMeta.fps,
                  videoCodec: mediaMeta.videoCodec,
                  audioCodec: mediaMeta.audioCodec,
                  audioChannels: mediaMeta.audioChannels,
                  bitrate: mediaMeta.bitrate,
                  processingStage: 'metadata_extracted',
                  metadataExtractedAt: new Date().toISOString(),
                } as any,
              })
              .where(eq(files.id, fileId));

            logger.info(`✓ Media metadata extracted for ${fileId}: ${mediaMeta.mediaType}, ${mediaMeta.duration}s`);
          });

          if (mediaProcessingQueue) {
            await mediaProcessingQueue.add('extract-audio' as any, {
              fileId,
              userId,
              jobType: 'extract_audio',
            });
            logger.info(`Queued extract_audio job for ${fileId}`);
          }

        } else if (jobType === 'extract_audio') {
          // Extract audio track → transcribe → persist transcript_segments
          await withTempDir(async (tmpDir) => {
            const mediaExt = path.extname(file.filename) || '.bin';
            const mediaTmp = path.join(tmpDir, `media${mediaExt}`);
            const audioTmp = path.join(tmpDir, 'audio.mp3');
            const chunksDir = path.join(tmpDir, 'chunks');

            logger.info(`Downloading ${file.storageKey} for audio extraction`);
            const buffer = await storageProvider.downloadFile(file.storageKey!);
            await fs.writeFile(mediaTmp, buffer);

            // Strip audio track to compressed mono MP3 to stay within provider upload limits.
            await extractAudio(mediaTmp, audioTmp, 'mp3');

            // Upload extracted audio so future jobs (re-transcribe, preview) can reuse it
            const audioKey = `media/${userId}/${fileId}/audio.mp3`;
            const audioBuffer = await fs.readFile(audioTmp);
            await storageProvider.uploadFile(audioBuffer, audioKey, 'audio/mpeg', {
              'file-id': fileId,
              'user-id': userId,
            });

            // Split into smaller chunks before calling Groq transcription.
            const audioChunks = await splitAudioForTranscription(audioTmp, chunksDir, 8 * 60, 'mp3');
            const mergedSegments = [];
            let language = 'en';
            let totalDuration = 0;
            let sequenceOffset = 0;

            for (const chunk of audioChunks) {
              const chunkBuffer = await fs.readFile(chunk.path);
              const chunkResult = await transcribeAudio(
                chunkBuffer,
                path.basename(chunk.path),
                undefined,
                {
                  mimeType: 'audio/mpeg',
                  timeOffsetSec: chunk.startTime,
                  sequenceOffset,
                },
              );

              language = chunkResult.language || language;
              totalDuration = Math.max(totalDuration, chunk.startTime + chunkResult.duration);
              sequenceOffset += chunkResult.segments.length;
              mergedSegments.push(...chunkResult.segments);
            }

            const speakerEnrichment = enrichTranscriptSpeakers(mergedSegments);
            const verifiedLanguage = await verifyTranscriptLanguage(
              speakerEnrichment.segments,
              undefined,
              language,
            );
            const verifiedSegments = speakerEnrichment.segments.map(segment => ({
              ...segment,
              language: verifiedLanguage,
            }));

            const result = {
              segments: verifiedSegments,
              language: verifiedLanguage,
              duration: totalDuration,
              provider: 'groq' as const,
            };

            await db.delete(transcriptSegments).where(eq(transcriptSegments.fileId, fileId));

            // Persist segments
            if (result.segments.length > 0) {
              await db.insert(transcriptSegments).values(
                result.segments.map(seg => ({
                  fileId,
                  speaker: seg.speaker,
                  startTime: seg.startTime,
                  endTime: seg.endTime,
                  text: seg.text,
                  confidence: seg.confidence,
                  sequenceIndex: seg.sequenceIndex,
                  language: seg.language,
                  metadata: {
                    ...seg.metadata,
                    ...(seg.lowConfidence ? { lowConfidence: true } : {}),
                  },
                })),
              );
            }

            const currentMeta = (file.metadata || {}) as Record<string, any>;
            await db
              .update(files)
              .set({
                status: 'processed',
                metadata: {
                  ...currentMeta,
                  audioStorageKey: audioKey,
                  intelligenceMode: job.data.intelligenceMode || currentMeta.intelligenceMode || 'balanced',
                  transcriptionLanguage: result.language,
                  transcriptionDuration: result.duration,
                  transcriptionSegments: result.segments.length,
                  speakersDetected: speakerEnrichment.speakersDetected,
                  speakerAttributionStrategy: speakerEnrichment.strategy,
                  speakerAttributionConfidence: speakerEnrichment.confidence,
                  processingStage: currentMeta.mediaType === 'video' ? 'analyzing_frames' : 'transcribed',
                  transcribedAt: new Date().toISOString(),
                } as any,
              })
              .where(eq(files.id, fileId));

            logger.info(`✓ Transcription complete for ${fileId}: ${result.segments.length} segments`);
          });

          if (mediaProcessingQueue) {
            await mediaProcessingQueue.add('extract-frames' as any, {
              fileId,
              userId,
              jobType: 'extract_frames',
              insightModel: job.data.insightModel,
              intelligenceMode: job.data.intelligenceMode,
              resumeExecutionId: job.data.resumeExecutionId,
              resumeNodeId: job.data.resumeNodeId,
            });
            logger.info(`Queued extract_frames job for ${fileId}`);
          }

          // Resume any workflow execution that suspended waiting for this transcription.
          // The job carries resumeExecutionId directly — no DB query needed.
          if (job.data.resumeExecutionId) {
            logger.info(`Resuming workflow execution ${job.data.resumeExecutionId} after extract_audio for ${fileId}`);
            resumeWorkflowExecution(job.data.resumeExecutionId, {
              fileId,
              transcriptionComplete: true,
            }).catch(err => logger.error(`Failed to resume execution ${job.data.resumeExecutionId}:`, err));
          }

        } else if (jobType === 'extract_frames') {
          // Step 1: load transcript segments
          const segments = await db
            .select()
            .from(transcriptSegments)
            .where(eq(transcriptSegments.fileId, fileId))
            .orderBy(transcriptSegments.sequenceIndex);

          const segmentData = segments.map(s => ({
            startTime: s.startTime,
            endTime: s.endTime,
            text: s.text,
            confidence: s.confidence ?? undefined,
            sequenceIndex: s.sequenceIndex,
            language: s.language ?? undefined,
            speaker: s.speaker ?? undefined,
            metadata: (s.metadata ?? {}) as any,
          }));

          // Step 2: extract video frames + run vision analysis (video files only)
          const fileMeta = (file.metadata || {}) as Record<string, any>;
          const isVideo = fileMeta.mediaType === 'video';
          let visionResults: Awaited<ReturnType<typeof analyseVideoFrames>> = [];

          if (isVideo && file.storageKey) {
            await db.update(files).set({
              metadata: { ...fileMeta, processingStage: 'analyzing_frames' } as any,
            }).where(eq(files.id, fileId));

            await withTempDir(async (tmpDir) => {
              const mediaExt = path.extname(file.filename) || '.bin';
              const mediaTmp = path.join(tmpDir, `media${mediaExt}`);
              const framesDir = path.join(tmpDir, 'frames');

              logger.info(`Downloading ${file.storageKey} for frame extraction`);
              const mediaBuffer = await storageProvider.downloadFile(file.storageKey!);
              await fs.writeFile(mediaTmp, mediaBuffer);

              const duration = fileMeta.duration ?? 0;
              const intervalSecs = frameIntervalForDuration(duration);
              logger.info(`Extracting frames every ${intervalSecs}s for ${fileId} (duration: ${duration}s)`);

              const framePaths = await extractFrames(mediaTmp, framesDir, intervalSecs);
              const framedWithTimestamps = framePaths.map((framePath, index) => ({
                path: framePath,
                timestampSec: index * intervalSecs,
              }));

              visionResults = await analyseVideoFrames(framedWithTimestamps);

              if (visionResults.length > 0) {
                await db.delete(frameAnalyses).where(eq(frameAnalyses.fileId, fileId));
                await db.insert(frameAnalyses).values(
                  visionResults.map(f => ({
                    fileId,
                    timestampSec: f.timestampSec,
                    description: f.description,
                    objects: f.objects,
                    detectedText: f.detectedText,
                    confidence: f.confidence,
                    metadata: f.metadata,
                  })),
                );
                logger.info(`✓ Persisted ${visionResults.length} frame analyses for ${fileId}`);
              }
            });
          }

          // Step 3: build combined audio+visual timeline and generate insights
          await db.update(files).set({
            metadata: { ...fileMeta, processingStage: 'building_timeline' } as any,
          }).where(eq(files.id, fileId));

          if (segmentData.length === 0 && visionResults.length === 0) {
            logger.warn(`No transcript or frame data found for ${fileId} — skipping insight generation`);
            await db.update(files).set({ status: 'processed' }).where(eq(files.id, fileId));
          } else {
            const result = await generateMediaInsights(segmentData, undefined, {
              preferredModel: job.data.insightModel,
              frameAnalyses: visionResults,
              speakerAttributionStrategy: (fileMeta.speakerAttributionStrategy as any) || 'none',
              intelligenceMode: job.data.intelligenceMode || (fileMeta.intelligenceMode as MediaIntelligenceMode | undefined) || 'balanced',
              onProgress: async (stage) => {
                await db.update(files).set({
                  metadata: { ...fileMeta, processingStage: stage } as any,
                }).where(eq(files.id, fileId));
              },
            });

            await db.update(files).set({
              metadata: { ...fileMeta, processingStage: 'packaging_insights' } as any,
            }).where(eq(files.id, fileId));

            await db.delete(mediaInsights).where(eq(mediaInsights.fileId, fileId));

            if (result.insights.length > 0) {
              await db.insert(mediaInsights).values(
                result.insights.map(ins => ({
                  fileId,
                  insightType: ins.insightType,
                  title: ins.title,
                  description: ins.description,
                  startTime: ins.startTime,
                  endTime: ins.endTime,
                  score: ins.score,
                  tags: ins.tags,
                  metadata: ins.metadata,
                })),
              );
            }

            const knowledgeChunks = buildMediaKnowledgeChunks(fileId, segments, result.insights.map(ins => ({
              id: crypto.randomUUID(),
              fileId,
              insightType: ins.insightType,
              title: ins.title,
              description: ins.description ?? null,
              startTime: ins.startTime ?? null,
              endTime: ins.endTime ?? null,
              score: ins.score ?? null,
              tags: ins.tags,
              metadata: ins.metadata,
              createdAt: new Date(),
            })), visionResults.map(frame => ({
              timestampSec: frame.timestampSec,
              description: frame.description,
              detectedText: frame.detectedText,
            })));

            await db.delete(documentChunks).where(eq(documentChunks.fileId, fileId));
            if (knowledgeChunks.length > 0) {
              await db.insert(documentChunks).values(knowledgeChunks);
            }

            const currentMeta = (file.metadata || {}) as Record<string, any>;
            await db
              .update(files)
              .set({
                status: 'processed',
                metadata: {
                  ...currentMeta,
                  insightsGenerated: result.insights.length,
                  insightProvider: result.provider,
                  insightModel: result.model,
                  intelligenceMode: job.data.intelligenceMode || (fileMeta.intelligenceMode as MediaIntelligenceMode | undefined) || 'balanced',
                  framesAnalysed: visionResults.length,
                  hasVisualContext: visionResults.length > 0,
                  processingStage: documentIndexingQueue && knowledgeChunks.length > 0 ? 'syncing_knowledge' : 'insights_ready',
                  insightsGeneratedAt: new Date().toISOString(),
                  chunks: knowledgeChunks.length,
                  indexingStatus: documentIndexingQueue && knowledgeChunks.length > 0 ? 'queued' : currentMeta.indexingStatus,
                  keywordSearchAvailable: true,
                  vectorSearchAvailable: false,
                } as any,
              })
              .where(eq(files.id, fileId));

            if (documentIndexingQueue && knowledgeChunks.length > 0) {
              await documentIndexingQueue.add('index-document' as any, { fileId });
              logger.info(`Queued media knowledge indexing for ${fileId} (${knowledgeChunks.length} chunk(s))`);
            }

            logger.info(`✓ Insight generation complete for ${fileId}: ${result.insights.length} insights (${visionResults.length} frames analysed)`);
          }

                    // Resume any workflow execution that suspended waiting for insight generation.
          if (job.data.resumeExecutionId) {
            logger.info(`Resuming workflow execution ${job.data.resumeExecutionId} after extract_frames for ${fileId}`);
            resumeWorkflowExecution(job.data.resumeExecutionId, {
              fileId,
              insightsComplete: true,
            }).catch(err => logger.error(`Failed to resume execution ${job.data.resumeExecutionId}:`, err));
          }
        }

        queueProcessingTime.observe(
          { queue_name: 'media-processing', status: 'success' },
          (Date.now() - startedAt) / 1000,
        );
        return { success: true, fileId, jobType };

      } catch (error) {
        logger.error(`Media processing job [${jobType}] failed for ${fileId}:`, error);

        await db
          .update(files)
          .set({
            status: 'failed',
            processingError: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(files.id, fileId));

        queueProcessingTime.observe(
          { queue_name: 'media-processing', status: 'error' },
          (Date.now() - startedAt) / 1000,
        );
        throw error;
      }
    },
    {
      connection: redisInstance as any,
      concurrency: 1, // FFmpeg is CPU-bound — one at a time
    },
  );
}

function createAcquisitionIngestWorker(): Worker<AcquisitionIngestJob> | null {
  if (!redisInstance) {
    return null;
  }

  return new Worker<AcquisitionIngestJob>(
    'acquisition-ingest' as any,
    async (job: Job<AcquisitionIngestJob>) => {
      const startedAt = Date.now();
      try {
        const { ingestMetaWhatsAppWebhook } = await import('./acquisition-ingest-service.js');
        const result = await ingestMetaWhatsAppWebhook({
          payload: job.data.payload as any,
          headers: job.data.headers,
          ownerUserId: job.data.ownerUserId,
        });
        queueProcessingTime.observe(
          { queue_name: 'acquisition-ingest', status: 'success' },
          (Date.now() - startedAt) / 1000,
        );
        return result;
      } catch (error) {
        queueProcessingTime.observe(
          { queue_name: 'acquisition-ingest', status: 'error' },
          (Date.now() - startedAt) / 1000,
        );
        throw error;
      }
    },
    {
      connection: redisInstance as any,
      concurrency: 5,
    },
  );
}

function registerWorkerListeners() {
  if (documentProcessingWorker) {
    documentProcessingWorker.on('error', (error) => {
      logger.error('Document processing worker error:', error);
    });

    documentProcessingWorker.on('failed', (job, error) => {
      logger.error(`Document processing job failed for file ${job?.data.fileId}:`, error);
    });
  }

  if (documentIndexingWorker) {
    documentIndexingWorker.on('error', (error) => {
      logger.error('Document indexing worker error:', error);
    });

    documentIndexingWorker.on('failed', async (job, error) => {
      const fileId = job?.data.fileId;
      logger.error(`Document indexing job failed for file ${fileId}:`, error);
      
      // CRITICAL: Ensure document status is NOT changed to failed
      // Indexing failures should not affect document status since keyword search still works
      if (fileId) {
        try {
          const file = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
          if (file.length > 0) {
            // If status is anything other than 'processed', set it to 'processed'
            // This ensures documents remain searchable even if indexing fails
            if (file[0].status !== 'processed') {
              logger.warn(`Document ${fileId} status is ${file[0].status}, correcting to 'processed'`);
              await db
                .update(files)
                .set({ 
                  status: 'processed',
                  processingError: null // Clear any processing errors
                })
                .where(eq(files.id, fileId));
            }
            
            // Update metadata to track indexing failure
            const currentMetadata = (file[0].metadata || {}) as Record<string, any>;
            await db
              .update(files)
              .set({
                metadata: {
                  ...currentMetadata,
                  processingStage: currentMetadata?.mediaType
                    ? 'insights_ready'
                    : 'ready_with_limited_search',
                  indexingStatus: 'failed',
                  indexingFailed: true,
                  indexingError: error instanceof Error ? error.message : 'Unknown error',
                  indexingAttemptedAt: new Date().toISOString(),
                  keywordSearchAvailable: true,
                  vectorSearchAvailable: false,
                } as any
              })
              .where(eq(files.id, fileId));
            
            logger.info(`Document ${fileId} status corrected to 'processed' - indexing failed but document is still searchable`);
          }
        } catch (checkError) {
          logger.error(`Failed to check/correct file status for ${fileId}:`, checkError);
        }
      }
    });
  }

  if (workflowExecutionWorker) {
    workflowExecutionWorker.on('error', (error) => {
      logger.error('Workflow execution worker error:', error);
    });

    workflowExecutionWorker.on('failed', async (job, error) => {
      const executionId = job?.data.executionId;
      logger.error(`Workflow execution job failed for execution ${executionId}:`, error);
      if (executionId) {
        await db
          .update(workflowExecutions)
          .set({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            output: { error: error instanceof Error ? error.message : 'Unknown error' } as any,
            completedAt: new Date(),
          })
          .where(eq(workflowExecutions.id, executionId));
      }
    });
  }

  if (mediaProcessingWorker) {
    mediaProcessingWorker.on('error', (error) => {
      logger.error('Media processing worker error:', error);
    });

    mediaProcessingWorker.on('failed', async (job, error) => {
      const fileId = job?.data.fileId;
      logger.error(`Media processing job [${job?.data.jobType}] failed for ${fileId}:`, error);
    });
  }

  if (acquisitionIngestWorker) {
    acquisitionIngestWorker.on('error', (error) => {
      logger.error('Acquisition ingest worker error:', error);
    });

    acquisitionIngestWorker.on('failed', (job, error) => {
      logger.error(`Acquisition ingest job failed (${job?.id}):`, error);
    });
  }
}

export function initializeQueueWorkers(): QueueWorkers {
  if (!queueWorkersInitialized) {
    documentProcessingWorker = createDocumentProcessingWorker();
    documentIndexingWorker = createDocumentIndexingWorker();
    workflowExecutionWorker = createWorkflowExecutionWorker();
    mediaProcessingWorker = createMediaProcessingWorker();
    acquisitionIngestWorker = createAcquisitionIngestWorker();
    registerWorkerListeners();
    startQueueMetricsPolling();
    queueWorkersInitialized = true;
  }

  return {
    documentProcessingWorker,
    documentIndexingWorker,
    workflowExecutionWorker,
    mediaProcessingWorker,
    acquisitionIngestWorker,
  };
}

const autoStartQueueWorkers = process.env.QUEUE_WORKERS_AUTOSTART !== 'false';

if (autoStartQueueWorkers) {
  initializeQueueWorkers();
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  try {
    if (queueMetricsInterval) {
      clearInterval(queueMetricsInterval);
      queueMetricsInterval = null;
    }
    if (documentProcessingQueue) await documentProcessingQueue.close();
    if (documentIndexingQueue) await documentIndexingQueue.close();
    if (workflowExecutionQueue) await workflowExecutionQueue.close();
    if (mediaProcessingQueue) await mediaProcessingQueue.close();
    if (acquisitionIngestQueue) await acquisitionIngestQueue.close();
    if (documentProcessingWorker) await documentProcessingWorker.close();
    if (documentIndexingWorker) await documentIndexingWorker.close();
    if (workflowExecutionWorker) await workflowExecutionWorker.close();
    if (mediaProcessingWorker) await mediaProcessingWorker.close();
    if (acquisitionIngestWorker) await acquisitionIngestWorker.close();
    if (redis) await redis.quit();
    logger.info('Queues and workers closed');
  } catch (error) {
    logger.error('Error closing queues:', error);
  }
}

// Check if queue system is available
export function isQueueAvailable(): boolean {
  return isRedisAvailable && documentProcessingQueue !== null;
}

// Log queue initialization status
setTimeout(() => {
  if (isRedisAvailable) {
    logger.info('✓ Queue system initialized successfully');
    
    if (documentProcessingWorker) {
      logger.info('✓ Document processing worker initialized');
    }
    
    if (documentIndexingWorker) {
      logger.info('✓ Document indexing worker initialized');
    } else {
      logger.warn('⚠ Document indexing worker NOT initialized');
    }

    if (workflowExecutionWorker) {
      logger.info('✓ Workflow execution worker initialized');
    } else {
      logger.warn('⚠ Workflow execution worker NOT initialized');
    }

    if (mediaProcessingWorker) {
      logger.info('✓ Media processing worker initialized');
    } else {
      logger.warn('⚠ Media processing worker NOT initialized');
    }
  } else {
    logger.warn('⚠ Queue system unavailable - documents will be processed synchronously');
  }
}, 2000);

async function refreshQueueMetrics(): Promise<void> {
  const queueEntries: Array<[string, Queue<any> | null]> = [
    ['document-processing', documentProcessingQueue],
    ['document-indexing', documentIndexingQueue],
    ['workflow-execution', workflowExecutionQueue],
    ['media-processing', mediaProcessingQueue],
    ['acquisition-ingest', acquisitionIngestQueue],
  ];

  for (const [queueName, queue] of queueEntries) {
    if (!queue) {
      queueSize.set({ queue_name: queueName }, 0);
      continue;
    }

    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
      const total = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0) + (counts.prioritized || 0);
      queueSize.set({ queue_name: queueName }, total);
    } catch (error) {
      logger.debug(`Unable to refresh Prometheus queue metrics for ${queueName}:`, error);
    }
  }
}

function startQueueMetricsPolling(): void {
  if (queueMetricsInterval) {
    return;
  }

  void refreshQueueMetrics();
  queueMetricsInterval = setInterval(() => {
    void refreshQueueMetrics();
  }, 15000);
}
