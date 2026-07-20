import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from './logger.js';
import { config } from '../config/config.js';

// Custom error classes
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational: boolean = true,
    public errors?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, errors?: any) {
    super(400, message, true, errors);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(429, message);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(502, `${service} error: ${message}`);
    this.name = 'ExternalServiceError';
  }
}

// Error handler middleware
export async function errorHandler(
  error: Error | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error
  logger.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    ip: request.ip,
    userId: (request as any).user?.id,
  });

  // Handle custom AppError
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.name,
        message: error.message,
        ...(error.errors && { details: error.errors }),
      },
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'ValidationError',
        message: 'Invalid request data',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // Handle unknown errors
  const statusCode = 500;
  const message = config.nodeEnv === 'production' 
    ? 'Internal server error' 
    : error.message;

  return reply.status(statusCode).send({
    success: false,
    error: {
      code: 'InternalServerError',
      message,
      ...(config.nodeEnv !== 'production' && { stack: error.stack }),
    },
  });
}

// Async error wrapper
export function asyncHandler<T extends any[]>(
  fn: (...args: T) => Promise<any>
) {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorHandler(error as Error, args[0] as any, args[1] as any);
    }
  };
}

// Try-catch wrapper for service functions
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`${errorMessage}:`, error);
    throw error instanceof AppError ? error : new AppError(500, errorMessage);
  }
}
