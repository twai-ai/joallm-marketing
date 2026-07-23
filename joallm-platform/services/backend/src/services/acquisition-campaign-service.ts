/**
 * Program-scoped acquisition campaigns (Sprint 2 / 2b).
 * Initiative rows are internal program buckets; UI talks Programs + Intents + Campaigns.
 * intentId is stored in metadata (catalog is code-defined).
 */

import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { acquisitionCampaigns, acquisitionInitiatives } from '../database/schema.js';
import {
  buildOrgDualReadScope,
  resolveOrganizationIdForUser,
} from './organization-ownership.js';
import { auditLog } from '../utils/audit.js';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type AcquisitionCampaignDto = {
  id: string;
  programId: string;
  intentId?: string;
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
  const intentId = typeof metadata.intentId === 'string' ? metadata.intentId : undefined;
  return {
    id: row.id,
    programId: (row as { programId?: string | null }).programId || programId,
    intentId,
    name: row.name,
    channel: row.channel,
    status: row.status as CampaignStatus,
    intentTemplate: typeof metadata.intentTemplate === 'string' ? metadata.intentTemplate : undefined,
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function stampInitiativeOrganization(
  initiativeId: string,
  organizationId: string | null,
  currentOrganizationId: string | null | undefined,
) {
  if (!organizationId || currentOrganizationId) return;
  await db
    .update(acquisitionInitiatives)
    .set({ organizationId, updatedAt: new Date() })
    .where(eq(acquisitionInitiatives.id, initiativeId));
}

/**
 * Prefer the initiative that already has campaigns so org dual-write never
 * hides creatives under an empty duplicate bucket.
 */
async function pickInitiativeWithCampaigns(
  candidates: Array<typeof acquisitionInitiatives.$inferSelect>,
): Promise<typeof acquisitionInitiatives.$inferSelect | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const counts = await Promise.all(
    candidates.map(async (row) => {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(acquisitionCampaigns)
        .where(eq(acquisitionCampaigns.initiativeId, row.id));
      return { row, count: Number(result?.count || 0) };
    }),
  );
  counts.sort((a, b) => b.count - a.count || b.row.updatedAt.getTime() - a.row.updatedAt.getTime());
  return counts[0]?.row || candidates[0];
}

/** Ensure one initiative bucket per tenant + program (targeting id from atrisi.org). */
export async function ensureProgramInitiative(options: {
  ownerUserId: string;
  programId: string;
  programName: string;
  organizationId?: string | null;
}): Promise<{ id: string }> {
  const { ownerUserId, programId, programName } = options;
  const organizationId =
    options.organizationId ?? (await resolveOrganizationIdForUser(ownerUserId));

  const dualRead = buildOrgDualReadScope({
    organizationId,
    ownerUserId,
    organizationColumn: acquisitionInitiatives.organizationId,
    ownerColumn: acquisitionInitiatives.ownerUserId,
  });

  const byProgram = await db
    .select()
    .from(acquisitionInitiatives)
    .where(and(dualRead, eq(acquisitionInitiatives.programId, programId)));

  const picked = await pickInitiativeWithCampaigns(byProgram);
  if (picked) {
    await stampInitiativeOrganization(picked.id, organizationId, picked.organizationId);
    return { id: picked.id };
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
    );

  const legacyPicked = await pickInitiativeWithCampaigns(legacy);
  if (legacyPicked) {
    try {
      await db
        .update(acquisitionInitiatives)
        .set({
          programId,
          organizationId: organizationId || legacyPicked.organizationId,
          updatedAt: new Date(),
        })
        .where(eq(acquisitionInitiatives.id, legacyPicked.id));
    } catch {
      /* column may not exist yet on very old DBs */
    }
    return { id: legacyPicked.id };
  }

  // Last resort: owner+program rows that still lack organizationId (pre dual-write)
  const ownerProgram = await db
    .select()
    .from(acquisitionInitiatives)
    .where(
      and(
        eq(acquisitionInitiatives.ownerUserId, ownerUserId),
        eq(acquisitionInitiatives.programId, programId),
      ),
    );
  const ownerPicked = await pickInitiativeWithCampaigns(ownerProgram);
  if (ownerPicked) {
    await stampInitiativeOrganization(ownerPicked.id, organizationId, ownerPicked.organizationId);
    return { id: ownerPicked.id };
  }

  const [created] = await db
    .insert(acquisitionInitiatives)
    .values({
      ownerUserId,
      organizationId: organizationId || null,
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
  const organizationId = await resolveOrganizationIdForUser(ownerUserId);
  await ensureProgramInitiative({
    ownerUserId,
    programId,
    programName: programId,
    organizationId,
  });

  const initiativeScope = buildOrgDualReadScope({
    organizationId,
    ownerUserId,
    organizationColumn: acquisitionInitiatives.organizationId,
    ownerColumn: acquisitionInitiatives.ownerUserId,
  });
  const initiatives = await db
    .select({ id: acquisitionInitiatives.id })
    .from(acquisitionInitiatives)
    .where(
      and(
        initiativeScope,
        or(
          eq(acquisitionInitiatives.programId, programId),
          eq(acquisitionInitiatives.description, `program:${programId}`),
        ),
      ),
    );
  const initiativeIds = initiatives.map((row) => row.id);

  const campaignScope = buildOrgDualReadScope({
    organizationId,
    ownerUserId,
    organizationColumn: acquisitionCampaigns.organizationId,
    ownerColumn: acquisitionCampaigns.ownerUserId,
  });

  const programMatch =
    initiativeIds.length > 0
      ? or(
          inArray(acquisitionCampaigns.initiativeId, initiativeIds),
          eq(acquisitionCampaigns.programId, programId),
        )
      : eq(acquisitionCampaigns.programId, programId);

  const rows = await db
    .select()
    .from(acquisitionCampaigns)
    .where(and(campaignScope, programMatch))
    .orderBy(desc(acquisitionCampaigns.updatedAt));

  return rows.map((row) => mapCampaign(row, programId));
}

export async function createProgramCampaign(options: {
  ownerUserId: string;
  programId: string;
  programName: string;
  name: string;
  intentId?: string;
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
    ...(options.intentId ? { intentId: options.intentId } : {}),
    ...(options.intentTemplate ? { intentTemplate: options.intentTemplate } : {}),
  };

  const [row] = await db
    .insert(acquisitionCampaigns)
    .values({
      ownerUserId: options.ownerUserId,
      organizationId: (await resolveOrganizationIdForUser(options.ownerUserId)) || null,
      initiativeId: initiative.id,
      programId: options.programId,
      name: options.name.trim(),
      channel: options.channel || null,
      status: options.status || 'draft',
      metadata: {
        ...metadata,
        createdBy: options.ownerUserId,
      },
    })
    .returning();

  await auditLog('campaign.created', {
    userId: options.ownerUserId,
    organizationId: row.organizationId,
    resource: 'acquisition_campaign',
    resourceId: row.id,
    metadata: { programId: options.programId, name: row.name },
  });

  return mapCampaign(row, options.programId);
}

export async function updateProgramCampaign(options: {
  ownerUserId: string;
  programId: string;
  campaignId: string;
  name?: string;
  intentId?: string;
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
    ...(options.intentId !== undefined ? { intentId: options.intentId } : {}),
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
