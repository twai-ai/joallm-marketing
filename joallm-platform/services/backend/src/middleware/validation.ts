import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export class ValidationMiddleware {
  static create(options: ValidationOptions) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate request body
        if (options.body && request.body) {
          request.body = options.body.parse(request.body);
        }

        // Validate query parameters
        if (options.query && request.query) {
          request.query = options.query.parse(request.query);
        }

        // Validate route parameters
        if (options.params && request.params) {
          request.params = options.params.parse(request.params);
        }

        // Validate headers
        if (options.headers && request.headers) {
          request.headers = options.headers.parse(request.headers);
        }

      } catch (error) {
        if (error instanceof ZodError) {
          const validationErrors: ValidationError[] = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }));

          logger.warn('Validation failed:', {
            errors: validationErrors,
            path: request.url,
            method: request.method
          });

          reply.status(400).send({
            error: 'Validation failed',
            message: 'Invalid request data',
            details: validationErrors
          });
          return;
        }

        logger.error('Validation middleware error:', error);
        reply.status(500).send({
          error: 'Validation error',
          message: 'Internal server error'
        });
      }
    };
  }
}

// Common validation schemas
export const CommonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),
  
  // Email validation
  email: z.string().email('Invalid email format'),
  
  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  // Name validation
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s\-'.]+$/, 'Name can only contain letters, spaces, hyphens, apostrophes, and periods'),
  
  // File validation
  filename: z.string()
    .min(1, 'Filename is required')
    .max(255, 'Filename must be less than 255 characters')
    .regex(/^[^<>:"/\\|?*]+$/, 'Filename contains invalid characters'),
  
  // Content validation
  content: z.string()
    .min(1, 'Content is required')
    .max(100000, 'Content must be less than 100,000 characters'),
  
  // Query validation
  query: z.string()
    .min(1, 'Query is required')
    .max(1000, 'Query must be less than 1000 characters')
    .regex(/^[^<>]+$/, 'Query contains invalid characters'),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit must be less than 100').default(20)
  }),
  
  // File upload validation
  fileUpload: z.object({
    filename: z.string().min(1, 'Filename is required'),
    mimetype: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*$/, 'Invalid MIME type'),
    size: z.number().min(1, 'File size must be greater than 0').max(50 * 1024 * 1024, 'File size must be less than 50MB')
  }),
  
  // Model parameters validation
  modelParameters: z.object({
    temperature: z.number().min(0, 'Temperature must be at least 0').max(2, 'Temperature must be at most 2').default(0.7),
    maxTokens: z.number().min(1, 'Max tokens must be at least 1').max(4000, 'Max tokens must be at most 4000').default(1000),
    topP: z.number().min(0, 'Top P must be at least 0').max(1, 'Top P must be at most 1').default(1.0),
    frequencyPenalty: z.number().min(-2, 'Frequency penalty must be at least -2').max(2, 'Frequency penalty must be at most 2').default(0.0),
    presencePenalty: z.number().min(-2, 'Presence penalty must be at least -2').max(2, 'Presence penalty must be at most 2').default(0.0)
  }),
  
  // Search parameters validation
  searchParameters: z.object({
    query: z.string().min(1, 'Search query is required').max(1000, 'Search query must be less than 1000 characters'),
    limit: z.number().min(1, 'Limit must be at least 1').max(50, 'Limit must be at most 50').default(5),
    threshold: z.number().min(0, 'Threshold must be at least 0').max(1, 'Threshold must be at most 1').default(0.7),
    fileIds: z.array(z.string().uuid('Invalid file ID format')).optional()
  }),
  
  // Chat message validation
  chatMessage: z.object({
    content: z.string().min(1, 'Message content is required').max(10000, 'Message content must be less than 10,000 characters'),
    role: z.enum(['user', 'assistant', 'system'], { errorMap: () => ({ message: 'Role must be user, assistant, or system' }) }),
    attachments: z.array(z.object({
      type: z.enum(['image', 'file']),
      name: z.string().min(1, 'Attachment name is required'),
      url: z.string().url('Invalid attachment URL')
    })).optional()
  }),
  
  // RAG chat validation
  ragChatMessage: z.object({
    message: z.string().min(1, 'Message is required').max(5000, 'Message must be less than 5,000 characters'),
    documentIds: z.array(z.string().uuid('Invalid document ID format')).optional(),
    includeContext: z.boolean().default(true),
    maxTokens: z.number().min(100, 'Max tokens must be at least 100').max(4000, 'Max tokens must be at most 4000').default(1000),
    model: z.string().min(1, 'Model is required').max(100, 'Model name must be less than 100 characters')
  })
};

// Sanitization functions
export class SanitizationUtils {
  static sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }

  static sanitizeQuery(query: string): string {
    return query
      .trim()
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .substring(0, 1000);
  }

  static sanitizeContent(content: string): string {
    return content
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }
}

// Rate limiting validation
export class RateLimitValidation {
  private static readonly RATE_LIMITS = {
    'auth': { requests: 5, window: 15 * 60 * 1000 }, // 5 requests per 15 minutes
    'search': { requests: 100, window: 60 * 1000 }, // 100 requests per minute
    'upload': { requests: 10, window: 60 * 1000 }, // 10 uploads per minute
    'chat': { requests: 50, window: 60 * 1000 }, // 50 messages per minute
    'default': { requests: 1000, window: 60 * 1000 } // 1000 requests per minute
  };

  static getRateLimit(endpoint: string): { requests: number; window: number } {
    for (const [key, limit] of Object.entries(this.RATE_LIMITS)) {
      if (endpoint.includes(key)) {
        return limit;
      }
    }
    return this.RATE_LIMITS.default;
  }
}

// Input validation for specific endpoints
export const EndpointValidations = {
  // Auth endpoints
  register: ValidationMiddleware.create({
    body: z.object({
      email: CommonSchemas.email,
      password: CommonSchemas.password,
      name: CommonSchemas.name
    })
  }),

  login: ValidationMiddleware.create({
    body: z.object({
      email: CommonSchemas.email,
      password: z.string().min(1, 'Password is required')
    })
  }),

  changePassword: ValidationMiddleware.create({
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required').optional(),
      newPassword: CommonSchemas.password
    })
  }),

  // Chat endpoints
  sendMessage: ValidationMiddleware.create({
    body: z.object({
      content: CommonSchemas.content,
      sessionId: CommonSchemas.uuid.optional(),
      model: z.string().min(1, 'Model is required'),
      parameters: CommonSchemas.modelParameters.optional()
    })
  }),

  // RAG endpoints
  ragSearch: ValidationMiddleware.create({
    body: CommonSchemas.searchParameters
  }),

  ragChat: ValidationMiddleware.create({
    body: CommonSchemas.ragChatMessage
  }),

  // File endpoints
  uploadFile: ValidationMiddleware.create({
    body: z.object({
      filename: CommonSchemas.filename,
      mimetype: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*$/, 'Invalid MIME type'),
      size: z.number().min(1, 'File size must be greater than 0').max(50 * 1024 * 1024, 'File size must be less than 50MB')
    })
  }),

  // Model endpoints
  getModels: ValidationMiddleware.create({
    query: z.object({
      provider: z.string().optional(),
      available: z.coerce.boolean().optional(),
      featured: z.coerce.boolean().optional()
    }).merge(CommonSchemas.pagination)
  })
};

// API Key format validation by provider
export const ApiKeyValidation = {
  openai: (key: string): boolean => {
    // OpenAI keys start with sk- and are 51 characters, or sk-proj- for project keys
    return /^sk-[A-Za-z0-9]{48}$/.test(key) || /^sk-proj-[A-Za-z0-9_-]{48,}$/.test(key);
  },
  
  anthropic: (key: string): boolean => {
    // Anthropic keys start with sk-ant- and are typically longer
    return /^sk-ant-[A-Za-z0-9_-]{95,}$/.test(key);
  },
  
  groq: (key: string): boolean => {
    // Groq keys start with gsk_
    return /^gsk_[A-Za-z0-9]{52}$/.test(key);
  },
  
  cohere: (key: string): boolean => {
    // Cohere keys are typically 40 character alphanumeric
    return /^[A-Za-z0-9]{40}$/.test(key);
  },
  
  validateByProvider: (provider: string, key: string): boolean => {
    // Exclude validateByProvider itself from lookup to avoid type errors
    const validatorKey = provider as keyof Omit<typeof ApiKeyValidation, 'validateByProvider'>;
    const validator = ApiKeyValidation[validatorKey];
    if (typeof validator === 'function') {
      return (validator as (key: string) => boolean)(key);
    }
    // Fallback validation for unknown providers
    return /^[A-Za-z0-9_-]{20,}$/.test(key);
  }
};

// Security validation
export class SecurityValidation {
  static validateApiKey(apiKey: string): boolean {
    // Basic API key validation
    return Boolean(apiKey && 
           apiKey.length >= 32 && 
           apiKey.length <= 128 && 
           /^[a-zA-Z0-9\-_]+$/.test(apiKey));
  }

  static validateOrigin(origin: string, allowedOrigins: string[]): boolean {
    if (!origin) return false;
    
    return allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return origin === allowed;
    });
  }

  static validateFileType(filename: string, allowedTypes: string[]): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
  }

  static validateFileSize(size: number, maxSize: number): boolean {
    return size > 0 && size <= maxSize;
  }
}
