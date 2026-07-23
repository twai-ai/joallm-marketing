/**
 * Story Studio API — multi-medium narrative compose.
 * Free-floating sessions; attach + send-to-campaign come later.
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { generateCreativeImages } from '../services/creative-ai-generate-service.js';
import {
  addBeatsFromFiles,
  brandStoryBeat,
  createStory,
  deleteStory,
  exportStoryHtml,
  exportStoryImagesZip,
  exportStoryJson,
  exportStoryMarkdown,
  exportStoryPptx,
  generateSimilarStoryBeats,
  getStory,
  getStoryBrandKit,
  listStories,
  proposeStoryline,
  setStoryBrandKit,
  updateStory,
} from '../services/story-service.js';
import { getStoryAspectRatio, getStoryFormat } from '../services/story-format.js';
import { logger } from '../utils/logger.js';

const BeatSchema = z.object({
  id: z.string().min(1),
  fileId: z.string().uuid().nullable(),
  title: z.string().max(200),
  caption: z.string().max(1000),
  notes: z.string().max(2000),
  order: z.number().int().min(0),
  arcRole: z.enum(['context', 'proof', 'ask', 'other']).optional(),
  vision: z
    .object({
      fileId: z.string(),
      what: z.string(),
      onImageText: z.string().nullable(),
      signals: z.array(z.string()),
      mood: z.string(),
      confidence: z.number(),
      model: z.string(),
      analyzedAt: z.string(),
      promptVersion: z.string().optional(),
      audienceHint: z.string().nullable().optional(),
      claimHint: z.string().nullable().optional(),
      narrativeFit: z.enum(['context', 'proof', 'ask', 'other']).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const CreateSchema = z.object({
  title: z.string().max(200).optional(),
  tone: z.string().max(80).optional(),
  arc: z.string().max(80).optional(),
  format: z.enum(['deck', 'carousel', 'feed', 'story']).optional(),
});

const UpdateSchema = z.object({
  title: z.string().max(200).optional(),
  status: z.enum(['draft', 'ready', 'archived']).optional(),
  programId: z.string().max(120).nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  arc: z.string().max(80).optional(),
  tone: z.string().max(80).optional(),
  beats: z.array(BeatSchema).max(60).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const AddFilesSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(40),
});

const GenerateBeatSchema = z.object({
  prompt: z.string().min(3).max(4000),
  titleHint: z.string().max(120).optional(),
  aspectRatio: z.string().max(20).optional(),
  style: z
    .enum([
      'marketing_poster',
      'social_media',
      'product_mockup',
      'hero_banner',
      'illustration',
      'infographic',
      'logo',
      'photo_realistic',
      'other',
    ])
    .optional(),
});

function statusFromError(error: unknown): number {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode?: number }).statusCode;
    if (typeof code === 'number') return code;
  }
  return 500;
}

export async function storyRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  fastify.get('/', {
    preHandler: [authenticateToken],
    schema: {
      description: 'List Story sessions for the current tenant',
      tags: ['story'],
    },
  }, async (request, reply) => {
    const userId = (request as { user: { id: string } }).user.id;
    const data = await listStories(userId);
    return reply.send({ success: true, data });
  });

  fastify.post('/', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Create a free-floating Story session',
      tags: ['story'],
    },
  }, async (request, reply) => {
    const userId = (request as { user: { id: string } }).user.id;
    const body = CreateSchema.parse(request.body || {});
    const data = await createStory(userId, body);
    return reply.status(201).send({ success: true, data });
  });

  fastify.get('/:storyId', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get a Story session',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const data = await getStory(userId, storyId);
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load story',
      });
    }
  });

  fastify.patch('/:storyId', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Update Story title, beats, attach fields, or status',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const body = UpdateSchema.parse(request.body || {});
      const data = await updateStory(userId, storyId, body);
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update story',
      });
    }
  });

  fastify.delete('/:storyId', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Delete a Story session',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      await deleteStory(userId, storyId);
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete story',
      });
    }
  });

  fastify.post('/:storyId/beats/files', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Add Platform file ids as Story beats',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const body = AddFilesSchema.parse(request.body || {});
      const data = await addBeatsFromFiles(userId, storyId, body.fileIds);
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add files',
      });
    }
  });

  fastify.post('/:storyId/propose', {
    preHandler: [authenticateToken],
    schema: {
      description:
        'Propose ATRISI storyline via See (Groq vision) → Structure → Speak',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const body = z
        .object({
          refreshVision: z.boolean().optional(),
          keepOrder: z.boolean().optional(),
        })
        .parse(request.body || {});
      const result = await proposeStoryline(userId, storyId, body);
      return reply.send({
        success: true,
        data: result.story,
        source: result.source,
        visionCount: result.visionCount,
        reordered: result.reordered,
        thesis: result.thesis,
        warnings: result.warnings || [],
      });
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to propose storyline',
      });
    }
  });

  fastify.post('/:storyId/beats/generate', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Generate a gap-fill beat image via Platform Creative AI and append it',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const body = GenerateBeatSchema.parse(request.body || {});
      const story = await getStory(userId, storyId);
      const aspectRatio =
        body.aspectRatio ||
        getStoryAspectRatio(story.metadata as Record<string, unknown>);

      const generated = await generateCreativeImages({
        ownerUserId: userId,
        prompt: body.prompt,
        style: body.style || 'social_media',
        quality: 'standard',
        aspectRatio,
        titleHint: body.titleHint || 'Story beat',
        metadata: {
          source: 'story',
          storyId,
          format: getStoryFormat(story.metadata as Record<string, unknown>).id,
        },
        variantCount: 1,
      });

      const fileId = generated.files[0]?.fileId;
      if (!fileId) {
        return reply.status(502).send({ success: false, message: 'Creative AI returned no file' });
      }

      const data = await addBeatsFromFiles(userId, storyId, [fileId]);
      // Preserve prior beats; addBeatsFromFiles appends — retitle the new beat if hint given
      if (body.titleHint) {
        const beats = data.beats.map((beat, index) =>
          index === data.beats.length - 1
            ? { ...beat, title: body.titleHint!, caption: body.prompt.slice(0, 240) }
            : beat,
        );
        const updated = await updateStory(userId, storyId, { beats });
        return reply.status(201).send({
          success: true,
          data: updated,
          provider: generated.provider,
        });
      }

      void story;
      return reply.status(201).send({
        success: true,
        data,
        provider: generated.provider,
      });
    } catch (error) {
      logger.error('Story beat generate failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate beat',
      });
    }
  });

  fastify.put('/:storyId/brand-kit', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Set Story brand kit (logo + up to 3 style references) for Brand / Similar',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const body = z
        .object({
          logoFileId: z.string().uuid().nullable().optional(),
          styleFileIds: z.array(z.string().uuid()).max(3).optional(),
          watermark: z.boolean().optional(),
        })
        .parse(request.body || {});
      const data = await setStoryBrandKit(userId, storyId, {
        logoFileId: body.logoFileId ?? null,
        styleFileIds: body.styleFileIds || [],
        watermark: body.watermark,
      });
      return reply.send({
        success: true,
        data,
        brandKit: getStoryBrandKit(data.metadata),
      });
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save brand kit',
      });
    }
  });

  fastify.post('/:storyId/beats/:beatId/brand', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Brand this beat with ATRISI Creative AI (edit remix + brand theme)',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId, beatId } = request.params as { storyId: string; beatId: string };
      const body = z
        .object({
          textMode: z.enum(['none', 'title']).optional(),
        })
        .parse(request.body || {});
      const result = await brandStoryBeat(userId, storyId, beatId, {
        textMode: body.textMode,
      });
      return reply.status(201).send({
        success: true,
        data: result.story,
        provider: result.provider,
        fileId: result.fileId,
      });
    } catch (error) {
      logger.error('Story brand beat failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to brand beat',
      });
    }
  });

  fastify.post('/:storyId/beats/:beatId/similar', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Generate similar beat image(s) via Creative AI style reference',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId, beatId } = request.params as { storyId: string; beatId: string };
      const body = z
        .object({ count: z.number().int().min(1).max(3).optional() })
        .parse(request.body || {});
      const result = await generateSimilarStoryBeats(userId, storyId, beatId, body);
      return reply.status(201).send({
        success: true,
        data: result.story,
        provider: result.provider,
        addedBeatIds: result.addedBeatIds,
      });
    } catch (error) {
      logger.error('Story generate similar failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate similar',
      });
    }
  });

  fastify.get('/:storyId/export/pptx', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Export Story as PPTX deck (Context → Proof → Ask slides)',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const { buffer, filename } = await exportStoryPptx(userId, storyId);
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (error) {
      logger.error('Story PPTX export failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export PPTX',
      });
    }
  });

  fastify.get('/:storyId/export/markdown', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Export Story as markdown carousel brief',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const { buffer, filename, contentType } = await exportStoryMarkdown(userId, storyId);
      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export markdown',
      });
    }
  });

  fastify.get('/:storyId/export/json', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Export Story as structured JSON pack',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const { buffer, filename, contentType } = await exportStoryJson(userId, storyId);
      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export JSON',
      });
    }
  });

  fastify.get('/:storyId/export/html', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Export Story as self-contained HTML visual pack',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const { buffer, filename, contentType } = await exportStoryHtml(userId, storyId);
      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export HTML',
      });
    }
  });

  fastify.get('/:storyId/export/images', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Export Story beat images as a high-quality ZIP (Context → Proof → Ask)',
      tags: ['story'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as { user: { id: string } }).user.id;
      const { storyId } = request.params as { storyId: string };
      const { buffer, filename, contentType } = await exportStoryImagesZip(userId, storyId);
      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (error) {
      return reply.status(statusFromError(error)).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export images',
      });
    }
  });
}
