import { initializeDatabase } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import { logger } from '../utils/logger.js';

type QueueModule = typeof import('../services/queue.js');

let queueModule: QueueModule | null = null;

async function loadQueueModule(): Promise<QueueModule> {
  if (!queueModule) {
    // Disable the queue module's default autostart so this process controls worker startup explicitly.
    process.env.QUEUE_WORKERS_AUTOSTART = 'false';
    queueModule = await import('../services/queue.js');
  }

  return queueModule;
}

export async function bootstrapQueueWorkerProcess(): Promise<void> {
  await initializeDatabase();

  logger.info('🔄 Running database migrations...');
  await runMigrations();

  const queue = await loadQueueModule();
  const workers = queue.initializeQueueWorkers();
  logger.info('🧵 Queue worker bootstrap complete');

  if (workers.documentProcessingWorker) {
    logger.info('✓ Document processing worker ready');
  }

  if (workers.documentIndexingWorker) {
    logger.info('✓ Document indexing worker ready');
  }

  if (workers.workflowExecutionWorker) {
    logger.info('✓ Workflow execution worker ready');
  }

  if (workers.mediaProcessingWorker) {
    logger.info('✓ Media processing worker ready');
  }

  if (!queue.isQueueAvailable()) {
    logger.warn('⚠ Queue system unavailable - worker process will idle without BullMQ jobs');
  }
}

export function registerQueueWorkerShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down queue worker process gracefully...`);
    const queue = await loadQueueModule();
    await queue.closeQueues();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
