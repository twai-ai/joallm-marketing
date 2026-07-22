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
  syncMetaMarketingInsights,
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
import {
  createCreativeProject,
  createMarketingAsset,
  deleteCreativeProject,
  deleteMarketingAsset,
  ensureDefaultCreativeProject,
  listCampaignAssets,
  listCreativeProjects,
  listProjectAssets,
  updateCreativeProject,
  updateMarketingAsset,
} from '../services/creative-project-service.js';
import {
  createPublishingJob,
  deletePublishingJob,
  executePublishingJob,
  listCampaignPublishingJobs,
  listProgramPublishingJobs,
  updatePublishingJobStatus,
} from '../services/publishing-job-service.js';
import {
  createProgramInterest,
  listProgramInterests,
  toPullItem,
} from '../services/program-interest-service.js';
import { generateCreativeImages } from '../services/creative-ai-generate-service.js';

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

  const objectType = options.payload?.object;
  if (objectType === 'page' || objectType === 'instagram') {
    const { ingestMetaPageWebhook } = await import('../services/acquisition-ingest-service.js');
    const result = await ingestMetaPageWebhook({
      payload: options.payload as any,
      headers: options.headers,
      ownerUserId: options.ownerUserId,
    });
    return { mode: 'sync', result };
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
      claimOwnership: true,
    });
    return reply.status(201).send({ success: true, data: source });
  });

  fastify.post('/marketing/sync-insights', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Pull Meta Marketing API account insights into Acquisition',
      tags: ['acquisition'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const body = (request.body || {}) as { datePreset?: string };
      const result = await syncMetaMarketingInsights({
        ownerUserId: userId,
        datePreset: body.datePreset,
      });
      if (!result.ok) {
        return reply.status(400).send({ success: false, error: result.error });
      }
      return reply.send({ success: true, data: result });
    } catch (error) {
      logger.error('Meta insights sync failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Insights sync failed',
      });
    }
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

  // ── Creative Projects + Assets (Sprint 3) ──

  const CreativeProjectStatusSchema = z.enum(['draft', 'active', 'archived']);
  const AssetKindSchema = z.enum([
    'image',
    'video',
    'poster',
    'linkedin_post',
    'instagram_caption',
    'whatsapp_broadcast',
    'email',
    'landing_hero',
    'brochure',
    'other',
  ]);
  const AssetStatusSchema = z.enum([
    'draft',
    'in_review',
    'approved',
    'scheduled',
    'published',
    'archived',
  ]);

  const CreateProjectSchema = z.object({
    name: z.string().min(1).max(200),
    status: CreativeProjectStatusSchema.optional(),
    templateKey: z.string().max(100).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  const UpdateProjectSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    status: CreativeProjectStatusSchema.optional(),
    templateKey: z.string().max(100).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  const CreateAssetSchema = z.object({
    title: z.string().min(1).max(200),
    kind: AssetKindSchema.optional(),
    status: AssetStatusSchema.optional(),
    body: z.string().max(20000).optional(),
    fileIds: z.array(z.string().uuid()).optional(),
    metadata: z.record(z.unknown()).optional(),
    /** When true, create under a default creative project if projectId omitted */
    useDefaultProject: z.boolean().optional(),
  });

  const UpdateAssetSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    kind: AssetKindSchema.optional(),
    status: AssetStatusSchema.optional(),
    body: z.string().max(20000).nullable().optional(),
    fileIds: z.array(z.string().uuid()).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  fastify.get('/programs/:programId/campaigns/:campaignId/creative-projects', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { programId, campaignId } = request.params as { programId: string; campaignId: string };
    const projects = await listCreativeProjects(userId, programId, campaignId);
    return reply.send({ success: true, data: projects });
  });

  fastify.post('/programs/:programId/campaigns/:campaignId/creative-projects', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { programId, campaignId } = request.params as { programId: string; campaignId: string };
      const body = CreateProjectSchema.parse(request.body || {});
      const project = await createCreativeProject({
        ownerUserId: userId,
        programId,
        campaignId,
        ...body,
      });
      if (!project) {
        return reply.status(404).send({ success: false, error: 'Campaign not found' });
      }
      return reply.status(201).send({ success: true, data: project });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Create creative project failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create creative project',
      });
    }
  });

  fastify.patch('/programs/:programId/campaigns/:campaignId/creative-projects/:projectId', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { programId, campaignId, projectId } = request.params as {
        programId: string;
        campaignId: string;
        projectId: string;
      };
      const body = UpdateProjectSchema.parse(request.body || {});
      const project = await updateCreativeProject({
        ownerUserId: userId,
        programId,
        campaignId,
        projectId,
        ...body,
      });
      if (!project) {
        return reply.status(404).send({ success: false, error: 'Creative project not found' });
      }
      return reply.send({ success: true, data: project });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Update creative project failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update creative project',
      });
    }
  });

  fastify.delete('/programs/:programId/campaigns/:campaignId/creative-projects/:projectId', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { campaignId, projectId } = request.params as { campaignId: string; projectId: string };
    const ok = await deleteCreativeProject(userId, campaignId, projectId);
    if (!ok) {
      return reply.status(404).send({ success: false, error: 'Creative project not found' });
    }
    return reply.send({ success: true });
  });

  fastify.get('/programs/:programId/campaigns/:campaignId/assets', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { programId, campaignId } = request.params as { programId: string; campaignId: string };
    const assets = await listCampaignAssets(userId, programId, campaignId);
    return reply.send({ success: true, data: assets });
  });

  fastify.get('/programs/:programId/campaigns/:campaignId/creative-projects/:projectId/assets', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { programId, campaignId, projectId } = request.params as {
      programId: string;
      campaignId: string;
      projectId: string;
    };
    const assets = await listProjectAssets(userId, programId, campaignId, projectId);
    return reply.send({ success: true, data: assets });
  });

  fastify.post('/programs/:programId/campaigns/:campaignId/assets', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { programId, campaignId } = request.params as { programId: string; campaignId: string };
      const body = CreateAssetSchema.extend({
        creativeProjectId: z.string().uuid().optional(),
      }).parse(request.body || {});

      let projectId = body.creativeProjectId;
      if (!projectId) {
        const project = await ensureDefaultCreativeProject({
          ownerUserId: userId,
          programId,
          campaignId,
        });
        if (!project) {
          return reply.status(404).send({ success: false, error: 'Campaign not found' });
        }
        projectId = project.id;
      }

      const asset = await createMarketingAsset({
        ownerUserId: userId,
        programId,
        campaignId,
        creativeProjectId: projectId,
        title: body.title,
        kind: body.kind,
        status: body.status,
        body: body.body,
        fileIds: body.fileIds,
        metadata: body.metadata,
      });
      if (!asset) {
        return reply.status(404).send({ success: false, error: 'Creative project not found' });
      }
      return reply.status(201).send({ success: true, data: asset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Create marketing asset failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create asset',
      });
    }
  });

  fastify.post('/programs/:programId/campaigns/:campaignId/creative-projects/:projectId/assets', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { programId, campaignId, projectId } = request.params as {
        programId: string;
        campaignId: string;
        projectId: string;
      };
      const body = CreateAssetSchema.parse(request.body || {});
      const asset = await createMarketingAsset({
        ownerUserId: userId,
        programId,
        campaignId,
        creativeProjectId: projectId,
        title: body.title,
        kind: body.kind,
        status: body.status,
        body: body.body,
        fileIds: body.fileIds,
        metadata: body.metadata,
      });
      if (!asset) {
        return reply.status(404).send({ success: false, error: 'Creative project not found' });
      }
      return reply.status(201).send({ success: true, data: asset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Create project asset failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create asset',
      });
    }
  });

  fastify.patch('/programs/:programId/campaigns/:campaignId/assets/:assetId', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { programId, campaignId, assetId } = request.params as {
        programId: string;
        campaignId: string;
        assetId: string;
      };
      const body = UpdateAssetSchema.parse(request.body || {});
      const asset = await updateMarketingAsset({
        ownerUserId: userId,
        programId,
        campaignId,
        assetId,
        ...body,
      });
      if (!asset) {
        return reply.status(404).send({ success: false, error: 'Asset not found' });
      }
      return reply.send({ success: true, data: asset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Update marketing asset failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update asset',
      });
    }
  });

  fastify.delete('/programs/:programId/campaigns/:campaignId/assets/:assetId', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { campaignId, assetId } = request.params as { campaignId: string; assetId: string };
    const ok = await deleteMarketingAsset(userId, campaignId, assetId);
    if (!ok) {
      return reply.status(404).send({ success: false, error: 'Asset not found' });
    }
    return reply.send({ success: true });
  });

  // ── Generate creative via Creative AI → Marketing Asset ──
  const GenerateAssetSchema = z.object({
    prompt: z.string().min(3).max(4000),
    title: z.string().min(1).max(200).optional(),
    kind: AssetKindSchema.optional(),
    body: z.string().max(20000).optional(),
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
    quality: z.enum(['draft', 'standard', 'premium']).optional(),
    providerOverride: z.enum(['auto', 'ideogram', 'flux']).optional().nullable(),
    aspectRatio: z.string().max(20).optional().nullable(),
    creativeProjectId: z.string().uuid().optional(),
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
    precision: z
      .object({
        headline: z.string().max(200).optional(),
        cta: z.string().max(120).optional(),
        mustIncludeText: z.string().max(800).optional(),
        avoid: z.string().max(800).optional(),
        institutionName: z.string().max(200).optional(),
        paletteType: z
          .enum(['auto', 'institutional_navy', 'teal_modern', 'forest', 'burgundy'])
          .optional(),
        primaryColor: z.string().max(20).optional(),
        secondaryColor: z.string().max(20).optional(),
        accentColor: z.string().max(20).optional(),
        useLogoReference: z.boolean().optional(),
        brandTheme: z
          .object({
            palette: z
              .object({
                primary: z.string().max(20).optional(),
                secondary: z.string().max(20).optional(),
                accent: z.string().max(20).optional(),
                background: z.string().max(20).optional(),
                text: z.string().max(20).optional(),
                colors: z.array(z.string().max(20)).max(5).optional(),
              })
              .optional(),
            theme: z
              .object({
                mood: z.string().max(300).optional(),
                typography: z.string().max(300).optional(),
                layout: z.string().max(300).optional(),
                imagery: z.string().max(300).optional(),
                density: z.string().max(120).optional(),
                notes: z.string().max(500).optional(),
              })
              .optional(),
          })
          .optional(),
      })
      .optional(),
    analyzeReferences: z.boolean().optional(),
  });

  fastify.post('/programs/:programId/campaigns/:campaignId/assets/generate', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { programId, campaignId } = request.params as { programId: string; campaignId: string };
      const body = GenerateAssetSchema.parse(request.body || {});

      let projectId = body.creativeProjectId;
      if (!projectId) {
        const project = await ensureDefaultCreativeProject({
          ownerUserId: userId,
          programId,
          campaignId,
        });
        if (!project) {
          return reply.status(404).send({ success: false, error: 'Campaign not found' });
        }
        projectId = project.id;
      }

      const style = body.style || 'marketing_poster';
      const title =
        body.title?.trim() ||
        `${style.replace(/_/g, ' ')} · ${new Date().toLocaleDateString()}`;

      const generated = await generateCreativeImages({
        ownerUserId: userId,
        prompt: body.prompt,
        style,
        quality: body.quality || 'standard',
        providerOverride: body.providerOverride ?? 'auto',
        aspectRatio: body.aspectRatio,
        titleHint: title,
        precision: body.precision,
        analyzeReferences: body.analyzeReferences,
        referenceFileIds: body.referenceFileIds,
        referenceImages: body.referenceImages,
        referenceMode: body.referenceMode || 'style',
        transparentBackground: body.transparentBackground,
        variantCount: body.variantCount || 1,
        metadata: {
          programId,
          campaignId,
          creativeProjectId: projectId,
          studio: 'acquisition',
        },
      });

      const kind =
        body.kind ||
        (body.transparentBackground
          ? 'image'
          : style === 'marketing_poster' || style === 'infographic'
            ? 'poster'
            : style === 'hero_banner'
              ? 'landing_hero'
              : 'image');

      const assets = [];
      for (let i = 0; i < generated.files.length; i += 1) {
        const file = generated.files[i];
        const assetTitle =
          generated.files.length > 1 ? `${title} · v${i + 1}` : title;
        const asset = await createMarketingAsset({
          ownerUserId: userId,
          programId,
          campaignId,
          creativeProjectId: projectId,
          title: assetTitle,
          kind,
          status: 'draft',
          body: body.body,
          fileIds: [file.fileId],
          metadata: {
            generatedBy: 'creative_ai',
            provider: file.provider,
            modelId: file.modelId,
            style: file.style,
            quality: file.quality,
            prompt: file.prompt,
            latencyMs: generated.latencyMs,
            referenceFileIds: file.referenceFileIds,
            referenceMode: file.referenceMode,
            transparentBackground: file.transparentBackground,
            variantIndex: i + 1,
            variantCount: generated.files.length,
          },
        });
        if (asset) assets.push(asset);
      }

      if (assets.length === 0) {
        return reply.status(404).send({ success: false, error: 'Creative project not found' });
      }

      return reply.status(201).send({
        success: true,
        data: {
          asset: assets[0],
          assets,
          fileId: generated.files[0]?.fileId,
          provider: generated.provider,
          modelId: generated.modelId,
          downloadUrl: generated.files[0]
            ? `/api/files/${generated.files[0].fileId}/download`
            : undefined,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: error.errors[0]?.message || 'Invalid request',
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to generate asset';
      logger.error('Generate marketing asset failed', { message });
      const status =
        /no creative ai key|not wired yet|prompt is required|campaign not found/i.test(message)
          ? 400
          : 502;
      return reply.status(status).send({ success: false, error: message });
    }
  });

  // ── Publishing Jobs (Sprint 4) — draft/queue only; outbound is Sprint 5 ──

  const ChannelKindSchema = z.enum([
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
  ]);

  const PublishAssetSchema = z.object({
    channelKind: ChannelKindSchema,
    status: z.enum(['draft', 'queued']).optional(),
    recipientPhone: z.string().min(8).max(32).optional(),
    messageBody: z.string().max(4000).optional(),
    executeNow: z.boolean().optional(),
  });

  fastify.post('/programs/:programId/campaigns/:campaignId/assets/:assetId/publish', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { programId, campaignId, assetId } = request.params as {
        programId: string;
        campaignId: string;
        assetId: string;
      };
      const body = PublishAssetSchema.parse(request.body || {});
      const job = await createPublishingJob({
        ownerUserId: userId,
        programId,
        campaignId,
        marketingAssetId: assetId,
        channelKind: body.channelKind,
        status: body.status || 'queued',
        recipientPhone: body.recipientPhone,
        messageBody: body.messageBody,
        executeNow: body.executeNow,
      });
      if (!job) {
        return reply.status(404).send({ success: false, error: 'Asset or campaign not found' });
      }
      return reply.status(201).send({ success: true, data: job });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Create publishing job failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create publishing job',
      });
    }
  });

  fastify.post('/programs/:programId/publishing-jobs/:jobId/execute', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { jobId } = request.params as { jobId: string };
      const job = await executePublishingJob({ ownerUserId: userId, jobId });
      if (!job) {
        return reply.status(404).send({ success: false, error: 'Publishing job not found' });
      }
      return reply.send({ success: true, data: job });
    } catch (error) {
      logger.error('Execute publishing job failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute publishing job',
      });
    }
  });

  fastify.get('/programs/:programId/campaigns/:campaignId/publishing-jobs', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { campaignId } = request.params as { campaignId: string };
    const jobs = await listCampaignPublishingJobs(userId, campaignId);
    return reply.send({ success: true, data: jobs });
  });

  fastify.get('/programs/:programId/publishing-jobs', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { programId } = request.params as { programId: string };
    const jobs = await listProgramPublishingJobs(userId, programId);
    return reply.send({ success: true, data: jobs });
  });

  fastify.patch('/programs/:programId/publishing-jobs/:jobId', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const { jobId } = request.params as { jobId: string };
      const body = z
        .object({
          status: z.enum([
            'draft',
            'queued',
            'scheduled',
            'publishing',
            'published',
            'failed',
            'cancelled',
          ]),
          errorMessage: z.string().nullable().optional(),
        })
        .parse(request.body || {});
      const job = await updatePublishingJobStatus({
        ownerUserId: userId,
        jobId,
        status: body.status,
        errorMessage: body.errorMessage,
      });
      if (!job) {
        return reply.status(404).send({ success: false, error: 'Publishing job not found' });
      }
      return reply.send({ success: true, data: job });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Update publishing job failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update publishing job',
      });
    }
  });

  fastify.delete('/programs/:programId/publishing-jobs/:jobId', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { jobId } = request.params as { jobId: string };
    const ok = await deletePublishingJob(userId, jobId);
    if (!ok) {
      return reply.status(404).send({ success: false, error: 'Publishing job not found' });
    }
    return reply.send({ success: true });
  });

  // ── Program Interest (Sprint 6–7) — Education pull ──

  const CreateInterestSchema = z.object({
    personId: z.string().uuid(),
    programId: z.string().min(1).max(200),
    programName: z.string().max(200).optional(),
    confidence: z.number().min(0).max(1).optional(),
    source: z.string().min(1).max(100),
    campaignId: z.string().uuid().optional(),
    campaignName: z.string().max(200).optional(),
    intent: z.string().max(100).optional(),
    evidence: z
      .array(
        z.object({
          kind: z.string(),
          summary: z.string().optional(),
          occurredAt: z.string().optional(),
          channel: z.string().optional(),
          refId: z.string().optional(),
          attributes: z.record(z.unknown()).optional(),
        }),
      )
      .optional(),
    occurredAt: z.string().datetime().optional(),
  });

  fastify.get('/programs/:programId/interests', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const { programId } = request.params as { programId: string };
    const query = request.query as { since?: string; limit?: string };
    const since = query.since ? new Date(query.since) : undefined;
    const interests = await listProgramInterests({
      ownerUserId: userId,
      programId,
      since,
      limit: Number(query.limit) || 100,
    });
    return reply.send({ success: true, data: interests.map(toPullItem) });
  });

  /** Education / integration pull — token or API key */
  fastify.get('/program-interests', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const query = request.query as { programId?: string; since?: string; limit?: string };
    const interests = await listProgramInterests({
      ownerUserId: userId,
      programId: query.programId,
      since: query.since ? new Date(query.since) : undefined,
      limit: Number(query.limit) || 100,
    });
    return reply.send({ success: true, data: interests.map(toPullItem) });
  });

  fastify.get('/program-interests/pull', {
    preHandler: [authenticateApiKey],
    schema: {
      description: 'Education pull — Program Interest only (API key auth)',
      tags: ['acquisition'],
    },
  }, async (request, reply) => {
    const userId =
      ((request as any).user?.id as string | undefined) ||
      config.acquisitionDefaultOwnerUserId;
    if (!userId) {
      return reply.status(503).send({ success: false, error: 'No acquisition owner configured' });
    }
    const query = request.query as { programId?: string; since?: string; limit?: string };
    const interests = await listProgramInterests({
      ownerUserId: userId,
      programId: query.programId,
      since: query.since ? new Date(query.since) : undefined,
      limit: Number(query.limit) || 100,
    });
    return reply.send({ success: true, data: interests.map(toPullItem) });
  });

  fastify.post('/program-interests', {
    preHandler: [authenticateToken],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id as string;
      const body = CreateInterestSchema.parse(request.body || {});
      const interest = await createProgramInterest({
        ownerUserId: userId,
        personId: body.personId,
        programId: body.programId,
        programName: body.programName,
        confidence: body.confidence,
        source: body.source,
        campaignId: body.campaignId,
        campaignName: body.campaignName,
        intent: body.intent,
        evidence: body.evidence,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      });
      return reply.status(201).send({ success: true, data: toPullItem(interest) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: error.errors[0]?.message || 'Invalid request' });
      }
      logger.error('Create program interest failed', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create program interest',
      });
    }
  });
}

/**
 * Native Meta webhook endpoints hosted on Railway backend.
 * WhatsApp Cloud API:
 *   https://<backend>.up.railway.app/api/meta/webhook
 * Facebook Page + Instagram messaging + Lead Ads (leadgen):
 *   https://<backend>.up.railway.app/api/meta/page/webhook
 */
export async function metaWebhookRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  const verifyHandler = async (request: any, reply: any) => {
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
  };

  fastify.get('/webhook', verifyHandler);
  fastify.get('/page/webhook', verifyHandler);

  fastify.post('/webhook', async (request, reply) => {
    try {
      const payload = request.body as Record<string, unknown>;

      logger.info('Meta WhatsApp webhook event received on Railway backend');

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

  fastify.post('/page/webhook', async (request, reply) => {
    try {
      const payload = request.body as Record<string, unknown>;

      logger.info('Meta Page/Instagram webhook event received on Railway backend');

      const result = await enqueueOrIngestMetaWebhook({
        payload,
        headers: {
          'user-agent': request.headers['user-agent'],
          'x-hub-signature-256': request.headers['x-hub-signature-256'],
        },
        ownerUserId: config.acquisitionDefaultOwnerUserId,
      });

      return reply.status(200).send({ success: true, mode: result.mode });
    } catch (error) {
      logger.error('Meta Page webhook handling failed', error);
      return reply.code(200).send();
    }
  });
}
