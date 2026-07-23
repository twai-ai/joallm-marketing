import { sql } from 'drizzle-orm';
import { FastifyRequest } from 'fastify';
import { db } from '../database/connection.js';
import { logger } from './logger.js';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'account_locked'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'file_upload'
  | 'file_delete'
  | 'notebook_execute'
  | 'notebook_create'
  | 'notebook_delete'
  | 'admin_action'
  | 'auth.login.succeeded'
  | 'auth.login.denied'
  | 'membership.auto_joined'
  | 'integration.meta.bound'
  | 'integration.meta.sync_completed'
  | 'publishing.executed'
  | 'campaign.created';

export async function auditLog(
  action: AuditAction,
  options: {
    userId?: string | null;
    resource?: string;
    resourceId?: string;
    organizationId?: string | null;
    metadata?: Record<string, any>;
    request?: FastifyRequest;
  } = {},
): Promise<void> {
  const { userId, resource, resourceId, metadata, request, organizationId } = options;
  try {
    const enriched = {
      ...(metadata || {}),
      ...(organizationId ? { organizationId } : {}),
    };
    await db.execute(sql`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, metadata, ip_address, user_agent)
      VALUES (
        ${userId ?? null},
        ${action},
        ${resource ?? null},
        ${resourceId ?? null},
        ${Object.keys(enriched).length ? JSON.stringify(enriched) : null}::jsonb,
        ${request?.ip ?? null},
        ${request?.headers?.['user-agent'] ?? null}
      )
    `);
  } catch (err) {
    logger.warn('Failed to write audit log:', err);
  }
}
