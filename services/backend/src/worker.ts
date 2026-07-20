import { logger } from './utils/logger.js';
import { bootstrapQueueWorkerProcess, registerQueueWorkerShutdownHandlers } from './bootstrap/queue-worker.js';

// Dedicated queue worker entrypoint. The API process stays in src/index.ts.
async function start(): Promise<void> {
  try {
    await bootstrapQueueWorkerProcess();
    registerQueueWorkerShutdownHandlers();
    logger.info('🚀 JoaLLM queue worker process running');
  } catch (error) {
    logger.error('Failed to start queue worker process:', error);
    process.exit(1);
  }
}

start();
