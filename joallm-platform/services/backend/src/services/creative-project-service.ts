/**
 * Creative Projects + Marketing Assets under Program Campaigns (Sprint 3).
 * File blobs reuse Platform /api/files — assets store fileIds only.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../database/connection.js';
import {
  acquisitionCampaigns,
  creativeProjects,
  marketingAssets,
} from '../database/schema.js';
import {
  buildOrgDualReadScope,
  resolveOrganizationIdForUser,
} from './organization-ownership.js';

export type CreativeProjectStatus = 'draft' | 'active' | 'archived';
export type GrowthAssetKind =
  | 'image'
  | 'video'
  | 'poster'
  | 'linkedin_post'
  | 'instagram_caption'
  | 'whatsapp_broadcast'
  | 'email'
  | 'landing_hero'
  | 'brochure'
  | 'other';
export type GrowthAssetStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived';

export type CreativeProjectDto = {
  id: string;
  programId: string;
  campaignId: string;
  name: string;
  status: CreativeProjectStatus;
  templateKey?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GrowthMarketingAssetDto = {
  id: string;
  programId: string;
  campaignId: string;
  creativeProjectId: string;
  kind: GrowthAssetKind;
  title: string;
  status: GrowthAssetStatus;
  body?: string | null;
  fileIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

async function assertCampaignOwned(
  ownerUserId: string,
  programId: string,
  campaignId: string,
) {
  const organizationId = await resolveOrganizationIdForUser(ownerUserId);
  const scope = buildOrgDualReadScope({
    organizationId,
    ownerUserId,
    organizationColumn: acquisitionCampaigns.organizationId,
    ownerColumn: acquisitionCampaigns.ownerUserId,
  });

  const [row] = await db
    .select()
    .from(acquisitionCampaigns)
    .where(and(eq(acquisitionCampaigns.id, campaignId), scope))
    .limit(1);

  if (!row) return null;
  const rowProgram =
    (row as { programId?: string | null }).programId ||
    ((row.metadata as Record<string, unknown>)?.programId as string | undefined);
  if (rowProgram && rowProgram !== programId) return null;
  return row;
}

function mapProject(
  row: typeof creativeProjects.$inferSelect,
  programId: string,
): CreativeProjectDto {
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  return {
    id: row.id,
    programId: row.programId || programId,
    campaignId: row.campaignId,
    name: row.name,
    status: row.status as CreativeProjectStatus,
    templateKey: typeof metadata.templateKey === 'string' ? metadata.templateKey : undefined,
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAsset(
  row: typeof marketingAssets.$inferSelect,
  programId: string,
): GrowthMarketingAssetDto {
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  const fileIds = Array.isArray(row.fileIds) ? (row.fileIds as string[]) : [];
  return {
    id: row.id,
    programId: row.programId || programId,
    campaignId: row.campaignId,
    creativeProjectId: row.creativeProjectId,
    kind: row.kind as GrowthAssetKind,
    title: row.title,
    status: row.status as GrowthAssetStatus,
    body: row.body,
    fileIds,
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCreativeProjects(
  ownerUserId: string,
  programId: string,
  campaignId: string,
): Promise<CreativeProjectDto[]> {
  const campaign = await assertCampaignOwned(ownerUserId, programId, campaignId);
  if (!campaign) return [];

  const organizationId = await resolveOrganizationIdForUser(ownerUserId);
  const scope = buildOrgDualReadScope({
    organizationId,
    ownerUserId,
    organizationColumn: creativeProjects.organizationId,
    ownerColumn: creativeProjects.ownerUserId,
  });

  const rows = await db
    .select()
    .from(creativeProjects)
    .where(and(scope, eq(creativeProjects.campaignId, campaignId)))
    .orderBy(desc(creativeProjects.updatedAt));

  return rows.map((row) => mapProject(row, programId));
}

export async function createCreativeProject(options: {
  ownerUserId: string;
  programId: string;
  campaignId: string;
  name: string;
  status?: CreativeProjectStatus;
  templateKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<CreativeProjectDto | null> {
  const campaign = await assertCampaignOwned(
    options.ownerUserId,
    options.programId,
    options.campaignId,
  );
  if (!campaign) return null;

  const metadata = {
    ...(options.metadata || {}),
    ...(options.templateKey ? { templateKey: options.templateKey } : {}),
  };

  const [row] = await db
    .insert(creativeProjects)
    .values({
      ownerUserId: options.ownerUserId,
      organizationId: (await resolveOrganizationIdForUser(options.ownerUserId)) || null,
      campaignId: options.campaignId,
      programId: options.programId,
      name: options.name.trim(),
      status: options.status || 'draft',
      metadata,
    })
    .returning();

  return mapProject(row, options.programId);
}

export async function updateCreativeProject(options: {
  ownerUserId: string;
  programId: string;
  campaignId: string;
  projectId: string;
  name?: string;
  status?: CreativeProjectStatus;
  templateKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<CreativeProjectDto | null> {
  const [existing] = await db
    .select()
    .from(creativeProjects)
    .where(
      and(
        eq(creativeProjects.id, options.projectId),
        eq(creativeProjects.campaignId, options.campaignId),
        eq(creativeProjects.ownerUserId, options.ownerUserId),
      ),
    )
    .limit(1);

  if (!existing) return null;

  const prevMeta = (existing.metadata || {}) as Record<string, unknown>;
  const metadata = {
    ...prevMeta,
    ...(options.metadata || {}),
    ...(options.templateKey !== undefined ? { templateKey: options.templateKey } : {}),
  };

  const [row] = await db
    .update(creativeProjects)
    .set({
      ...(options.name !== undefined ? { name: options.name.trim() } : {}),
      ...(options.status !== undefined ? { status: options.status } : {}),
      metadata,
      programId: options.programId,
      updatedAt: new Date(),
    })
    .where(eq(creativeProjects.id, options.projectId))
    .returning();

  return mapProject(row, options.programId);
}

export async function deleteCreativeProject(
  ownerUserId: string,
  campaignId: string,
  projectId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(creativeProjects)
    .where(
      and(
        eq(creativeProjects.id, projectId),
        eq(creativeProjects.campaignId, campaignId),
        eq(creativeProjects.ownerUserId, ownerUserId),
      ),
    )
    .returning({ id: creativeProjects.id });

  return deleted.length > 0;
}

export async function listProjectAssets(
  ownerUserId: string,
  programId: string,
  campaignId: string,
  projectId: string,
): Promise<GrowthMarketingAssetDto[]> {
  const rows = await db
    .select()
    .from(marketingAssets)
    .where(
      and(
        eq(marketingAssets.ownerUserId, ownerUserId),
        eq(marketingAssets.campaignId, campaignId),
        eq(marketingAssets.creativeProjectId, projectId),
      ),
    )
    .orderBy(desc(marketingAssets.updatedAt));

  return rows.map((row) => mapAsset(row, programId));
}

export async function listCampaignAssets(
  ownerUserId: string,
  programId: string,
  campaignId: string,
): Promise<GrowthMarketingAssetDto[]> {
  const campaign = await assertCampaignOwned(ownerUserId, programId, campaignId);
  if (!campaign) return [];

  const organizationId = await resolveOrganizationIdForUser(ownerUserId);
  const scope = buildOrgDualReadScope({
    organizationId,
    ownerUserId,
    organizationColumn: marketingAssets.organizationId,
    ownerColumn: marketingAssets.ownerUserId,
  });

  const rows = await db
    .select()
    .from(marketingAssets)
    .where(and(scope, eq(marketingAssets.campaignId, campaignId)))
    .orderBy(desc(marketingAssets.updatedAt));

  return rows.map((row) => mapAsset(row, programId));
}

export async function createMarketingAsset(options: {
  ownerUserId: string;
  programId: string;
  campaignId: string;
  creativeProjectId: string;
  title: string;
  kind?: GrowthAssetKind;
  status?: GrowthAssetStatus;
  body?: string;
  fileIds?: string[];
  metadata?: Record<string, unknown>;
}): Promise<GrowthMarketingAssetDto | null> {
  const [project] = await db
    .select()
    .from(creativeProjects)
    .where(
      and(
        eq(creativeProjects.id, options.creativeProjectId),
        eq(creativeProjects.campaignId, options.campaignId),
        eq(creativeProjects.ownerUserId, options.ownerUserId),
      ),
    )
    .limit(1);

  if (!project) return null;

  const [row] = await db
    .insert(marketingAssets)
    .values({
      ownerUserId: options.ownerUserId,
      organizationId: (await resolveOrganizationIdForUser(options.ownerUserId)) || null,
      campaignId: options.campaignId,
      creativeProjectId: options.creativeProjectId,
      programId: options.programId,
      title: options.title.trim(),
      kind: options.kind || 'other',
      status: options.status || 'draft',
      body: options.body || null,
      fileIds: options.fileIds || [],
      metadata: options.metadata || {},
    })
    .returning();

  return mapAsset(row, options.programId);
}

export async function updateMarketingAsset(options: {
  ownerUserId: string;
  programId: string;
  campaignId: string;
  assetId: string;
  title?: string;
  kind?: GrowthAssetKind;
  status?: GrowthAssetStatus;
  body?: string | null;
  fileIds?: string[];
  metadata?: Record<string, unknown>;
}): Promise<GrowthMarketingAssetDto | null> {
  const [existing] = await db
    .select()
    .from(marketingAssets)
    .where(
      and(
        eq(marketingAssets.id, options.assetId),
        eq(marketingAssets.campaignId, options.campaignId),
        eq(marketingAssets.ownerUserId, options.ownerUserId),
      ),
    )
    .limit(1);

  if (!existing) return null;

  const prevMeta = (existing.metadata || {}) as Record<string, unknown>;
  const [row] = await db
    .update(marketingAssets)
    .set({
      ...(options.title !== undefined ? { title: options.title.trim() } : {}),
      ...(options.kind !== undefined ? { kind: options.kind } : {}),
      ...(options.status !== undefined ? { status: options.status } : {}),
      ...(options.body !== undefined ? { body: options.body } : {}),
      ...(options.fileIds !== undefined ? { fileIds: options.fileIds } : {}),
      metadata: { ...prevMeta, ...(options.metadata || {}) },
      programId: options.programId,
      updatedAt: new Date(),
    })
    .where(eq(marketingAssets.id, options.assetId))
    .returning();

  return mapAsset(row, options.programId);
}

export async function deleteMarketingAsset(
  ownerUserId: string,
  campaignId: string,
  assetId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(marketingAssets)
    .where(
      and(
        eq(marketingAssets.id, assetId),
        eq(marketingAssets.campaignId, campaignId),
        eq(marketingAssets.ownerUserId, ownerUserId),
      ),
    )
    .returning({ id: marketingAssets.id });

  return deleted.length > 0;
}

/** Ensure a default creative project exists for quick upload under a campaign */
export async function ensureDefaultCreativeProject(options: {
  ownerUserId: string;
  programId: string;
  campaignId: string;
}): Promise<CreativeProjectDto | null> {
  const existing = await listCreativeProjects(
    options.ownerUserId,
    options.programId,
    options.campaignId,
  );
  if (existing[0]) return existing[0];

  return createCreativeProject({
    ownerUserId: options.ownerUserId,
    programId: options.programId,
    campaignId: options.campaignId,
    name: 'Default creatives',
    status: 'active',
  });
}
