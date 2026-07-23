/**
 * Organization ownership helpers for Marketing dual-write.
 * organizationId owns the record; actor userId attributes the action.
 */

import { and, eq, isNull, or, SQL } from 'drizzle-orm';
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
