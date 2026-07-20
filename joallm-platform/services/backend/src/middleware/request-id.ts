import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    id: string;
  }
}

/**
 * Request ID middleware
 * Adds a unique correlation ID to each request for tracing
 */
export async function requestIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestId = request.headers['x-request-id'] as string || randomUUID();
  
  // Add to request object
  request.id = requestId;
  
  // Add to response headers
  reply.header('x-request-id', requestId);
}



