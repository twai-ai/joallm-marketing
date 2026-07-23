/**
 * Operations Experience — Team Activity (Evidence stream).
 * Reads audit_logs filtered by organizationId in metadata or org members' security/marketing actions.
 */

import { sql } from 'drizzle-orm';
import { db } from '../database/connection.js';

export type TeamActivityItem = {
  id: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  userId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  organizationId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export async function listTeamActivity(options: {
  organizationId: string;
  limit?: number;
}): Promise<TeamActivityItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 100);
  const orgId = options.organizationId;

  const result = await db.execute(sql`
    SELECT
      a.id::text AS id,
      a.action,
      a.resource,
      a.resource_id AS "resourceId",
      a.user_id::text AS "userId",
      u.email AS "actorEmail",
      COALESCE(u.name, u.email) AS "actorName",
      a.metadata,
      a.created_at AS "createdAt"
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE
      (a.metadata->>'organizationId') = ${orgId}
      OR (
        a.user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM memberships m
          WHERE m.user_id = a.user_id
            AND m.organization_id = ${orgId}::uuid
            AND m.status = 'active'
        )
        AND a.action IN (
          'auth.login.succeeded',
          'auth.login.denied',
          'membership.auto_joined',
          'integration.meta.bound',
          'integration.meta.sync_completed',
          'publishing.executed',
          'campaign.created',
          'login',
          'logout'
        )
      )
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `);

  const rows = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows
    || (Array.isArray(result) ? result : []);

  return rows.map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    const createdAt =
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt || new Date(0).toISOString());
    return {
      id: String(row.id),
      action: String(row.action),
      resource: row.resource != null ? String(row.resource) : null,
      resourceId: row.resourceId != null ? String(row.resourceId) : null,
      userId: row.userId != null ? String(row.userId) : null,
      actorEmail: row.actorEmail != null ? String(row.actorEmail) : null,
      actorName: row.actorName != null ? String(row.actorName) : null,
      organizationId:
        typeof metadata.organizationId === 'string'
          ? metadata.organizationId
          : orgId,
      createdAt,
      metadata,
    };
  });
}
