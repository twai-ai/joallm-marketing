/**
 * Comprehensive data validation utilities for JoaLLM platform
 */

import { z } from 'zod';
import { logger } from './logger.js';

// Base validation schemas
export const BaseEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  timestamp: z.string().datetime(),
  source: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  data: z.record(z.any())
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(['casual', 'admin', 'premium', 'superuser']),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  timestamp: z.date(),
  sessionId: z.string().uuid().optional()
});

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mimetype: z.string().min(1),
  size: z.number().positive(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const LLMModelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  provider: z.enum(['openai', 'anthropic', 'groq', 'cohere']),
  modelId: z.string().min(1),
  enabled: z.boolean(),
  maxTokens: z.number().positive(),
  contextWindow: z.number().positive()
});

// Event-specific validation schemas
export const UserEventSchema = BaseEventSchema.extend({
  type: z.enum(['user.created', 'user.updated', 'user.deleted', 'user.login', 'user.logout']),
  data: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    name: z.string().optional(),
    role: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })
});

export const ChatEventSchema = BaseEventSchema.extend({
  type: z.enum(['chat.session.created', 'chat.session.updated', 'chat.session.deleted', 'chat.message.sent', 'chat.message.received']),
  data: z.object({
    sessionId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    messageId: z.string().uuid().optional(),
    content: z.string().optional(),
    model: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })
});

export const FileEventSchema = BaseEventSchema.extend({
  type: z.enum(['file.uploaded', 'file.processed', 'file.deleted', 'file.failed']),
  data: z.object({
    fileId: z.string().uuid(),
    userId: z.string().uuid(),
    filename: z.string().min(1),
    size: z.number().positive(),
    status: z.string(),
    metadata: z.record(z.any()).optional()
  })
});

export const RAGEventSchema = BaseEventSchema.extend({
  type: z.enum(['rag.document.indexed', 'rag.document.deleted', 'rag.search.performed', 'rag.embedding.generated']),
  data: z.object({
    documentId: z.string().uuid().optional(),
    userId: z.string().uuid(),
    query: z.string().optional(),
    results: z.array(z.any()).optional(),
    metadata: z.record(z.any()).optional()
  })
});

export const SystemEventSchema = BaseEventSchema.extend({
  type: z.enum(['system.health.check', 'system.service.up', 'system.service.down', 'system.alert']),
  data: z.object({
    service: z.string().min(1),
    status: z.string().min(1),
    message: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })
});

// Validation result types
export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// Validation class
export class DataValidator {
  private static instance: DataValidator;
  private validationCache = new Map<string, any>();

  static getInstance(): DataValidator {
    if (!DataValidator.instance) {
      DataValidator.instance = new DataValidator();
    }
    return DataValidator.instance;
  }

  /**
   * Validate data against a Zod schema
   */
  validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
    try {
      const result = schema.safeParse(data);
      
      if (result.success) {
        return {
          success: true,
          data: result.data
        };
      } else {
        const errors: ValidationError[] = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          value: err.input
        }));

        return {
          success: false,
          errors
        };
      }
    } catch (error) {
      logger.error('Validation error:', error);
      return {
        success: false,
        errors: [{
          field: 'unknown',
          message: 'Validation failed due to internal error',
          code: 'INTERNAL_ERROR',
          value: data
        }]
      };
    }
  }

  /**
   * Validate user data
   */
  validateUser(data: unknown): ValidationResult {
    return this.validate(UserSchema, data);
  }

  /**
   * Validate chat message
   */
  validateChatMessage(data: unknown): ValidationResult {
    return this.validate(ChatMessageSchema, data);
  }

  /**
   * Validate document
   */
  validateDocument(data: unknown): ValidationResult {
    return this.validate(DocumentSchema, data);
  }

  /**
   * Validate LLM model
   */
  validateLLMModel(data: unknown): ValidationResult {
    return this.validate(LLMModelSchema, data);
  }

  /**
   * Validate event data
   */
  validateEvent(data: unknown): ValidationResult {
    // Try to determine event type and validate accordingly
    if (typeof data === 'object' && data !== null && 'type' in data) {
      const eventType = (data as any).type;
      
      switch (true) {
        case eventType.startsWith('user.'):
          return this.validate(UserEventSchema, data);
        case eventType.startsWith('chat.'):
          return this.validate(ChatEventSchema, data);
        case eventType.startsWith('file.'):
          return this.validate(FileEventSchema, data);
        case eventType.startsWith('rag.'):
          return this.validate(RAGEventSchema, data);
        case eventType.startsWith('system.'):
          return this.validate(SystemEventSchema, data);
        default:
          return this.validate(BaseEventSchema, data);
      }
    }
    
    return this.validate(BaseEventSchema, data);
  }

  /**
   * Sanitize string input
   */
  sanitizeString(input: string, maxLength: number = 255): string {
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>]/g, ''); // Basic XSS prevention
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate UUID format
   */
  validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate file size
   */
  validateFileSize(size: number, maxSize: number = 50 * 1024 * 1024): boolean {
    return size > 0 && size <= maxSize;
  }

  /**
   * Validate file type
   */
  validateFileType(filename: string, allowedTypes: string[]): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
  }

  /**
   * Batch validation
   */
  validateBatch<T>(schema: z.ZodSchema<T>, dataArray: unknown[]): ValidationResult<T[]> {
    const results: T[] = [];
    const errors: ValidationError[] = [];

    dataArray.forEach((data, index) => {
      const result = this.validate(schema, data);
      if (result.success && result.data) {
        results.push(result.data);
      } else if (result.errors) {
        errors.push(...result.errors.map(err => ({
          ...err,
          field: `[${index}].${err.field}`
        })));
      }
    });

    return {
      success: errors.length === 0,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    cacheSize: number;
    schemas: string[];
  } {
    return {
      cacheSize: this.validationCache.size,
      schemas: Array.from(this.validationCache.keys())
    };
  }
}

// Export singleton instance
export const validator = DataValidator.getInstance();

// Utility functions
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): ValidationResult<T> => {
    return validator.validate(schema, data);
  };
}

export function validateAndTransform<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validator.validate(schema, data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.errors?.map(e => e.message).join(', ')}`);
  }
  return result.data!;
}

// Export all schemas for external use
export {
  BaseEventSchema,
  UserSchema,
  ChatMessageSchema,
  DocumentSchema,
  LLMModelSchema,
  UserEventSchema,
  ChatEventSchema,
  FileEventSchema,
  RAGEventSchema,
  SystemEventSchema
};




