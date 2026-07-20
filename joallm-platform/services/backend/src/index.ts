import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './utils/error-handler.js';
import { initializeDatabase } from './database/connection.js';
import { runMigrations } from './database/migrate.js';
import { registerDomains } from './domains/index.js';
import { documentProcessingWorker, documentIndexingWorker, workflowExecutionWorker } from './services/queue.js';
import { cacheService } from './services/cache.js';
import { securityHeaders } from './middleware/security.js';
import { registerMonitoring } from './middleware/monitoring.js';

const fastify = Fastify({
  logger: {
    level: config.logLevel,
    transport: config.nodeEnv === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    } : undefined
  }
});

async function buildServer() {
  // Security headers are registered via securityHeaders middleware hook
  
  // Register monitoring middleware (must be early in the pipeline)
  registerMonitoring(fastify);

  const configuredOrigins = config.corsOrigin
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  
  // Register plugins
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow localhost with any port in development
      if (config.nodeEnv === 'development' && origin.match(/^http:\/\/localhost:\d+$/)) {
        callback(null, true);
        return;
      }

      // Allow configured origins
      if (configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB — media files (video/audio) can be up to 500MB; route handler enforces 50MB for non-media
    }
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'JoaLLM API',
        description: 'API for JoaLLM - Swiss Army Knife for Large Language Models',
        version: '1.0.0'
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Development server'
        }
      ]
    }
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });

  // Capture raw body for routes that set config: { rawBody: true }
  // Required for webhook signature verification (Razorpay, Lemon Squeezy)
  fastify.addHook('preParsing', async (request, _reply, payload) => {
    if (!(request.routeOptions as any)?.config?.rawBody) return payload;

    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
    }
    const raw = Buffer.concat(chunks);
    (request as any).rawBody = raw;

    // Return a new readable stream so Fastify can still parse the body
    const { Readable } = await import('node:stream');
    return Readable.from(raw);
  });

  await registerDomains(fastify);

  // Error handler
  fastify.setErrorHandler(errorHandler);

  return fastify;
}

async function start() {
  try {
    // Initialize database (gracefully handle if not available)
    await initializeDatabase();

    // Run database migrations
    logger.info('🔄 Running database migrations...');
    await runMigrations();

    // Connect Redis cache (non-blocking — app works without it)
    await cacheService.connect();
    
    const server = await buildServer();
    
    await server.listen({
      port: config.port,
      host: '0.0.0.0'
    });

    logger.info(`🚀 JoaLLM API server running on port ${config.port}`);
    logger.info(`📚 API Documentation available at http://localhost:${config.port}/docs`);
    logger.info(`🔗 Health check available at http://localhost:${config.port}/api/health`);
    
    // Log worker status
    if (documentProcessingWorker) {
      logger.info(`✓ Document processing worker active`);
    }
    if (documentIndexingWorker) {
      logger.info(`✓ Document indexing worker active`);
    } else {
      logger.warn(`⚠ Document indexing worker NOT active - files won't be searchable!`);
    }
    if (workflowExecutionWorker) {
      logger.info(`✓ Workflow execution worker active`);
    } else {
      logger.warn(`⚠ Workflow execution worker NOT active - workflow execution will fall back to API process`);
    }
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (documentProcessingWorker) await documentProcessingWorker.close();
  if (documentIndexingWorker) await documentIndexingWorker.close();
  await cacheService.disconnect();
  await fastify.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
