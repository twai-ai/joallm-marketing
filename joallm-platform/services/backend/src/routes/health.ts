import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { checkDatabaseHealth } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { getMetrics, getHealthCheck } from '../utils/monitoring.js';
import { config } from '../config/config.js';

const HealthResponseSchema = z.object({
  status: z.literal('healthy'),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
  environment: z.string(),
  services: z.object({
    database: z.boolean(),
    redis: z.boolean(),
    openai: z.boolean(),
    anthropic: z.boolean()
  })
});

export async function healthRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Health check endpoint
  fastify.get('/', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
            environment: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'boolean' },
                redis: { type: 'boolean' },
                openai: { type: 'boolean' },
                anthropic: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();
    
    // Check service health
    const services = {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      openai: await checkOpenAIHealth(),
      anthropic: await checkAnthropicHealth()
    };

    const response = {
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services
    };

    // Validate response
    const validatedResponse = HealthResponseSchema.parse(response);
    
    reply.status(200).send(validatedResponse);
  });

  // Configuration status endpoint
  fastify.get('/config-status', {
    schema: {
      description: 'Get current configuration status',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            mockMode: { type: 'boolean' },
            providers: {
              type: 'object',
              properties: {
                openai: {
                  type: 'object',
                  properties: {
                    configured: { type: 'boolean' },
                    isDefault: { type: 'boolean' }
                  }
                },
                groq: {
                  type: 'object',
                  properties: {
                    configured: { type: 'boolean' },
                    isDefault: { type: 'boolean' }
                  }
                },
                anthropic: {
                  type: 'object',
                  properties: {
                    configured: { type: 'boolean' },
                    isDefault: { type: 'boolean' }
                  }
                },
                cohere: {
                  type: 'object',
                  properties: {
                    configured: { type: 'boolean' },
                    isDefault: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const isPlaceholder = (key: string) => {
      return key.includes('PLACEHOLDER') || 
             key.includes('dev-key-not-set') ||
             key.includes('your-') || 
             key.includes('sk-your-') ||
             key.includes('gsk-your-') ||
             key.includes('sk-ant-your-') ||
             key.includes('cohere-your-') ||
             key.includes('ollama-your-');
    };
    
    return {
      mockMode: isPlaceholder(config.openaiApiKey) && 
                isPlaceholder(config.anthropicApiKey) &&
                isPlaceholder(config.groqApiKey) &&
                isPlaceholder(config.ollamaApiKey),
      providers: {
        openai: { 
          configured: !isPlaceholder(config.openaiApiKey),
          isDefault: isPlaceholder(config.openaiApiKey)
        },
        groq: { 
          configured: !isPlaceholder(config.groqApiKey),
          isDefault: isPlaceholder(config.groqApiKey)
        },
        anthropic: { 
          configured: !isPlaceholder(config.anthropicApiKey),
          isDefault: isPlaceholder(config.anthropicApiKey)
        },
        cohere: { 
          configured: !isPlaceholder(config.cohereApiKey),
          isDefault: isPlaceholder(config.cohereApiKey)
        }
      }
    };
  });

  // Readiness check (for containerized deployments)
  fastify.get('/ready', {
    schema: {
      description: 'Readiness check endpoint',
      tags: ['health']
    }
  }, async (request, reply) => {
    // TODO: Add actual readiness checks (DB connection, Redis connection, etc.)
    reply.status(200).send({ ready: true });
  });

  // Liveness check (for containerized deployments)
  fastify.get('/live', {
    schema: {
      description: 'Liveness check endpoint',
      tags: ['health']
    }
  }, async (request, reply) => {
    reply.status(200).send({ alive: true });
  });

  // Metrics endpoint
  fastify.get('/metrics', {
    schema: {
      description: 'Get application metrics',
      tags: ['health']
    }
  }, async (request, reply) => {
    const metrics = getMetrics();
    reply.status(200).send(metrics);
  });

  // Health check with monitoring
  fastify.get('/health', {
    schema: {
      description: 'Comprehensive health check with monitoring',
      tags: ['health']
    }
  }, async (request, reply) => {
    const health = getHealthCheck();
    const metrics = getMetrics();
    
    reply.status(200).send({
      ...health,
      metrics: {
        requests: metrics.requests,
        errors: metrics.errors,
        errorRate: metrics.errorRate,
        avgResponseTime: metrics.avgResponseTime,
      }
    });
  });
}

// Health check functions
async function checkRedisHealth(): Promise<boolean> {
  try {
    // TODO: Implement actual Redis health check
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
}

async function checkOpenAIHealth(): Promise<boolean> {
  try {
    // TODO: Implement actual OpenAI health check
    return true;
  } catch (error) {
    logger.error('OpenAI health check failed:', error);
    return false;
  }
}

async function checkAnthropicHealth(): Promise<boolean> {
  try {
    // TODO: Implement actual Anthropic health check
    return true;
  } catch (error) {
    logger.error('Anthropic health check failed:', error);
    return false;
  }
}
