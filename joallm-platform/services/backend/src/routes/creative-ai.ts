/**
 * Creative AI Platform routes — provider catalog + Auto style preferences.
 * Generation execution (adapters) lands in a later Creative-0/1 slice.
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import {
  IMAGE_PROVIDER_REGISTRY,
  preferredProvidersForStyle,
  type ImageGenerationStyle,
} from '../services/creative-ai-registry.js';

const StyleSchema = z.enum([
  'marketing_poster',
  'social_media',
  'product_mockup',
  'hero_banner',
  'illustration',
  'infographic',
  'logo',
  'photo_realistic',
  'other',
]);

export async function creativeAiRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  fastify.get('/image-providers/registry', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Catalog of Creative AI image providers (technical backends)',
      tags: ['creative-ai'],
    },
  }, async (_request, reply) => {
    return reply.send({ success: true, data: IMAGE_PROVIDER_REGISTRY });
  });

  fastify.get('/image-providers/auto-preferences', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Auto router preference order for a Generation Profile style',
      tags: ['creative-ai'],
    },
  }, async (request, reply) => {
    const query = request.query as { style?: string };
    const style = StyleSchema.parse(query.style || 'social_media') as ImageGenerationStyle;
    return reply.send({
      success: true,
      data: {
        style,
        preferredProviders: preferredProvidersForStyle(style),
      },
    });
  });

  fastify.get('/generation-styles', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Studio-facing Generation Profile styles (creative intent)',
      tags: ['creative-ai'],
    },
  }, async (_request, reply) => {
    const styles = StyleSchema.options.map((style) => ({
      style,
      preferredProviders: preferredProvidersForStyle(style as ImageGenerationStyle),
    }));
    return reply.send({ success: true, data: styles });
  });

  fastify.get('/providers/status', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Which Creative AI providers have BYOK or platform keys configured',
      tags: ['creative-ai'],
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { listConfiguredCreativeProviders } = await import('../services/creative-ai-keys.js');
    const data = await listConfiguredCreativeProviders(userId);
    return reply.send({ success: true, data });
  });
}
