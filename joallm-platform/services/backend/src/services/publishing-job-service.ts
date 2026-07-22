/**
 * Publishing Jobs (Sprint 4–5) — queue + execute outbound via Connectors.
 * WhatsApp + Meta Ads (draft/PAUSED) + Facebook Page photo are live; others simulate.
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../database/connection.js';
import {
  acquisitionCampaigns,
  marketingAssets,
  publishingJobs,
  studioChannels,
} from '../database/schema.js';
import {
  ensureStudioChannelByKind,
  type ChannelKind,
} from './channel-service.js';

export type PublishingJobStatus =
  | 'draft'
  | 'queued'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export type PublishingJobDto = {
  id: string;
  campaignId: string | null;
  marketingAssetId: string;
  channelId: string;
  channelKind?: string;
  channelName?: string;
  status: PublishingJobStatus;
  payload: Record<string, unknown>;
  errorMessage: string | null;
  externalPostId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapJob(
  row: typeof publishingJobs.$inferSelect,
  channel?: typeof studioChannels.$inferSelect | null,
): PublishingJobDto {
  return {
    id: row.id,
    campaignId: row.campaignId ?? null,
    marketingAssetId: row.marketingAssetId,
    channelId: row.channelId,
    channelKind: channel?.kind,
    channelName: channel?.name,
    status: row.status as PublishingJobStatus,
    payload: (row.payload as Record<string, unknown>) || {},
    errorMessage: row.errorMessage ?? null,
    externalPostId: row.externalPostId ?? null,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createPublishingJob(options: {
  ownerUserId: string;
  programId: string;
  campaignId: string;
  marketingAssetId: string;
  channelKind: ChannelKind;
  status?: 'draft' | 'queued';
  /** WhatsApp recipient E.164 / digits */
  recipientPhone?: string;
  /** Caption / message body override */
  messageBody?: string;
  /** When true (default for queued), run connector execute immediately */
  executeNow?: boolean;
}): Promise<PublishingJobDto | null> {
  const [asset] = await db
    .select()
    .from(marketingAssets)
    .where(
      and(
        eq(marketingAssets.id, options.marketingAssetId),
        eq(marketingAssets.campaignId, options.campaignId),
        eq(marketingAssets.ownerUserId, options.ownerUserId),
      ),
    )
    .limit(1);

  if (!asset) return null;

  const [campaign] = await db
    .select()
    .from(acquisitionCampaigns)
    .where(
      and(
        eq(acquisitionCampaigns.id, options.campaignId),
        eq(acquisitionCampaigns.ownerUserId, options.ownerUserId),
      ),
    )
    .limit(1);

  if (!campaign) return null;

  const channel = await ensureStudioChannelByKind({
    ownerUserId: options.ownerUserId,
    kind: options.channelKind,
  });

  const intentId =
    typeof (campaign.metadata as Record<string, unknown>)?.intentId === 'string'
      ? ((campaign.metadata as Record<string, unknown>).intentId as string)
      : undefined;

  const status = options.status || 'queued';
  const payload: Record<string, unknown> = {
    programId: options.programId,
    campaignId: options.campaignId,
    campaignName: campaign.name,
    intentId,
    assetId: asset.id,
    assetTitle: asset.title,
    assetKind: asset.kind,
    fileIds: asset.fileIds || [],
    body: options.messageBody || asset.body || `ATRISI: ${asset.title}`,
    channelKind: options.channelKind,
    note: status === 'draft' ? 'Draft — not executed' : 'Queued for connector execution',
  };
  if (options.recipientPhone) {
    payload.to = options.recipientPhone.replace(/\D/g, '');
    payload.recipientPhone = payload.to;
  }

  const [row] = await db
    .insert(publishingJobs)
    .values({
      ownerUserId: options.ownerUserId,
      campaignId: options.campaignId,
      initiativeId: campaign.initiativeId,
      marketingAssetId: asset.id,
      channelId: channel.id,
      connectorId: channel.connectorId ?? null,
      status,
      payload,
    })
    .returning();

  const shouldExecute = options.executeNow !== false && status === 'queued';
  if (shouldExecute) {
    return executePublishingJob({
      ownerUserId: options.ownerUserId,
      jobId: row.id,
    });
  }

  const [channelRow] = await db
    .select()
    .from(studioChannels)
    .where(eq(studioChannels.id, channel.id))
    .limit(1);

  return mapJob(row, channelRow || null);
}

/**
 * Sprint 5 — execute a queued job via WhatsApp Graph or simulate other channels.
 */
export async function executePublishingJob(options: {
  ownerUserId: string;
  jobId: string;
}): Promise<PublishingJobDto | null> {
  const [job] = await db
    .select()
    .from(publishingJobs)
    .where(
      and(
        eq(publishingJobs.id, options.jobId),
        eq(publishingJobs.ownerUserId, options.ownerUserId),
      ),
    )
    .limit(1);

  if (!job) return null;
  if (job.status === 'published' || job.status === 'cancelled') {
    const [channel] = await db
      .select()
      .from(studioChannels)
      .where(eq(studioChannels.id, job.channelId))
      .limit(1);
    return mapJob(job, channel || null);
  }

  await db
    .update(publishingJobs)
    .set({ status: 'publishing', updatedAt: new Date() })
    .where(eq(publishingJobs.id, job.id));

  const [channel] = await db
    .select()
    .from(studioChannels)
    .where(eq(studioChannels.id, job.channelId))
    .limit(1);

  const payload = { ...((job.payload || {}) as Record<string, unknown>) };
  const channelKind = channel?.kind || (payload.channelKind as string) || 'other';

  let externalPostId: string | null = null;
  let errorMessage: string | null = null;
  let executeMode = 'simulate';

  if (channelKind === 'whatsapp') {
    const to =
      typeof payload.to === 'string'
        ? payload.to
        : typeof payload.recipientPhone === 'string'
          ? payload.recipientPhone
          : null;
    const body =
      typeof payload.body === 'string' && payload.body.trim()
        ? payload.body
        : typeof payload.assetTitle === 'string'
          ? `ATRISI update: ${payload.assetTitle}`
          : 'Update from ATRISI';

    if (to) {
      const { sendWhatsAppText } = await import('./whatsapp-send-service.js');
      const result = await sendWhatsAppText({ to, body });
      if (result.ok) {
        externalPostId = result.messageId || `wa:${Date.now()}`;
        executeMode = 'whatsapp_live';
        payload.graphResponse = result.response || {};
      } else {
        // Fall back to audit publish so the loop still completes in dogfood
        externalPostId = `wa-audit:${job.id}`;
        executeMode = 'whatsapp_audit';
        errorMessage = result.error || 'WhatsApp send failed — recorded as audit publish';
        payload.sendError = result.error;
      }
    } else {
      externalPostId = `wa-stub:${job.id}`;
      executeMode = 'whatsapp_stub';
      payload.note = 'No recipient phone — stub published for dogfood. Add recipientPhone to send live.';
    }
  } else if (channelKind === 'meta_ads') {
    const message =
      typeof payload.body === 'string' && payload.body.trim()
        ? payload.body
        : typeof payload.assetTitle === 'string'
          ? String(payload.assetTitle)
          : 'ATRISI creative';
    const name =
      typeof payload.assetTitle === 'string' ? payload.assetTitle : `Job ${job.id.slice(0, 8)}`;
    const fileIds = Array.isArray(payload.fileIds)
      ? payload.fileIds.filter((id): id is string => typeof id === 'string')
      : [];

    let imageHash: string | null = null;
    if (fileIds.length > 0) {
      const { files } = await import('../database/schema.js');
      const { eq } = await import('drizzle-orm');
      const { storageProvider } = await import('./file-storage.js');
      const [fileRow] = await db
        .select()
        .from(files)
        .where(eq(files.id, fileIds[0]))
        .limit(1);
      if (fileRow?.storageKey && fileRow.mimetype?.startsWith('image/')) {
        const buffer = await storageProvider.downloadFile(fileRow.storageKey);
        const { uploadMetaAdImage } = await import('./meta-graph-service.js');
        const uploaded = await uploadMetaAdImage({
          buffer,
          filename: fileRow.originalName || fileRow.filename || 'creative.jpg',
          contentType: fileRow.mimetype,
        });
        if (uploaded.ok) {
          imageHash = uploaded.imageHash;
        } else {
          payload.imageUploadError = uploaded.error;
        }
      }
    }

    const { createMetaAdsDraft } = await import('./meta-graph-service.js');
    const draft = await createMetaAdsDraft({
      name,
      message,
      imageHash,
    });
    if (draft.ok) {
      externalPostId = draft.draft.adId || draft.draft.creativeId;
      executeMode =
        draft.draft.mode === 'ad_paused' ? 'meta_ads_paused' : 'meta_ads_creative';
      payload.metaAdsDraft = draft.draft;
      payload.note = draft.draft.note;
    } else {
      externalPostId = `meta-ads-fail:${job.id}`;
      executeMode = 'meta_ads_failed';
      errorMessage = draft.error;
      payload.note = draft.error;
    }
  } else if (
    channelKind === 'facebook_organic' ||
    channelKind === 'instagram_organic'
  ) {
    const message =
      typeof payload.body === 'string' && payload.body.trim()
        ? payload.body
        : typeof payload.assetTitle === 'string'
          ? String(payload.assetTitle)
          : 'ATRISI update';
    const fileIds = Array.isArray(payload.fileIds)
      ? payload.fileIds.filter((id): id is string => typeof id === 'string')
      : [];

    if (fileIds.length > 0) {
      const { files } = await import('../database/schema.js');
      const { eq } = await import('drizzle-orm');
      const { storageProvider } = await import('./file-storage.js');
      const [fileRow] = await db
        .select()
        .from(files)
        .where(eq(files.id, fileIds[0]))
        .limit(1);
      if (fileRow?.storageKey && fileRow.mimetype?.startsWith('image/')) {
        const buffer = await storageProvider.downloadFile(fileRow.storageKey);
        const { publishMetaPagePhoto } = await import('./meta-graph-service.js');
        const posted = await publishMetaPagePhoto({
          message,
          buffer,
          filename: fileRow.originalName || fileRow.filename || 'post.jpg',
          contentType: fileRow.mimetype,
        });
        if (posted.ok) {
          externalPostId = posted.postId;
          executeMode = 'facebook_organic_live';
          payload.note =
            channelKind === 'instagram_organic'
              ? 'Published to Facebook Page (IG organic uses Page photo path for now).'
              : 'Published photo to Facebook Page.';
        } else {
          externalPostId = `fb-organic-fail:${job.id}`;
          executeMode = 'facebook_organic_failed';
          errorMessage = posted.error;
          payload.note = posted.error;
        }
      } else {
        externalPostId = `stub:${channelKind}:${job.id}`;
        executeMode = 'simulate';
        payload.note = 'Organic publish needs an image file on the asset.';
      }
    } else {
      externalPostId = `stub:${channelKind}:${job.id}`;
      executeMode = 'simulate';
      payload.note = 'Organic publish needs an image file on the asset.';
    }
  } else {
    externalPostId = `stub:${channelKind}:${job.id}`;
    executeMode = 'simulate';
    payload.note = `Simulated publish for ${channelKind} (live connector later)`;
  }

  payload.executeMode = executeMode;
  payload.executedAt = new Date().toISOString();

  const failed =
    executeMode === 'meta_ads_failed' || executeMode === 'facebook_organic_failed';

  const [updated] = await db
    .update(publishingJobs)
    .set({
      status: failed ? 'failed' : 'published',
      publishedAt: failed ? null : new Date(),
      externalPostId,
      errorMessage,
      payload,
      updatedAt: new Date(),
    })
    .where(eq(publishingJobs.id, job.id))
    .returning();

  if (!failed) {
    try {
      const { recordInterestFromPublishedJob } = await import('./program-interest-service.js');
      await recordInterestFromPublishedJob({
        ownerUserId: options.ownerUserId,
        jobId: updated.id,
      });
    } catch {
      /* interest recording should not fail the publish */
    }
  }

  return mapJob(updated, channel || null);
}

export async function listCampaignPublishingJobs(
  ownerUserId: string,
  campaignId: string,
): Promise<PublishingJobDto[]> {
  const rows = await db
    .select({
      job: publishingJobs,
      channel: studioChannels,
    })
    .from(publishingJobs)
    .leftJoin(studioChannels, eq(publishingJobs.channelId, studioChannels.id))
    .where(
      and(
        eq(publishingJobs.ownerUserId, ownerUserId),
        eq(publishingJobs.campaignId, campaignId),
      ),
    )
    .orderBy(desc(publishingJobs.updatedAt));

  return rows.map((r) => mapJob(r.job, r.channel));
}

export async function listProgramPublishingJobs(
  ownerUserId: string,
  programId: string,
): Promise<PublishingJobDto[]> {
  const campaigns = await db
    .select({ id: acquisitionCampaigns.id })
    .from(acquisitionCampaigns)
    .where(
      and(
        eq(acquisitionCampaigns.ownerUserId, ownerUserId),
        eq(acquisitionCampaigns.programId, programId),
      ),
    );

  const campaignIds = campaigns.map((c) => c.id);
  if (campaignIds.length === 0) return [];

  const rows = await db
    .select({
      job: publishingJobs,
      channel: studioChannels,
    })
    .from(publishingJobs)
    .leftJoin(studioChannels, eq(publishingJobs.channelId, studioChannels.id))
    .where(
      and(
        eq(publishingJobs.ownerUserId, ownerUserId),
        inArray(publishingJobs.campaignId, campaignIds),
      ),
    )
    .orderBy(desc(publishingJobs.updatedAt));

  return rows.map((r) => mapJob(r.job, r.channel));
}

export async function updatePublishingJobStatus(options: {
  ownerUserId: string;
  jobId: string;
  status: PublishingJobStatus;
  errorMessage?: string | null;
}): Promise<PublishingJobDto | null> {
  const [existing] = await db
    .select()
    .from(publishingJobs)
    .where(
      and(
        eq(publishingJobs.id, options.jobId),
        eq(publishingJobs.ownerUserId, options.ownerUserId),
      ),
    )
    .limit(1);

  if (!existing) return null;

  const [row] = await db
    .update(publishingJobs)
    .set({
      status: options.status,
      ...(options.errorMessage !== undefined ? { errorMessage: options.errorMessage } : {}),
      ...(options.status === 'published' ? { publishedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(publishingJobs.id, options.jobId))
    .returning();

  const [channel] = await db
    .select()
    .from(studioChannels)
    .where(eq(studioChannels.id, row.channelId))
    .limit(1);

  return mapJob(row, channel || null);
}

export async function deletePublishingJob(
  ownerUserId: string,
  jobId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(publishingJobs)
    .where(
      and(
        eq(publishingJobs.id, jobId),
        eq(publishingJobs.ownerUserId, ownerUserId),
      ),
    )
    .returning({ id: publishingJobs.id });

  return deleted.length > 0;
}
