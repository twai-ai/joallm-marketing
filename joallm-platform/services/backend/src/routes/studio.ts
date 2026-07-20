/**
 * Marketing Studio routes — Channels & Publishing Profiles (publish intent).
 * Platform Connectors live under /api/integrations/connectors.
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { authenticateToken } from '../middleware/auth.js';
import { z } from 'zod';
import {
  ensureDefaultWhatsAppPublishingProfile,
  ensureMetaWhatsAppChannelStack,
  listPublishingProfiles,
  listStudioChannels,
} from '../services/channel-service.js';
import {
  createPublishingJob,
  listCampaignPublishingJobs,
} from '../services/publishing-job-service.js';
import { config } from '../config/config.js';
import { ensureMetaSourceConnection } from '../services/acquisition-ingest-service.js';
import { logger } from '../utils/logger.js';

export async function studioRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  fastify.get('/channels', {
    preHandler: [authenticateToken],
    schema: {
      description: 'List Marketing Studio Channels (business destinations)',
      tags: ['studio'],
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const channels = await listStudioChannels(userId);
    return reply.send({ success: true, data: channels });
  });

  fastify.post('/channels/whatsapp', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Ensure WhatsApp Channel + Platform Connector + acquisition source',
      tags: ['studio'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const body = (request.body || {}) as {
        phoneNumberId?: string;
        displayPhoneNumber?: string;
      };

      const stack = await ensureMetaWhatsAppChannelStack({
        ownerUserId: userId,
        phoneNumberId: body.phoneNumberId || config.metaPhoneNumberId,
        displayPhoneNumber: body.displayPhoneNumber,
      });
      const profile = await ensureDefaultWhatsAppPublishingProfile({
        ownerUserId: userId,
        channelId: stack.channel.id,
      });
      const source = await ensureMetaSourceConnection({
        ownerUserId: userId,
        phoneNumberId: body.phoneNumberId || config.metaPhoneNumberId,
        displayPhoneNumber: body.displayPhoneNumber,
      });

      return reply.status(201).send({
        success: true,
        data: {
          connector: stack.connector,
          channel: stack.channel,
          publishingProfile: profile,
          acquisitionSource: source,
        },
      });
    } catch (error) {
      logger.error('Ensure WhatsApp channel failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ensure WhatsApp channel',
      });
    }
  });

  fastify.get('/publishing-profiles', {
    preHandler: [authenticateToken],
    schema: {
      description: 'List Publishing Profiles',
      tags: ['studio'],
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const profiles = await listPublishingProfiles(userId);
    return reply.send({ success: true, data: profiles });
  });

  const CreateJobSchema = z.object({
    programId: z.string().min(1),
    campaignId: z.string().uuid(),
    marketingAssetId: z.string().uuid(),
    channelKind: z.enum([
      'meta_ads',
      'facebook_organic',
      'instagram_organic',
      'linkedin_organic',
      'linkedin_ads',
      'youtube',
      'whatsapp',
      'email',
      'website',
      'x_organic',
      'other',
    ]),
    status: z.enum(['draft', 'queued']).optional(),
  });

  fastify.post('/publishing-jobs', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Create a Publishing Job from a Marketing Asset (draft/queued — no live send yet)',
      tags: ['studio'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const body = CreateJobSchema.parse(request.body || {});
      const job = await createPublishingJob({
        ownerUserId: userId,
        programId: body.programId,
        campaignId: body.campaignId,
        marketingAssetId: body.marketingAssetId,
        channelKind: body.channelKind,
        status: body.status || 'queued',
      });
      if (!job) {
        return reply.status(404).send({ success: false, error: 'Asset or campaign not found' });
      }
      return reply.status(201).send({ success: true, data: job });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Create studio publishing job failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create publishing job',
      });
    }
  });

  fastify.get('/publishing-jobs', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const query = request.query as { campaignId?: string };
    if (!query.campaignId) {
      return reply.status(400).send({ success: false, error: 'campaignId query required' });
    }
    const jobs = await listCampaignPublishingJobs(userId, query.campaignId);
    return reply.send({ success: true, data: jobs });
  });
}
