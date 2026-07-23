/**
 * Institution Identity — Organization Admission + ATRISI bootstrap.
 * Domain Auto Join is the first admission strategy (not the only model).
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../database/connection.js';
import {
  memberships,
  organizationDomains,
  organizations,
  workspaces,
} from '../database/schema.js';
import { logger } from '../utils/logger.js';
import {
  resolveMembershipPermissions,
  type MembershipRole,
  type OrgPermission,
  type ExperienceId,
} from './membership-permissions.js';

export const ATRISI_ORG_CODE = 'ATRISI';
export const ATRISI_ORG_SLUG = 'atrisi';
export const ATRISI_DOMAIN = 'atrisi.org';

export type AdmissionMethod = 'domain_auto_join' | 'active_membership' | 'invitation';

export type AdmissionResult =
  | {
      ok: true;
      organizationId: string;
      organizationCode: string;
      organizationSlug: string;
      membershipId: string;
      role: MembershipRole;
      permissions: OrgPermission[];
      experiences: ExperienceId[];
      method: AdmissionMethod;
      provisioned: boolean;
    }
  | { ok: false; reason: string };

/** Ensure ATRISI org + default workspace + atrisi.org domain auto-join exist. */
export async function ensureAtrisiInstitution(): Promise<{
  organizationId: string;
  workspaceId: string;
}> {
  // Railway DBs often skipped migration 0019 / 0031. Create identity tables first,
  // then add columns that older CREATE TABLE paths omitted.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "organizations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "code" text,
      "domain" text,
      "plan" text DEFAULT 'starter',
      "settings" jsonb DEFAULT '{}'::jsonb,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp NOT NULL DEFAULT NOW(),
      "updated_at" timestamp NOT NULL DEFAULT NOW(),
      CONSTRAINT "organizations_slug_unique" UNIQUE ("slug")
    )
  `);
  await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "code" text`);
  await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "domain" text`);
  await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'starter'`);
  await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "settings" jsonb DEFAULT '{}'::jsonb`);
  await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "created_by" uuid`);
  await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT NOW()`);
  await db.execute(sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT NOW()`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "workspaces" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "description" text,
      "is_default" boolean DEFAULT false,
      "settings" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp NOT NULL DEFAULT NOW(),
      "updated_at" timestamp NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "description" text`);
  await db.execute(sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false`);
  await db.execute(sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "settings" jsonb DEFAULT '{}'::jsonb`);
  await db.execute(sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "organization_id" uuid`);
  await db.execute(sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "name" text`);
  await db.execute(sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "slug" text`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "memberships" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "role" text NOT NULL DEFAULT 'member',
      "status" text NOT NULL DEFAULT 'active',
      "created_at" timestamp NOT NULL DEFAULT NOW(),
      "updated_at" timestamp NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "organization_domains" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "domain" text NOT NULL,
      "is_verified" boolean NOT NULL DEFAULT false,
      "auto_join_enabled" boolean NOT NULL DEFAULT false,
      "allowed_auth_methods" jsonb DEFAULT '["google","password"]'::jsonb,
      "default_role" text NOT NULL DEFAULT 'member',
      "created_at" timestamp NOT NULL DEFAULT NOW(),
      "updated_at" timestamp NOT NULL DEFAULT NOW(),
      CONSTRAINT "organization_domains_domain_unique" UNIQUE ("domain")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid,
      "action" text NOT NULL,
      "resource" text,
      "resource_id" text,
      "metadata" jsonb,
      "ip_address" text,
      "user_agent" text,
      "created_at" timestamp NOT NULL DEFAULT NOW()
    )
  `);

  let [org] = await db
    .select({
      id: organizations.id,
      code: organizations.code,
      domain: organizations.domain,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.slug, ATRISI_ORG_SLUG))
    .limit(1);

  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({
        name: 'ATRISI',
        slug: ATRISI_ORG_SLUG,
        code: ATRISI_ORG_CODE,
        domain: ATRISI_DOMAIN,
        plan: 'enterprise',
        settings: { brand: 'atrisi' },
      })
      .returning({
        id: organizations.id,
        code: organizations.code,
        domain: organizations.domain,
        slug: organizations.slug,
      });
    logger.info('Seeded ATRISI organization', { organizationId: org.id });
  } else if (!org.code) {
    await db
      .update(organizations)
      .set({ code: ATRISI_ORG_CODE, domain: org.domain || ATRISI_DOMAIN, updatedAt: new Date() })
      .where(eq(organizations.id, org.id));
    org = { ...org, code: ATRISI_ORG_CODE };
  }

  let [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(eq(workspaces.organizationId, org.id), eq(workspaces.slug, 'default')),
    )
    .limit(1);

  if (!ws) {
    [ws] = await db
      .insert(workspaces)
      .values({
        organizationId: org.id,
        name: 'Default',
        slug: 'default',
        isDefault: true,
      })
      .returning({ id: workspaces.id });
  }

  const [domainRow] = await db
    .select({ id: organizationDomains.id })
    .from(organizationDomains)
    .where(
      and(
        eq(organizationDomains.organizationId, org.id),
        eq(organizationDomains.domain, ATRISI_DOMAIN),
      ),
    )
    .limit(1);

  if (!domainRow) {
    await db.insert(organizationDomains).values({
      organizationId: org.id,
      domain: ATRISI_DOMAIN,
      isVerified: true,
      autoJoinEnabled: true,
      allowedAuthMethods: ['google', 'password'],
      defaultRole: 'member',
    });
  }

  return { organizationId: org.id, workspaceId: ws.id };
}

function emailDomain(email: string): string {
  const parts = email.toLowerCase().trim().split('@');
  return parts.length === 2 ? parts[1] : '';
}

/**
 * Resolve admission for a verified user email.
 * Strategies: active membership → domain auto-join → deny.
 */
export async function admitUserToOrganization(options: {
  userId: string;
  email: string;
  authMethod: 'google' | 'password';
}): Promise<AdmissionResult> {
  await ensureAtrisiInstitution();

  const domain = emailDomain(options.email);
  if (!domain) {
    return { ok: false, reason: 'Invalid email' };
  }

  // Kill-switch (optional env) — not source of truth
  const kill = process.env.ALLOWED_EMAIL_DOMAINS?.trim();
  if (kill) {
    const allowed = kill.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(domain)) {
      // Still allow if active membership exists (grandfather)
      const [existing] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, options.userId),
            eq(memberships.status, 'active'),
          ),
        )
        .limit(1);
      if (!existing) {
        return {
          ok: false,
          reason: `Email domain not allowed by ALLOWED_EMAIL_DOMAINS`,
        };
      }
    }
  }

  // 1) Existing active membership
  const activeMemberships = await db
    .select({
      membershipId: memberships.id,
      membershipRole: memberships.role,
      organizationId: organizations.id,
      organizationCode: organizations.code,
      organizationSlug: organizations.slug,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(eq(memberships.userId, options.userId), eq(memberships.status, 'active')),
    )
    .limit(5);

  if (activeMemberships.length > 0) {
    const row = activeMemberships[0];
    const role = (row.membershipRole || 'member') as MembershipRole;
    const resolved = resolveMembershipPermissions(role);
    return {
      ok: true,
      organizationId: row.organizationId,
      organizationCode: row.organizationCode || row.organizationSlug.toUpperCase(),
      organizationSlug: row.organizationSlug,
      membershipId: row.membershipId,
      role,
      permissions: resolved.permissions,
      experiences: resolved.experiences,
      method: 'active_membership',
      provisioned: false,
    };
  }

  // 2) Domain auto-join
  const [domainMapping] = await db
    .select({
      domainId: organizationDomains.id,
      allowedAuthMethods: organizationDomains.allowedAuthMethods,
      defaultRole: organizationDomains.defaultRole,
      organizationId: organizations.id,
      organizationCode: organizations.code,
      organizationSlug: organizations.slug,
    })
    .from(organizationDomains)
    .innerJoin(
      organizations,
      eq(organizationDomains.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationDomains.domain, domain),
        eq(organizationDomains.autoJoinEnabled, true),
        eq(organizationDomains.isVerified, true),
      ),
    )
    .limit(1);

  if (!domainMapping) {
    return {
      ok: false,
      reason: `No organization admission for domain @${domain}`,
    };
  }

  const methods = domainMapping.allowedAuthMethods || ['google', 'password'];
  if (!methods.includes(options.authMethod)) {
    return {
      ok: false,
      reason: `Auth method ${options.authMethod} not allowed for @${domain}`,
    };
  }

  const defaultRole = (domainMapping.defaultRole || 'member') as MembershipRole;

  const [existingMembership] = await db
    .select({
      id: memberships.id,
      status: memberships.status,
      role: memberships.role,
    })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, options.userId),
        eq(memberships.organizationId, domainMapping.organizationId),
      ),
    )
    .limit(1);

  let membership = existingMembership;
  let provisioned = false;

  if (!membership) {
    const [created] = await db
      .insert(memberships)
      .values({
        organizationId: domainMapping.organizationId,
        userId: options.userId,
        role: defaultRole,
        status: 'active',
      })
      .returning({
        id: memberships.id,
        status: memberships.status,
        role: memberships.role,
      });
    membership = created;
    provisioned = true;
  } else if (membership.status !== 'active') {
    const [reactivated] = await db
      .update(memberships)
      .set({ status: 'active', role: defaultRole, updatedAt: new Date() })
      .where(eq(memberships.id, membership.id))
      .returning({
        id: memberships.id,
        status: memberships.status,
        role: memberships.role,
      });
    membership = reactivated || { ...membership, status: 'active', role: defaultRole };
    provisioned = true;
  }

  if (!membership) {
    return { ok: false, reason: 'Failed to provision membership' };
  }

  const role = (membership.role || defaultRole) as MembershipRole;
  const resolved = resolveMembershipPermissions(role);

  return {
    ok: true,
    organizationId: domainMapping.organizationId,
    organizationCode:
      domainMapping.organizationCode || domainMapping.organizationSlug.toUpperCase(),
    organizationSlug: domainMapping.organizationSlug,
    membershipId: membership.id,
    role,
    permissions: resolved.permissions,
    experiences: resolved.experiences,
    method: 'domain_auto_join',
    provisioned,
  };
}

/** Soft dual-write: stamp organization_id on this user's null-org acquisition rows. */
export async function backfillUserAcquisitionToOrg(options: {
  userId: string;
  organizationId: string;
}): Promise<number> {
  const tables = [
    'acquisition_persons',
    'acquisition_person_identities',
    'acquisition_source_connections',
    'acquisition_raw_records',
    'acquisition_events',
    'acquisition_interactions',
    'acquisition_campaigns',
    'acquisition_initiatives',
    'creative_projects',
    'marketing_assets',
    'publishing_jobs',
    'studio_channels',
  ] as const;

  let total = 0;
  for (const table of tables) {
    try {
      const result = await db.execute(sql.raw(`
        UPDATE "${table}"
        SET organization_id = '${options.organizationId}'::uuid,
            updated_at = NOW()
        WHERE owner_user_id = '${options.userId}'::uuid
          AND organization_id IS NULL
      `));
      const count = Number((result as { rowCount?: number }).rowCount || 0);
      total += count;
    } catch {
      /* skip missing columns/tables */
    }
  }
  if (total > 0) {
    logger.info('Backfilled acquisition rows to organization', {
      userId: options.userId,
      organizationId: options.organizationId,
      rows: total,
    });
  }
  return total;
}
