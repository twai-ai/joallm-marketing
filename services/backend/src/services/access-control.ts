/**
 * Access control service.
 * Centralizes RBAC (role → permissions) and entitlements (tier → limits).
 *
 * Role hierarchy (using existing DB enum values):
 *   casual < premium < admin < superuser
 *
 * workspaceMode is a preference, not a permission gate — it controls UI/UX behaviour.
 */

import { TIER_LIMITS, getTierLimits, type SubscriptionTier } from '../middleware/subscription.js';

// ─── Permission tokens ────────────────────────────────────────────────────────

export type Permission =
  | 'chat.read'
  | 'chat.write'
  | 'knowledge.read'
  | 'knowledge.write'
  | 'notebook.read'
  | 'notebook.write'
  | 'workflow.read'
  | 'workflow.execute'
  | 'workflow.manage'
  | 'settings.manage'
  | 'admin.access'
  | 'admin.manage';

export type WorkspaceMode = 'personal' | 'team' | 'enterprise';

const INTERNAL_SUPPORT_EMAIL = process.env.INTERNAL_SUPPORT_EMAIL ?? '';

// ─── Role → permission matrix ─────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  // casual: basic read + write (tier limits cap usage, not permissions)
  casual: [
    'chat.read',
    'chat.write',
    'knowledge.read',
    'knowledge.write',
    'notebook.read',
    'notebook.write',
    'workflow.read',
    'workflow.execute',
    'settings.manage',
  ],
  // premium: full write access across all features
  premium: [
    'chat.read',
    'chat.write',
    'knowledge.read',
    'knowledge.write',
    'notebook.read',
    'notebook.write',
    'workflow.read',
    'workflow.execute',
    'workflow.manage',
    'settings.manage',
  ],
  // admin: premium + admin panel
  admin: [
    'chat.read',
    'chat.write',
    'knowledge.read',
    'knowledge.write',
    'notebook.read',
    'notebook.write',
    'workflow.read',
    'workflow.execute',
    'workflow.manage',
    'settings.manage',
    'admin.access',
  ],
  // superuser: full access including user management
  superuser: [
    'chat.read',
    'chat.write',
    'knowledge.read',
    'knowledge.write',
    'notebook.read',
    'notebook.write',
    'workflow.read',
    'workflow.execute',
    'workflow.manage',
    'settings.manage',
    'admin.access',
    'admin.manage',
  ],
} as const;

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Returns true when `role` includes `permission`. */
export function hasPermission(role: string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

/** Returns the full permission list for a role. */
export function getPermissions(role: string): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function applyInternalAccessOverrides(
  email: string | undefined,
  role: string,
  tier: string,
): { role: string; subscriptionTier: string } {
  if (!INTERNAL_SUPPORT_EMAIL || (email ?? '').toLowerCase() !== INTERNAL_SUPPORT_EMAIL) {
    return { role, subscriptionTier: tier };
  }

  return {
    role: role === 'superuser' ? role : 'admin',
    subscriptionTier: tier === 'enterprise' ? tier : 'enterprise',
  };
}

/** Builds the complete access snapshot returned by GET /api/me/access. */
export function getEffectiveAccess(
  role: string,
  tier: string,
  workspaceMode: WorkspaceMode = 'personal',
  email?: string,
) {
  const effective = applyInternalAccessOverrides(email, role, tier);

  return {
    role: effective.role,
    subscriptionTier: effective.subscriptionTier,
    workspaceMode,
    permissions: getPermissions(effective.role),
    limits: getTierLimits(effective.subscriptionTier),
  };
}

export { TIER_LIMITS, getTierLimits, type SubscriptionTier };
