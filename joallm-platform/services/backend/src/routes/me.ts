import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { db } from '../database/connection.js';
import { users, userPreferences } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import { getEffectiveAccess, type WorkspaceMode } from '../services/access-control.js';

export async function meRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  /**
   * GET /api/me/access
   * Bootstrap endpoint — returns the caller's role, subscription tier,
   * workspace mode, computed permission list, and tier limits in one call.
   */
  fastify.get('/access', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get the authenticated user\'s full access snapshot (role, tier, permissions, limits)',
      tags: ['me'],
    },
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;

      const [user] = await db
        .select({ email: users.email, role: users.role, subscriptionTier: users.subscriptionTier })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const [prefs] = await db
        .select({ workspaceMode: userPreferences.workspaceMode })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      const access = getEffectiveAccess(
        user.role ?? 'casual',
        user.subscriptionTier ?? 'free',
        (prefs?.workspaceMode ?? 'personal') as WorkspaceMode,
        user.email ?? undefined,
      );

      return reply.send(access);
    } catch (error) {
      logger.error('Failed to fetch user access:', error);
      return reply.status(500).send({ error: 'Failed to fetch access data' });
    }
  });
}
