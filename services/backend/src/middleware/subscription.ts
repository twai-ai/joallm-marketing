/**
 * Subscription tier enforcement middleware.
 * Checks the user's current tier against the required tier for a route.
 *
 * Tier hierarchy: free < pro < enterprise
 * Limits are enforced by querying the DB — they auto-update when the user's tier changes.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../database/connection.js';
import { users } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { applyInternalAccessOverrides } from '../services/access-control.js';

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

// Tier limits — defaults that can be overridden by DB-stored values in the future
export const TIER_LIMITS: Record<SubscriptionTier, {
  maxFiles: number;
  maxStorageMB: number;
  maxChatSessions: number;
  maxWorkflows: number;
  maxNotebooks: number;
  maxApiRequestsPerDay: number;
  canUseCustomApiKeys: boolean;
  canUseCloudStorage: boolean;
  canExportData: boolean;
}> = {
  free: {
    maxFiles: 10,
    maxStorageMB: 100,
    maxChatSessions: 20,
    maxWorkflows: 3,
    maxNotebooks: 3,
    maxApiRequestsPerDay: 50,
    canUseCustomApiKeys: false,
    canUseCloudStorage: false,
    canExportData: false,
  },
  pro: {
    maxFiles: 200,
    maxStorageMB: 5000,
    maxChatSessions: 500,
    maxWorkflows: 50,
    maxNotebooks: 50,
    maxApiRequestsPerDay: 2000,
    canUseCustomApiKeys: true,
    canUseCloudStorage: true,
    canExportData: true,
  },
  enterprise: {
    maxFiles: Infinity,
    maxStorageMB: Infinity,
    maxChatSessions: Infinity,
    maxWorkflows: Infinity,
    maxNotebooks: Infinity,
    maxApiRequestsPerDay: Infinity,
    canUseCustomApiKeys: true,
    canUseCloudStorage: true,
    canExportData: true,
  },
};

const TIER_ORDER: Record<SubscriptionTier, number> = { free: 0, pro: 1, enterprise: 2 };
const TIER_CACHE_TTL_MS = 30_000;
const tierCache = new Map<string, { tier: SubscriptionTier; expiresAt: number }>();

function meetsMinimumTier(userTier: string, requiredTier: SubscriptionTier): boolean {
  const userLevel = TIER_ORDER[userTier as SubscriptionTier] ?? 0;
  const requiredLevel = TIER_ORDER[requiredTier];
  return userLevel >= requiredLevel;
}

export async function getUserTier(userId: string): Promise<SubscriptionTier | null> {
  const now = Date.now();
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.tier;
  }

  const [user] = await db
    .select({ email: users.email, subscriptionTier: users.subscriptionTier, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  const effective = applyInternalAccessOverrides(
    user.email ?? undefined,
    user.role ?? 'casual',
    user.subscriptionTier ?? 'free',
  );
  const tier = effective.subscriptionTier as SubscriptionTier;
  tierCache.set(userId, { tier, expiresAt: now + TIER_CACHE_TTL_MS });
  return tier;
}

/** Middleware factory — requires the user's tier to be at least `minimumTier` */
export function requireTier(minimumTier: SubscriptionTier) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = (request as any).user?.id;
    if (!userId) {
      reply.status(401).send({ error: 'Authentication required' });
      return;
    }

    const tier = await getUserTier(userId);
    if (!tier) {
      reply.status(401).send({ error: 'User not found' });
      return;
    }

    if (!meetsMinimumTier(tier, minimumTier)) {
      reply.status(403).send({
        error: 'Subscription upgrade required',
        message: `This feature requires a ${minimumTier} subscription or higher`,
        currentTier: tier,
        requiredTier: minimumTier,
      });
    }
  };
}

/** Check a boolean tier feature flag */
export function requireTierFeature(feature: keyof typeof TIER_LIMITS['free']) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = (request as any).user?.id;
    if (!userId) {
      reply.status(401).send({ error: 'Authentication required' });
      return;
    }

    const tier = await getUserTier(userId);
    if (!tier) {
      reply.status(401).send({ error: 'User not found' });
      return;
    }
    const limits = TIER_LIMITS[tier];

    if (!limits[feature]) {
      reply.status(403).send({
        error: 'Feature not available',
        message: `'${feature}' is not available on the ${tier} plan`,
        currentTier: tier,
      });
    }
  };
}

/** Get tier limits for a given tier string */
export function getTierLimits(tier: string) {
  return TIER_LIMITS[(tier as SubscriptionTier)] ?? TIER_LIMITS.free;
}

/**
 * Models blocked on the free tier — GPT-4 class and all Claude models.
 * Groq, Ollama, and gpt-3.5-turbo remain available on free.
 */
const PRO_ONLY_MODEL_PREFIXES = ['gpt-4', 'claude-', 'o1-', 'o3-'];

export function isModelAllowedForTier(modelId: string, tier: SubscriptionTier): boolean {
  if (tier !== 'free') return true;
  const lower = modelId.toLowerCase();
  return !PRO_ONLY_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/** Middleware — validates the requested model is allowed for the user's tier */
export function requireModelForTier() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = request.body as Record<string, unknown> | null;
    const modelId = typeof body?.model === 'string' ? body.model : null;
    if (!modelId) return;

    const userId = (request as any).user?.id;
    if (!userId) return;

    const tier = await getUserTier(userId);
    if (!tier) {
      reply.status(401).send({ error: 'User not found' });
      return;
    }

    if (!isModelAllowedForTier(modelId, tier)) {
      reply.status(403).send({
        error: 'Model not available on your plan',
        message: `${modelId} requires a Pro subscription or higher. Upgrade to unlock GPT-4 and Claude models.`,
        currentTier: tier,
        requiredTier: 'pro',
      });
    }
  };
}
