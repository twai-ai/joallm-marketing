import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
} from '../utils/error-handler';

describe('Error Classes', () => {
  it('should create AppError with correct properties', () => {
    const error = new AppError(500, 'Test error');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
  });

  it('should create ValidationError with 400 status', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    expect(error.message).toBe('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.errors).toEqual({ field: 'email' });
  });

  it('should create AuthenticationError with 401 status', () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Authentication required');
  });

  it('should create AuthorizationError with 403 status', () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
  });

  it('should create NotFoundError with resource name', () => {
    const error = new NotFoundError('User');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('User not found');
  });

  it('should create ConflictError with 409 status', () => {
    const error = new ConflictError('Resource already exists');
    expect(error.statusCode).toBe(409);
  });

  it('should create RateLimitError with 429 status', () => {
    const error = new RateLimitError();
    expect(error.statusCode).toBe(429);
  });

  it('should create ExternalServiceError with 502 status', () => {
    const error = new ExternalServiceError('OpenAI', 'API timeout');
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('OpenAI error: API timeout');
  });
});
