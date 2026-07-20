import { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { memberships } from '../database/schema.js';
import { logger } from '../utils/logger.js';

export interface WorkspaceContext {
  workspaceId: string;
  organizationId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    workspaceContext?: WorkspaceContext;
  }
}

/**
 * Optional workspace middleware. Reads `x-workspace-id` from headers.
 * If present, verifies the authenticated user is an active member of that workspace
 * and attaches the context to the request. Routes can then call `getWorkspaceId()`
 * to scope queries without breaking unauthenticated / non-workspace flows.
 *
 * Must run AFTER `authenticateToken` or `optionalAuth`.
 */
export async function optionalWorkspaceContext(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const workspaceId = request.headers['x-workspace-id'] as string | undefined;
  if (!workspaceId) return;

  const userId = (request as any).user?.id;
  if (!userId) {
    reply.status(401).send({ error: 'Authentication required to use workspace context' });
    return;
  }

  try {
    const [membership] = await db
      .select({
        workspaceId: memberships.workspaceId,
        organizationId: memberships.organizationId,
        role: memberships.role,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, userId),
          eq(memberships.status, 'active')
        )
      )
      .limit(1);

    if (!membership || !membership.workspaceId) {
      reply.status(403).send({ error: 'Workspace access denied' });
      return;
    }

    request.workspaceContext = {
      workspaceId: membership.workspaceId,
      organizationId: membership.organizationId,
      role: membership.role,
    };
  } catch (error) {
    logger.error('Failed to verify workspace membership:', error);
    reply.status(500).send({ error: 'Failed to verify workspace access' });
  }
}

/**
 * Strict variant — requires a valid workspace context. Use on routes where
 * workspace isolation is mandatory (e.g. team-level resource access).
 */
export async function requireWorkspaceContext(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await optionalWorkspaceContext(request, reply);
  if (reply.sent) return;

  if (!request.workspaceContext) {
    reply.status(400).send({ error: 'x-workspace-id header is required' });
  }
}

/** Returns the workspace ID from request context (if set). */
export function getWorkspaceId(request: FastifyRequest): string | undefined {
  return request.workspaceContext?.workspaceId;
}

/** Returns true if the workspace member has at least the given role level. */
export function hasWorkspaceRole(
  request: FastifyRequest,
  minRole: 'viewer' | 'member' | 'admin' | 'owner'
): boolean {
  const role = request.workspaceContext?.role;
  if (!role) return false;
  const levels: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
  return (levels[role] ?? -1) >= (levels[minRole] ?? 0);
}
