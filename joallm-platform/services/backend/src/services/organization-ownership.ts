/**
 * Organization ownership helpers for Marketing dual-write.
 * organizationId owns the record; actor userId attributes the action.
 */

import { and, eq, inArray, isNull, or, SQL } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { memberships } from '../database/schema.js';

/** credential_source for Meta connectors through Phase 4 (Railway META_*). */
export const CREDENTIAL_SOURCE_ENVIRONMENT = 'environment' as const;

/**
 * Active membership → organization that owns Marketing data for this user.
 * Returns null when the user has no active membership (should be rare post-admission).
 */
export async function resolveOrganizationIdForUser(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.status, 'active')))
    .limit(1);
  return row?.organizationId ?? null;
}

/** Active member user ids for an organization. */
export async function listOrganizationMemberUserIds(
  organizationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(
      and(eq(memberships.organizationId, organizationId), eq(memberships.status, 'active')),
    );
  return rows.map((r) => r.userId);
}

/**
 * Actor may access a user-owned resource (file / story asset) when they own it
 * or share an active organization with the owner.
 */
export async function canActorAccessOwnerResource(
  actorUserId: string,
  resourceOwnerUserId: string | null | undefined,
): Promise<boolean> {
  if (!resourceOwnerUserId) return true;
  if (resourceOwnerUserId === actorUserId) return true;
  const [actorOrg, ownerOrg] = await Promise.all([
    resolveOrganizationIdForUser(actorUserId),
    resolveOrganizationIdForUser(resourceOwnerUserId),
  ]);
  return Boolean(actorOrg && ownerOrg && actorOrg === ownerOrg);
}

/**
 * Dual-read scope: org-owned rows OR legacy rows still bound to the actor.
 * Pure builder so isolation behavior is unit-testable without a live DB.
 */
export function buildOrgDualReadScope(options: {
  organizationId: string | null | undefined;
  ownerUserId: string;
  organizationColumn: SQL | any;
  ownerColumn: SQL | any;
}): SQL | undefined {
  const { organizationId, ownerUserId, organizationColumn, ownerColumn } = options;
  if (organizationId) {
    return or(
      eq(organizationColumn, organizationId),
      and(eq(ownerColumn, ownerUserId), isNull(organizationColumn)),
    );
  }
  return eq(ownerColumn, ownerUserId);
}

/**
 * Story team read: org-tagged stories + any story owned by an org teammate
 * (covers legacy rows with null organizationId).
 */
export function buildOrgTeamOwnerReadScope(options: {
  organizationId: string | null | undefined;
  actorUserId: string;
  memberUserIds: string[];
  organizationColumn: SQL | any;
  ownerColumn: SQL | any;
}): SQL | undefined {
  const { organizationId, actorUserId, memberUserIds, organizationColumn, ownerColumn } =
    options;
  if (organizationId && memberUserIds.length > 0) {
    return or(
      eq(organizationColumn, organizationId),
      inArray(ownerColumn, memberUserIds),
    );
  }
  return eq(ownerColumn, actorUserId);
}

/**
 * Whether a row is visible under org dual-read rules (pure; for tests).
 */
export function isRowVisibleToTenant(options: {
  rowOrganizationId: string | null;
  rowOwnerUserId: string;
  tenantOrganizationId: string | null;
  actorUserId: string;
}): boolean {
  const { rowOrganizationId, rowOwnerUserId, tenantOrganizationId, actorUserId } =
    options;
  if (tenantOrganizationId) {
    if (rowOrganizationId === tenantOrganizationId) return true;
    if (rowOrganizationId == null && rowOwnerUserId === actorUserId) return true;
    return false;
  }
  return rowOwnerUserId === actorUserId;
}

/** Config stamp for org-owned Meta connectors (secrets stay in env). */
export function orgMetaConnectorConfig(
  existing: Record<string, unknown> | null | undefined,
  options: {
    boundByUserId: string;
    extra?: Record<string, unknown>;
  },
): Record<string, unknown> {
  return {
    ...(existing || {}),
    ...(options.extra || {}),
    credentialSource: CREDENTIAL_SOURCE_ENVIRONMENT,
    boundByUserId: options.boundByUserId,
  };
}
