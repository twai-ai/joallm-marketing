import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { authenticateApiKey, authenticateToken } from '../middleware/auth.js';
import { config } from '../config/config.js';
import {
  getAcquisitionOverview,
  ingestMetaWhatsAppWebhook,
  listAcquisitionPeople,
  listRecentEvents,
  listSourceConnections,
  ensureMetaSourceConnection,
  maybeSendWhatsAppAutoReply,
} from '../services/acquisition-ingest-service.js';
import { getPersonTimeline } from '../services/timeline-service.js';
import { linkMediaFileToPerson } from '../services/knowledge-artifact-service.js';
import { acquisitionIngestQueue } from '../services/queue.js';
import { logger } from '../utils/logger.js';
import {
  createProgramCampaign,
  deleteProgramCampaign,
  listProgramCampaigns,
  updateProgramCampaign,
} from '../services/acquisition-campaign-service.js';

const MetaIngestSchema = z.object({
  payload: z.record(z.unknown()),
  ownerUserId: z.string().uuid().optional(),
  headers: z.record(z.unknown()).optional(),
});

const EnsureSourceSchema = z.object({
  phoneNumberId: z.string().min(1).optional(),
  displayPhoneNumber: z.string().optional(),
  name: z.string().optional(),
});

async function enqueueOrIngestMetaWebhook(options: {
  payload: Record<string, unknown>;
  headers?: Record<string, unknown>;
  ownerUserId?: string;
}): Promise<{ mode: 'queued' | 'sync'; jobId?: string; result?: unknown }> {
  // Railway: Redis/BullMQ when available; sync fallback matches document pipeline
  if (acquisitionIngestQueue) {
    const job = await acquisitionIngestQueue.add('ingest-meta-webhook', {
      payload: options.payload,
      headers: options.headers,
      ownerUserId: options.ownerUserId,
    });
    return { mode: 'queued', jobId: job.id };
  }

  const result = await ingestMetaWhatsAppWebhook({
    payload: options.payload as any,
    headers: options.headers,
    ownerUserId: options.ownerUserId,
  });
  return { mode: 'sync', result };
}

/**
 * Studio + internal acquisition APIs.
 * Deployed on Railway backend service (Postgres + Redis).
 */
export async function acquisitionRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  // Optional forwarder path (local atrisi-meta-service). Production Meta → /api/meta/webhook.
  fastify.post('/webhooks/meta', {
    preHandler: [authenticateApiKey],
    schema: {
      description: 'Internal ingest of Meta WhatsApp payload (service-to-service)',
      tags: ['acquisition'],
    },
  }, async (request, reply) => {
    try {
      const body = MetaIngestSchema.parse(request.body);
      const result = await enqueueOrIngestMetaWebhook({
        payload: body.payload,
        headers: body.headers,
        ownerUserId: body.ownerUserId,
      });

      return reply.status(202).send({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Meta acquisition webhook ingest failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Ingest failed',
      });
    }
  });

  fastify.get('/overview', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const overview = await getAcquisitionOverview(userId);
    return reply.send({ success: true, data: overview });
  });

  fastify.get('/sources', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const sources = await listSourceConnections(userId);
    return reply.send({ success: true, data: sources });
  });

  fastify.post('/sources/meta', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const body = EnsureSourceSchema.parse(request.body || {});
    const source = await ensureMetaSourceConnection({
      ownerUserId: userId,
      phoneNumberId: body.phoneNumberId || config.metaPhoneNumberId,
      displayPhoneNumber: body.displayPhoneNumber,
    });
    return reply.status(201).send({ success: true, data: source });
  });

  fastify.get('/people', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const query = request.query as { limit?: string };
    const limit = Math.min(Number(query.limit) || 50, 200);
    const people = await listAcquisitionPeople(userId, limit);
    return reply.send({ success: true, data: people });
  });

  fastify.get('/people/:personId/timeline', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { personId } = request.params as { personId: string };
    const query = request.query as { limit?: string };
    const limit = Math.min(Number(query.limit) || 100, 500);
    const timeline = await getPersonTimeline(userId, personId, limit);
    if (!timeline) {
      return reply.status(404).send({ success: false, error: 'Person not found' });
    }
    return reply.send({ success: true, data: timeline });
  });

  fastify.post('/people/:personId/link-media', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Link a Media AI file to a Person Timeline (creates KnowledgeArtifact)',
      tags: ['acquisition'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { personId } = request.params as { personId: string };
      const body = z.object({ fileId: z.string().uuid() }).parse(request.body);
      const result = await linkMediaFileToPerson({
        ownerUserId: userId,
        personId,
        fileId: body.fileId,
      });
      return reply.status(201).send({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link media';
      const status = message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ success: false, error: message });
    }
  });

  fastify.get('/events', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const query = request.query as { limit?: string };
    const limit = Math.min(Number(query.limit) || 50, 200);
    const events = await listRecentEvents(userId, limit);
    return reply.send({ success: true, data: events });
  });

  // ── Program-scoped campaigns (Acquisition Platform Sprint 2) ──

  const CampaignStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'archived']);
  const GrowthIntentIdSchema = z.enum([
    'awareness',
    'registration',
    'builder-challenge',
    'cohort-conversion',
    'community',
    'events',
    'success-stories',
    'partnerships',
  ]);

  const CreateCampaignSchema = z.object({
    name: z.string().min(1).max(200),
    programName: z.string().min(1).max(200).optional(),
    intentId: GrowthIntentIdSchema.optional(),
    channel: z.string().max(100).optional(),
    status: CampaignStatusSchema.optional(),
    intentTemplate: z.string().max(100).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  const UpdateCampaignSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    intentId: GrowthIntentIdSchema.optional(),
    channel: z.string().max(100).nullable().optional(),
    status: CampaignStatusSchema.optional(),
    intentTemplate: z.string().max(100).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  fastify.get('/programs/:programId/campaigns', {
    preHandler: [authenticateToken],
    schema: {
      description: 'List acquisition campaigns for a Program (targeting id)',
      tags: ['acquisition'],
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { programId } = request.params as { programId: string };
    const campaigns = await listProgramCampaigns(userId, programId);
    return reply.send({ success: true, data: campaigns });
  });

  fastify.post('/programs/:programId/campaigns', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Create a campaign under a Program',
      tags: ['acquisition'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { programId } = request.params as { programId: string };
      const body = CreateCampaignSchema.parse(request.body || {});
      const campaign = await createProgramCampaign({
        ownerUserId: userId,
        programId,
        programName: body.programName || programId,
        name: body.name,
        intentId: body.intentId,
        channel: body.channel,
        status: body.status,
        intentTemplate: body.intentTemplate,
        metadata: body.metadata,
      });
      return reply.status(201).send({ success: true, data: campaign });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Create program campaign failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create campaign',
      });
    }
  });

  fastify.patch('/programs/:programId/campaigns/:campaignId', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { programId, campaignId } = request.params as { programId: string; campaignId: string };
      const body = UpdateCampaignSchema.parse(request.body || {});
      const campaign = await updateProgramCampaign({
        ownerUserId: userId,
        programId,
        campaignId,
        ...body,
      });
      if (!campaign) {
        return reply.status(404).send({ success: false, error: 'Campaign not found' });
      }
      return reply.send({ success: true, data: campaign });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Update program campaign failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update campaign',
      });
    }
  });

  fastify.delete('/programs/:programId/campaigns/:campaignId', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { campaignId } = request.params as { campaignId: string };
    const ok = await deleteProgramCampaign(userId, campaignId);
    if (!ok) {
      return reply.status(404).send({ success: false, error: 'Campaign not found' });
    }
    return reply.send({ success: true });
  });
}

/**
 * Native Meta webhook endpoints hosted on Railway backend.
 * Point Meta Developer Console callback URL to:
 *   https://<backend>.up.railway.app/api/meta/webhook
 */
export async function metaWebhookRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  fastify.get('/webhook', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    logger.info('Meta webhook verification request received');

    if (mode === 'subscribe' && token && token === config.metaVerifyToken) {
      logger.info('Meta webhook verified successfully');
      return reply.status(200).send(challenge);
    }

    logger.warn('Meta webhook verification failed');
    return reply.code(403).send();
  });

  fastify.post('/webhook', async (request, reply) => {
    try {
      const payload = request.body as Record<string, unknown>;

      logger.info('Meta webhook event received on Railway backend');

      const result = await enqueueOrIngestMetaWebhook({
        payload,
        headers: {
          'user-agent': request.headers['user-agent'],
          'x-hub-signature-256': request.headers['x-hub-signature-256'],
        },
        ownerUserId: config.acquisitionDefaultOwnerUserId,
      });

      if (config.metaEnableAutoReply) {
        void maybeSendWhatsAppAutoReply(payload as any).catch((error) => {
          logger.error('WhatsApp auto-reply failed', error);
        });
      }

      return reply.status(200).send({ success: true, mode: result.mode });
    } catch (error) {
      logger.error('Meta webhook handling failed', error);
      return reply.code(200).send();
    }
  });
}
