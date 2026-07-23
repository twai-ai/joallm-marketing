/**
 * Platform TenantContext middleware.
 * Organization = security/ownership boundary. Workspace = optional operational boundary (unused for Marketing AI yet).
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  type ExperienceId,
  type MembershipRole,
  type OrgPermission,
  hasOrgPermission,
} from '../services/membership-permissions.js';
import { logger } from '../utils/logger.js';

export type TenantContext = {
  userId: string;
  organizationId: string;
  organizationCode: string;
  organizationSlug: string;
  workspaceId?: string;
  membershipId: string;
  role: MembershipRole;
  permissions: OrgPermission[];
  experiences: ExperienceId[];
};

declare module 'fastify' {
  interface FastifyRequest {
    tenantContext?: TenantContext;
  }
}

export function getTenantContext(request: FastifyRequest): TenantContext | undefined {
  return request.tenantContext;
}

/** Attach tenant from JWT claims (set at login/admission). */
export async function attachTenantContext(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const user = (request as any).user as
    | {
        id: string;
        organizationId?: string;
        organizationCode?: string;
        organizationSlug?: string;
        membershipId?: string;
        membershipRole?: MembershipRole;
        permissions?: OrgPermission[];
        experiences?: ExperienceId[];
      }
    | undefined;

  if (!user?.organizationId || !user.membershipId) {
    return;
  }

  request.tenantContext = {
    userId: user.id,
    organizationId: user.organizationId,
    organizationCode: user.organizationCode || 'UNKNOWN',
    organizationSlug: user.organizationSlug || 'unknown',
    membershipId: user.membershipId,
    role: user.membershipRole || 'member',
    permissions: user.permissions || [],
    experiences: user.experiences || [],
  };
}

/** Require active org membership on the request (from JWT). */
export async function requireTenantContext(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await attachTenantContext(request, reply);
  if (!request.tenantContext) {
    reply.status(403).send({
      success: false,
      error: 'No active organization membership',
      code: 'membership_required',
    });
    return;
  }
}

export function requireOrgPermission(permission: OrgPermission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireTenantContext(request, reply);
    if (reply.sent) return;
    const ctx = request.tenantContext!;
    if (!hasOrgPermission(ctx.permissions, permission)) {
      logger.info('Org permission denied', {
        userId: ctx.userId,
        permission,
        role: ctx.role,
      });
      reply.status(403).send({
        success: false,
        error: `Missing permission: ${permission}`,
        code: 'permission_denied',
      });
    }
  };
}
