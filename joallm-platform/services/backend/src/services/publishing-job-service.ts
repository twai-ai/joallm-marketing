/**
 * Publishing Jobs (Sprint 4) — Studio publish intent from Marketing Assets.
 * Creates draft/queued jobs; live connector execution is Sprint 5.
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

  const payload = {
    programId: options.programId,
    campaignId: options.campaignId,
    campaignName: campaign.name,
    intentId,
    assetId: asset.id,
    assetTitle: asset.title,
    assetKind: asset.kind,
    fileIds: asset.fileIds || [],
    body: asset.body,
    channelKind: options.channelKind,
    note: 'Queued for outbound connector (Sprint 5). Not sent externally yet.',
  };

  const [row] = await db
    .insert(publishingJobs)
    .values({
      ownerUserId: options.ownerUserId,
      campaignId: options.campaignId,
      initiativeId: campaign.initiativeId,
      marketingAssetId: asset.id,
      channelId: channel.id,
      connectorId: channel.connectorId ?? null,
      status: options.status || 'queued',
      payload,
    })
    .returning();

  const [channelRow] = await db
    .select()
    .from(studioChannels)
    .where(eq(studioChannels.id, channel.id))
    .limit(1);

  return mapJob(row, channelRow || null);
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
