/**
 * Operations Experience routes — Team Activity + ownership classification.
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { authenticateToken } from '../middleware/auth.js';
import {
  requireOrgPermission,
  requireTenantContext,
} from '../middleware/tenant-context.js';
import { listTeamActivity } from '../services/operations-activity-service.js';
import {
  backfillOrganizationOwnership,
  classifyOrganizationOwnership,
} from '../services/organization-backfill-service.js';

export async function operationsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/activity', {
    preHandler: [
      authenticateToken,
      requireTenantContext,
      requireOrgPermission('activity.view'),
    ],
  }, async (request, reply) => {
    const organizationId = request.tenantContext!.organizationId;
    const query = request.query as { limit?: string };
    const limit = query.limit ? Number(query.limit) : 40;
    const items = await listTeamActivity({ organizationId, limit });
    return reply.send({
      success: true,
      data: {
        organizationId,
        organizationCode: request.tenantContext!.organizationCode,
        items,
      },
    });
  });

  fastify.get('/ownership/report', {
    preHandler: [
      authenticateToken,
      requireTenantContext,
      requireOrgPermission('organization.manage'),
    ],
  }, async (request, reply) => {
    const organizationId = request.tenantContext!.organizationId;
    const report = await classifyOrganizationOwnership(organizationId);
    return reply.send({ success: true, data: report });
  });

  fastify.post('/ownership/backfill', {
    preHandler: [
      authenticateToken,
      requireTenantContext,
      requireOrgPermission('organization.manage'),
    ],
  }, async (request, reply) => {
    const organizationId = request.tenantContext!.organizationId;
    const body = (request.body || {}) as { dryRun?: boolean };
    const result = await backfillOrganizationOwnership({
      organizationId,
      dryRun: body.dryRun !== false,
    });
    return reply.send({ success: true, data: result });
  });
}
