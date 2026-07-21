/**
 * Creative AI Platform routes — registry + image generation (Ideogram / FLUX).
 * Studio owns Generation Profiles (style/quality); Platform owns adapters.
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import {
  IMAGE_PROVIDER_REGISTRY,
  preferredProvidersForStyle,
  type ImageGenerationStyle,
} from '../services/creative-ai-registry.js';
import { generateCreativeImages } from '../services/creative-ai-generate-service.js';
import { logger } from '../utils/logger.js';

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

const QualitySchema = z.enum(['draft', 'standard', 'premium']);

const ProviderOverrideSchema = z.enum([
  'auto',
  'ideogram',
  'flux',
  'openai',
  'google_imagen',
  'stability',
  'adobe_firefly',
]);

const GenerateImageSchema = z.object({
  prompt: z.string().min(3).max(4000),
  style: StyleSchema.optional(),
  quality: QualitySchema.optional(),
  providerOverride: ProviderOverrideSchema.optional().nullable(),
  aspectRatio: z.string().max(20).optional().nullable(),
  titleHint: z.string().max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
  referenceFileIds: z.array(z.string().uuid()).max(4).optional(),
  referenceImages: z
    .array(
      z.object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(3).max(100),
        base64: z.string().min(32).max(12_000_000),
      }),
    )
    .max(4)
    .optional(),
  referenceMode: z.enum(['style', 'edit']).optional(),
  transparentBackground: z.boolean().optional(),
  variantCount: z.number().int().min(1).max(4).optional(),
});

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

  fastify.post('/generate-image', {
    preHandler: [authenticateToken],
    schema: {
      description:
        'Generate an image via Creative AI (Ideogram / FLUX). Returns a Platform file id — Studio attaches it as a Marketing Asset.',
      tags: ['creative-ai'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const body = GenerateImageSchema.parse(request.body || {});
      const result = await generateCreativeImages({
        ownerUserId: userId,
        prompt: body.prompt,
        style: body.style,
        quality: body.quality,
        providerOverride: body.providerOverride,
        aspectRatio: body.aspectRatio,
        titleHint: body.titleHint,
        metadata: body.metadata,
        referenceFileIds: body.referenceFileIds,
        referenceImages: body.referenceImages,
        referenceMode: body.referenceMode || 'style',
        transparentBackground: body.transparentBackground,
        variantCount: body.variantCount || 1,
      });

      const primary = result.files[0];
      return reply.status(201).send({
        success: true,
        data: {
          fileId: primary?.fileId,
          fileIds: result.files.map((f) => f.fileId),
          files: result.files,
          provider: result.provider,
          modelId: result.modelId,
          style: result.style,
          quality: result.quality,
          latencyMs: result.latencyMs,
          referenceFileIds: result.referenceFileIds,
          referenceMode: result.referenceMode,
          transparentBackground: result.transparentBackground,
          downloadUrl: primary ? `/api/files/${primary.fileId}/download` : undefined,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: error.errors[0]?.message || 'Invalid request',
        });
      }
      const message = error instanceof Error ? error.message : 'Image generation failed';
      logger.error('POST /api/creative/generate-image failed', { message });
      const status =
        /no creative ai key|not wired yet|prompt is required/i.test(message) ? 400 : 502;
      return reply.status(status).send({ success: false, error: message });
    }
  });
}
