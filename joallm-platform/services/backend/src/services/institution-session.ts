/**
 * Build JWT session claims after Platform Identity admission.
 */

import type { FastifyRequest } from 'fastify';
import type { SessionClaims } from '../middleware/auth.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
import { auditLog } from '../utils/audit.js';
import {
  admitUserToOrganization,
  backfillUserAcquisitionToOrg,
  type AdmissionResult,
} from './organization-admission.js';

export async function issueInstitutionSession(options: {
  userId: string;
  email: string;
  name?: string;
  platformRole: string;
  authMethod: 'google' | 'password';
  request?: FastifyRequest;
}): Promise<
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      admission: Extract<AdmissionResult, { ok: true }>;
      claims: SessionClaims;
    }
  | { ok: false; reason: string }
> {
  const admission = await admitUserToOrganization({
    userId: options.userId,
    email: options.email,
    authMethod: options.authMethod,
  });

  if (!admission.ok) {
    await auditLog('auth.login.denied', {
      userId: options.userId,
      resource: 'auth',
      metadata: { reason: admission.reason, email: options.email, method: options.authMethod },
      request: options.request,
    });
    return { ok: false, reason: admission.reason };
  }

  if (admission.provisioned) {
    await auditLog('membership.auto_joined', {
      userId: options.userId,
      organizationId: admission.organizationId,
      resource: 'membership',
      resourceId: admission.membershipId,
      metadata: { method: admission.method, role: admission.role },
      request: options.request,
    });
    try {
      await backfillUserAcquisitionToOrg({
        userId: options.userId,
        organizationId: admission.organizationId,
      });
    } catch {
      /* non-fatal */
    }
  }

  const claims: SessionClaims = {
    id: options.userId,
    email: options.email,
    name: options.name,
    role: options.platformRole,
    organizationId: admission.organizationId,
    organizationCode: admission.organizationCode,
    organizationSlug: admission.organizationSlug,
    membershipId: admission.membershipId,
    membershipRole: admission.role,
    permissions: admission.permissions,
    experiences: admission.experiences,
  };

  const accessToken = generateToken(claims);
  const refreshToken = generateRefreshToken({
    id: options.userId,
    email: options.email,
  });

  await auditLog('auth.login.succeeded', {
    userId: options.userId,
    organizationId: admission.organizationId,
    resource: 'auth',
    metadata: { method: options.authMethod, admission: admission.method },
    request: options.request,
  });

  return { ok: true, accessToken, refreshToken, admission, claims };
}
