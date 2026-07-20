import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';

/**
 * Rate limiting configuration per endpoint type
 */
export const RateLimits = {
  auth: {
    max: 5,
    timeWindow: 60 * 1000, // 1 minute
  },
  chat: {
    max: 20,
    timeWindow: 60 * 1000, // 1 minute
  },
  fileUpload: {
    max: 10,
    timeWindow: 60 * 60 * 1000, // 1 hour
  },
  ragSearch: {
    max: 30,
    timeWindow: 60 * 1000, // 1 minute
  },
  api: {
    max: 100,
    timeWindow: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Get rate limit configuration for endpoint
 */
export function getRateLimitConfig(endpointType: keyof typeof RateLimits) {
  return RateLimits[endpointType] || RateLimits.api;
}

/**
 * Custom rate limit error handler
 */
export async function rateLimitErrorHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  logger.warn('Rate limit exceeded', {
    ip: request.ip,
    url: request.url,
    method: request.method,
    userId: (request as any).user?.id,
  });

  return reply.status(429).send({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      retryAfter: 60, // seconds
    },
  });
}



