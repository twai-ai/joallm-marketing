/**
 * Phase 2B — classify + safe backfill of Marketing rows onto organizationId.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../database/connection.js';
import {
  acquisitionCampaigns,
  acquisitionEvents,
  acquisitionInteractions,
  acquisitionPersonIdentities,
  acquisitionPersons,
  acquisitionRawRecords,
  acquisitionSourceConnections,
  memberships,
  platformConnectors,
  publishingProfiles,
  studioChannels,
} from '../database/schema.js';

export type OwnershipClassification = {
  table: string;
  total: number;
  withOrganization: number;
  nullOrganization: number;
  safeBackfillCandidates: number;
  ambiguous: number;
};

const TABLES = [
  { name: 'acquisition_persons', table: acquisitionPersons },
  { name: 'acquisition_person_identities', table: acquisitionPersonIdentities },
  { name: 'acquisition_source_connections', table: acquisitionSourceConnections },
  { name: 'acquisition_events', table: acquisitionEvents },
  { name: 'acquisition_interactions', table: acquisitionInteractions },
  { name: 'acquisition_raw_records', table: acquisitionRawRecords },
  { name: 'acquisition_campaigns', table: acquisitionCampaigns },
  { name: 'platform_connectors', table: platformConnectors },
  { name: 'studio_channels', table: studioChannels },
  { name: 'publishing_profiles', table: publishingProfiles },
] as const;

export async function classifyOrganizationOwnership(
  organizationId: string,
): Promise<{ organizationId: string; tables: OwnershipClassification[] }> {
  const memberUserIds = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, 'active'),
      ),
    );
  const memberSet = new Set(memberUserIds.map((m) => m.userId));

  const tables: OwnershipClassification[] = [];

  for (const entry of TABLES) {
    const rows = await db
      .select({
        organizationId: entry.table.organizationId,
        ownerUserId: entry.table.ownerUserId,
      })
      .from(entry.table);

    let withOrganization = 0;
    let nullOrganization = 0;
    let safeBackfillCandidates = 0;
    let ambiguous = 0;

    for (const row of rows) {
      if (row.organizationId) {
        withOrganization += 1;
        continue;
      }
      nullOrganization += 1;
      if (memberSet.has(row.ownerUserId)) {
        safeBackfillCandidates += 1;
      } else {
        ambiguous += 1;
      }
    }

    tables.push({
      table: entry.name,
      total: rows.length,
      withOrganization,
      nullOrganization,
      safeBackfillCandidates,
      ambiguous,
    });
  }

  return { organizationId, tables };
}

/**
 * Stamp organizationId on null-org rows whose ownerUserId has an active membership
 * in the target org. Leaves ambiguous rows untouched.
 */
export async function backfillOrganizationOwnership(options: {
  organizationId: string;
  dryRun?: boolean;
}): Promise<{
  organizationId: string;
  dryRun: boolean;
  updated: Record<string, number>;
  report: OwnershipClassification[];
}> {
  const { organizationId, dryRun = true } = options;
  const before = await classifyOrganizationOwnership(organizationId);
  const updated: Record<string, number> = {};

  if (dryRun) {
    for (const t of before.tables) {
      updated[t.table] = t.safeBackfillCandidates;
    }
    return {
      organizationId,
      dryRun: true,
      updated,
      report: before.tables,
    };
  }

  const memberUserIds = (
    await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.status, 'active'),
        ),
      )
  ).map((m) => m.userId);

  for (const entry of TABLES) {
    let count = 0;
    for (const userId of memberUserIds) {
      const result = await db
        .update(entry.table)
        .set({ organizationId })
        .where(
          and(
            eq(entry.table.ownerUserId, userId),
            isNull(entry.table.organizationId),
          ),
        )
        .returning({ id: entry.table.id });
      count += result.length;
    }
    updated[entry.name] = count;
  }

  const after = await classifyOrganizationOwnership(organizationId);
  return {
    organizationId,
    dryRun: false,
    updated,
    report: after.tables,
  };
}
