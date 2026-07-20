/**
 * Marketing Studio routes — Channels & Publishing Profiles (publish intent).
 * Platform Connectors live under /api/integrations/connectors.
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { authenticateToken } from '../middleware/auth.js';
import {
  ensureDefaultWhatsAppPublishingProfile,
  ensureMetaWhatsAppChannelStack,
  listPublishingProfiles,
  listStudioChannels,
} from '../services/channel-service.js';
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
}
