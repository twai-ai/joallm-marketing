/**
 * Program-scoped acquisition campaigns (Sprint 2).
 * Initiative rows are internal program buckets; UI talks Programs + Campaigns.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { acquisitionCampaigns, acquisitionInitiatives } from '../database/schema.js';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type AcquisitionCampaignDto = {
  id: string;
  programId: string;
  name: string;
  channel: string | null;
  status: CampaignStatus;
  intentTemplate?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function mapCampaign(
  row: typeof acquisitionCampaigns.$inferSelect,
  programId: string,
): AcquisitionCampaignDto {
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  return {
    id: row.id,
    programId: (row as { programId?: string | null }).programId || programId,
    name: row.name,
    channel: row.channel,
    status: row.status as CampaignStatus,
    intentTemplate: typeof metadata.intentTemplate === 'string' ? metadata.intentTemplate : undefined,
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Ensure one initiative bucket per user + program (targeting id from atrisi.org). */
export async function ensureProgramInitiative(options: {
  ownerUserId: string;
  programId: string;
  programName: string;
}): Promise<{ id: string }> {
  const { ownerUserId, programId, programName } = options;

  const existing = await db
    .select()
    .from(acquisitionInitiatives)
    .where(
      and(
        eq(acquisitionInitiatives.ownerUserId, ownerUserId),
        eq(acquisitionInitiatives.programId, programId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { id: existing[0].id };
  }

  // Fallback for DBs before program_id column: match by description marker
  const legacy = await db
    .select()
    .from(acquisitionInitiatives)
    .where(
      and(
        eq(acquisitionInitiatives.ownerUserId, ownerUserId),
        eq(acquisitionInitiatives.description, `program:${programId}`),
      ),
    )
    .limit(1);

  if (legacy[0]) {
    try {
      await db
        .update(acquisitionInitiatives)
        .set({ programId, updatedAt: new Date() })
        .where(eq(acquisitionInitiatives.id, legacy[0].id));
    } catch {
      /* column may not exist yet on very old DBs */
    }
    return { id: legacy[0].id };
  }

  const [created] = await db
    .insert(acquisitionInitiatives)
    .values({
      ownerUserId,
      name: programName,
      description: `program:${programId}`,
      programId,
      status: 'active',
    })
    .returning();

  return { id: created.id };
}

export async function listProgramCampaigns(
  ownerUserId: string,
  programId: string,
): Promise<AcquisitionCampaignDto[]> {
  const initiative = await ensureProgramInitiative({
    ownerUserId,
    programId,
    programName: programId,
  });

  const rows = await db
    .select()
    .from(acquisitionCampaigns)
    .where(
      and(
        eq(acquisitionCampaigns.ownerUserId, ownerUserId),
        eq(acquisitionCampaigns.initiativeId, initiative.id),
      ),
    )
    .orderBy(desc(acquisitionCampaigns.updatedAt));

  return rows.map((row) => mapCampaign(row, programId));
}

export async function createProgramCampaign(options: {
  ownerUserId: string;
  programId: string;
  programName: string;
  name: string;
  channel?: string;
  status?: CampaignStatus;
  intentTemplate?: string;
  metadata?: Record<string, unknown>;
}): Promise<AcquisitionCampaignDto> {
  const initiative = await ensureProgramInitiative({
    ownerUserId: options.ownerUserId,
    programId: options.programId,
    programName: options.programName,
  });

  const metadata = {
    ...(options.metadata || {}),
    programId: options.programId,
    ...(options.intentTemplate ? { intentTemplate: options.intentTemplate } : {}),
  };

  const [row] = await db
    .insert(acquisitionCampaigns)
    .values({
      ownerUserId: options.ownerUserId,
      initiativeId: initiative.id,
      programId: options.programId,
      name: options.name.trim(),
      channel: options.channel || null,
      status: options.status || 'draft',
      metadata,
    })
    .returning();

  return mapCampaign(row, options.programId);
}

export async function updateProgramCampaign(options: {
  ownerUserId: string;
  programId: string;
  campaignId: string;
  name?: string;
  channel?: string | null;
  status?: CampaignStatus;
  intentTemplate?: string;
  metadata?: Record<string, unknown>;
}): Promise<AcquisitionCampaignDto | null> {
  const [existing] = await db
    .select()
    .from(acquisitionCampaigns)
    .where(
      and(
        eq(acquisitionCampaigns.id, options.campaignId),
        eq(acquisitionCampaigns.ownerUserId, options.ownerUserId),
      ),
    )
    .limit(1);

  if (!existing) return null;

  const prevMeta = (existing.metadata || {}) as Record<string, unknown>;
  const metadata = {
    ...prevMeta,
    ...(options.metadata || {}),
    programId: options.programId,
    ...(options.intentTemplate !== undefined
      ? { intentTemplate: options.intentTemplate }
      : {}),
  };

  const [row] = await db
    .update(acquisitionCampaigns)
    .set({
      ...(options.name !== undefined ? { name: options.name.trim() } : {}),
      ...(options.channel !== undefined ? { channel: options.channel } : {}),
      ...(options.status !== undefined ? { status: options.status } : {}),
      metadata,
      programId: options.programId,
      updatedAt: new Date(),
    })
    .where(eq(acquisitionCampaigns.id, options.campaignId))
    .returning();

  return mapCampaign(row, options.programId);
}

export async function deleteProgramCampaign(
  ownerUserId: string,
  campaignId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(acquisitionCampaigns)
    .where(
      and(
        eq(acquisitionCampaigns.id, campaignId),
        eq(acquisitionCampaigns.ownerUserId, ownerUserId),
      ),
    )
    .returning({ id: acquisitionCampaigns.id });

  return deleted.length > 0;
}

export async function getProgramCampaign(
  ownerUserId: string,
  campaignId: string,
): Promise<AcquisitionCampaignDto | null> {
  const [row] = await db
    .select()
    .from(acquisitionCampaigns)
    .where(
      and(
        eq(acquisitionCampaigns.id, campaignId),
        eq(acquisitionCampaigns.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);

  if (!row) return null;
  const programId =
    (row as { programId?: string | null }).programId ||
    ((row.metadata as Record<string, unknown>)?.programId as string) ||
    'unknown';
  return mapCampaign(row, programId);
}
