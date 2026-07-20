import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { authenticateApiKey, authenticateToken } from '../middleware/auth.js';
import { config } from '../config/config.js';
import {
  getAcquisitionOverview,
  getPersonTimeline,
  ingestMetaWhatsAppWebhook,
  listAcquisitionPeople,
  listRecentEvents,
  listSourceConnections,
  ensureMetaSourceConnection,
  maybeSendWhatsAppAutoReply,
} from '../services/acquisition-ingest-service.js';
import { acquisitionIngestQueue } from '../services/queue.js';
import { logger } from '../utils/logger.js';

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

  fastify.get('/events', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const query = request.query as { limit?: string };
    const limit = Math.min(Number(query.limit) || 50, 200);
    const events = await listRecentEvents(userId, limit);
    return reply.send({ success: true, data: events });
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
