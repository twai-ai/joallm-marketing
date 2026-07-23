/**
 * Membership role → org permissions + experiences.
 * Resolved at session issuance; carried on TenantContext (not recomputed ad hoc per route).
 */

export type MembershipRole = 'owner' | 'admin' | 'member' | 'viewer';

export type OrgPermission =
  | 'acquisition.view'
  | 'acquisition.manage'
  | 'campaign.create'
  | 'studio.view'
  | 'studio.manage'
  | 'publishing.execute'
  | 'integrations.manage'
  | 'activity.view'
  | 'organization.manage';

export type ExperienceId = 'acquisition' | 'studio' | 'operations';

const ROLE_ORG_PERMISSIONS: Record<MembershipRole, readonly OrgPermission[]> = {
  viewer: ['acquisition.view', 'studio.view'],
  member: [
    'acquisition.view',
    'acquisition.manage',
    'campaign.create',
    'studio.view',
    'studio.manage',
    'publishing.execute',
    'activity.view',
  ],
  admin: [
    'acquisition.view',
    'acquisition.manage',
    'campaign.create',
    'studio.view',
    'studio.manage',
    'publishing.execute',
    'integrations.manage',
    'activity.view',
    'organization.manage',
  ],
  owner: [
    'acquisition.view',
    'acquisition.manage',
    'campaign.create',
    'studio.view',
    'studio.manage',
    'publishing.execute',
    'integrations.manage',
    'activity.view',
    'organization.manage',
  ],
};

function experiencesFor(permissions: readonly OrgPermission[]): ExperienceId[] {
  const out: ExperienceId[] = [];
  if (permissions.some((p) => p.startsWith('acquisition.'))) out.push('acquisition');
  if (permissions.some((p) => p.startsWith('studio.') || p === 'publishing.execute')) {
    out.push('studio');
  }
  if (permissions.includes('activity.view') || permissions.includes('organization.manage')) {
    out.push('operations');
  }
  return out;
}

export function resolveMembershipPermissions(role: MembershipRole): {
  permissions: OrgPermission[];
  experiences: ExperienceId[];
} {
  const permissions = [...(ROLE_ORG_PERMISSIONS[role] || ROLE_ORG_PERMISSIONS.member)];
  return { permissions, experiences: experiencesFor(permissions) };
}

export function hasOrgPermission(
  permissions: readonly string[] | undefined,
  needed: OrgPermission,
): boolean {
  return Boolean(permissions?.includes(needed));
}
