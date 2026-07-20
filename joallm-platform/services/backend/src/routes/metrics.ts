import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { register } from '../utils/prometheus-metrics.js';
import { db } from '../database/connection.js';
import { redisInstance } from '../services/queue.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

export async function metricsRoutes(fastify: FastifyInstance) {
  // Metrics endpoint for Prometheus
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await register.metrics();
      reply.type('text/plain; version=0.0.4; charset=utf-8');
      return metrics;
    } catch (error) {
      logger.error('Error generating metrics', { err: error });
      reply.code(500);
      return { error: 'Failed to generate metrics' };
    }
  });

  // Health check endpoint with metrics
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Perform actual health checks
      const dbHealthy = await checkDatabase();
      const redisHealthy = await checkRedis();
      const memoryHealthy = checkMemory();

      const allHealthy = dbHealthy && redisHealthy && memoryHealthy;

      const health = {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        checks: {
          database: dbHealthy,
          redis: redisHealthy,
          memory: memoryHealthy
        }
      };

      // Return 503 if unhealthy so load balancers/Railway know
      if (!allHealthy) {
        reply.code(503);
      }

      return health;
    } catch (error) {
      logger.error('Telemetry health check failed', { err: error });
      reply.code(503);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      };
    }
  });

  // Detailed health check with service dependencies
  fastify.get('/health/detailed', async (request: FastifyRequest, reply: FastifyReply) => {
    const checks = {
      database: await checkDatabase(),
      redis: await checkRedis(),
      memory: checkMemory(),
      disk: checkDiskSpace(),
      services: await checkServices()
    };

    const overallStatus = Object.values(checks).every(check => 
      typeof check === 'boolean' ? check : check.status === 'healthy'
    ) ? 'healthy' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks
    };
  });
}

async function checkDatabase(): Promise<boolean> {
  try {
    // Execute a simple query to test database connection
    await db.execute(sql`SELECT 1 as health_check`);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    // If Redis is not configured (optional service), consider it healthy
    if (!redisInstance) {
      return true; // Redis is optional, not a failure
    }
    
    // Test Redis connection with a PING command
    const result = await redisInstance.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

function checkMemory(): boolean {
  const memUsage = process.memoryUsage();
  const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;
  const memoryLimitMB = (memUsage.heapTotal / 1024 / 1024) * 2;
  return memoryUsageMB < memoryLimitMB * 0.9;
}

function checkDiskSpace(): boolean {
  // TODO: Implement disk space check
  return true;
}

async function checkServices(): Promise<{ [key: string]: string }> {
  const services = {
    auth: 'healthy',
    chat: 'healthy',
    rag: 'healthy'
  };

  // TODO: Implement actual service health checks
  return services;
}




