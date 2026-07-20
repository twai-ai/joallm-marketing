import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { modelsService } from '../services/models-service.js';
import { cacheService, CacheTTL } from '../services/cache.js';

const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()),
  maxTokens: z.number(),
  cost: z.string(),
  speed: z.enum(['fast', 'medium', 'slow']),
  quality: z.enum(['high', 'medium', 'low']),
  available: z.boolean()
});

const ModelParametersSchema = z.object({
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(100000).default(2048),
  topP: z.number().min(0).max(1).default(1.0),
  frequencyPenalty: z.number().min(-2).max(2).default(0.0),
  presencePenalty: z.number().min(-2).max(2).default(0.0)
});

export async function modelsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Get available models
  fastify.get('/', {
    schema: {
      description: 'Get all available LLM models',
      tags: ['models'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              provider: { type: 'string' },
              description: { type: 'string' },
              capabilities: { type: 'array', items: { type: 'string' } },
              maxTokens: { type: 'number' },
              cost: { type: 'string' },
              speed: { type: 'string', enum: ['fast', 'medium', 'slow'] },
              quality: { type: 'string', enum: ['high', 'medium', 'low'] },
              available: { type: 'boolean' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Get query parameters for filtering
      const query = request.query as any;
      const filters = {
        provider: query.provider,
        capability: query.capability,
        speed: query.speed,
        quality: query.quality,
        is_available: query.is_available !== undefined ? query.is_available === 'true' : undefined,
        is_featured: query.is_featured !== undefined ? query.is_featured === 'true' : undefined,
        search: query.search
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });

      // Build a stable cache key from active filters
      const filterStr = Object.keys(filters).length > 0
        ? `:${JSON.stringify(filters, Object.keys(filters).sort())}`
        : '';
      const cacheKey = `models:list${filterStr}`;

      const cachedModels = await cacheService.get<any[]>(cacheKey);
      if (cachedModels) {
        return reply.send(cachedModels);
      }

      const models = await modelsService.getAllModels(filters);

      // Transform database models to API format
      const apiModels = models.map(model => ({
        id: model.model_id,
        name: model.name,
        provider: model.provider,
        description: model.description,
        capabilities: model.capabilities,
        maxTokens: model.max_tokens,
        cost: model.cost,
        speed: model.speed,
        quality: model.quality,
        available: model.is_available
      }));

      const validatedModels = apiModels.map(model => ModelSchema.parse(model));

      // Cache for 30 minutes (fire-and-forget)
      cacheService.set(cacheKey, validatedModels, CacheTTL.modelsList).catch(() => {});

      reply.send(validatedModels);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to fetch models' });
    }
  });

  // Get model details
  fastify.get('/:modelId', {
    schema: {
      description: 'Get details for a specific model',
      tags: ['models'],
      params: {
        type: 'object',
        properties: {
          modelId: { type: 'string' }
        },
        required: ['modelId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            provider: { type: 'string' },
            description: { type: 'string' },
            capabilities: { type: 'array', items: { type: 'string' } },
            maxTokens: { type: 'number' },
            cost: { type: 'string' },
            speed: { type: 'string' },
            quality: { type: 'string' },
            available: { type: 'boolean' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { modelId } = request.params as { modelId: string };
      
      const model = await modelsService.getModelById(modelId);
      
      if (!model) {
        reply.status(404).send({ error: 'Model not found' });
        return;
      }

      // Transform database model to API format
      const apiModel = {
        id: model.model_id,
        name: model.name,
        provider: model.provider,
        description: model.description,
        capabilities: model.capabilities,
        maxTokens: model.max_tokens,
        cost: model.cost,
        speed: model.speed,
        quality: model.quality,
        available: model.is_available
      };

      reply.send(ModelSchema.parse(apiModel));
    } catch (error) {
      reply.status(500).send({ error: 'Failed to fetch model' });
    }
  });

  // Get default model parameters
  fastify.get('/:modelId/parameters', {
    schema: {
      description: 'Get default parameters for a specific model',
      tags: ['models'],
      params: {
        type: 'object',
        properties: {
          modelId: { type: 'string' }
        },
        required: ['modelId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            temperature: { type: 'number' },
            maxTokens: { type: 'number' },
            topP: { type: 'number' },
            frequencyPenalty: { type: 'number' },
            presencePenalty: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const defaultParams = {
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0
    };

    reply.send(ModelParametersSchema.parse(defaultParams));
  });

  // Get model statistics
  fastify.get('/stats', {
    schema: {
      description: 'Get model statistics',
      tags: ['models'],
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            byProvider: { type: 'object' },
            byCapability: { type: 'object' },
            available: { type: 'number' },
            featured: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await modelsService.getModelStats();
      reply.send(stats);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to fetch model statistics' });
    }
  });

  // Get available providers
  fastify.get('/providers', {
    schema: {
      description: 'Get available model providers',
      tags: ['models'],
      response: {
        200: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const providers = await modelsService.getProviders();
      reply.send(providers);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to fetch providers' });
    }
  });

  // Get available capabilities
  fastify.get('/capabilities', {
    schema: {
      description: 'Get available model capabilities',
      tags: ['models'],
      response: {
        200: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const capabilities = await modelsService.getCapabilities();
      reply.send(capabilities);
    } catch (error) {
      reply.status(500).send({ error: 'Failed to fetch capabilities' });
    }
  });
}


