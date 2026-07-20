/**
 * Monitoring Middleware
 * 
 * Tracks request metrics for all API endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { metricsCollector } from '../monitoring/metrics.js';
import { logger } from '../utils/logger.js';
import { httpRequestDuration, httpRequestErrors, httpRequestTotal } from '../utils/prometheus-metrics.js';

/**
 * Store start time for request duration tracking
 */
interface RequestWithTiming extends FastifyRequest {
  startTime?: number;
}

function getRouteLabel(request: FastifyRequest): string {
  return request.routeOptions?.url || request.url.split('?')[0] || 'unknown';
}

/**
 * Health check endpoint metrics
 * Special handling for health check endpoints to avoid noise
 */
export function shouldSkipMonitoring(url: string): boolean {
  const skipPatterns = [
    '/health',
    '/api/health',
    '/ping',
    '/metrics', // Avoid recursive metrics tracking
  ];

  return skipPatterns.some(pattern => url.includes(pattern));
}

/**
 * Register monitoring middleware with Fastify instance
 */
export function registerMonitoring(fastify: any): void {
  // Add global onRequest hook to track start time
  fastify.addHook('onRequest', async (request: RequestWithTiming, reply: FastifyReply) => {
    // Skip monitoring for health checks and metrics endpoints
    if (shouldSkipMonitoring(request.url)) {
      return;
    }

    // Store start time for duration calculation
    request.startTime = Date.now();
  });

  // Add global onResponse hook to track metrics after response is sent
  fastify.addHook('onResponse', async (request: RequestWithTiming, reply: FastifyReply) => {
    // Skip monitoring for health checks
    if (shouldSkipMonitoring(request.url)) {
      return;
    }

    const duration = request.startTime ? Date.now() - request.startTime : 0;
    const userId = (request as any).user?.id;
    const route = getRouteLabel(request);
    const statusCode = String(reply.statusCode);

    // Track the request
    metricsCollector.trackRequest(
      request.url,
      request.method,
      reply.statusCode,
      duration,
      userId
    );

    httpRequestTotal.inc({
      method: request.method,
      route,
      status_code: statusCode,
    });

    httpRequestDuration.observe(
      {
        method: request.method,
        route,
        status_code: statusCode,
      },
      duration / 1000
    );
  });

  // Add global error hook to track errors
  fastify.addHook('onError', async (request: RequestWithTiming, reply: FastifyReply, error: Error) => {
    const userId = (request as any).user?.id;
    const route = getRouteLabel(request);

    metricsCollector.trackError(
      error,
      {
        method: request.method,
        url: request.url,
        headers: request.headers,
      },
      request.url,
      userId
    );

    httpRequestErrors.inc({
      method: request.method,
      route,
      error_type: error.name || 'Error',
    });
  });

  logger.info('✅ Monitoring middleware registered');
}
