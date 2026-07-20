/**
 * Integrations routes — OAuth connect/disconnect for third-party services.
 * - GET  /integrations                        — list connected integrations for current user
 * - GET  /integrations/google/connect         — start Google Workspace OAuth flow (Pro+ only)
 * - GET  /integrations/google/callback        — OAuth callback (exchanges code, stores tokens)
 * - DELETE /integrations/google               — disconnect Google Workspace
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { db } from '../database/connection.js';
import { userIntegrations } from '../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireTier } from '../middleware/subscription.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const GOOGLE_WORKSPACE_REDIRECT_URI =
  process.env.GOOGLE_WORKSPACE_REDIRECT_URI ??
  'http://localhost:3001/api/integrations/google/callback';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5174';

// Scopes for Google Workspace connectors (read-only)
const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

function makeOAuthClient() {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_WORKSPACE_REDIRECT_URI);
}

export async function integrationsRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {

  // List connected integrations
  fastify.get('/', {
    preHandler: authenticateToken,
    schema: { tags: ['integrations'] },
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const rows = await db
      .select({
        provider: userIntegrations.provider,
        scopes: userIntegrations.scopes,
        expiresAt: userIntegrations.expiresAt,
        createdAt: userIntegrations.createdAt,
      })
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId));

    return reply.send({ integrations: rows });
  });

  // Start Google Workspace OAuth — Pro+ only
  fastify.get('/google/connect', {
    preHandler: [authenticateToken, requireTier('pro')],
    schema: { tags: ['integrations'] },
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    // Sign a short-lived state token so we can recover userId on callback
    const state = jwt.sign({ userId, purpose: 'workspace_oauth' }, JWT_SECRET, { expiresIn: '10m' });

    const client = makeOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',        // force refresh_token every time
      scope: WORKSPACE_SCOPES,
      state,
    });

    return reply.send({ url });
  });

  // OAuth callback — called by Google after user grants consent
  fastify.get('/google/callback', {
    schema: { tags: ['integrations'] },
  }, async (request, reply) => {
    const { code, state, error } = request.query as Record<string, string>;

    if (error) {
      logger.warn(`Google Workspace OAuth denied: ${error}`);
      return reply.redirect(`${FRONTEND_URL}/settings?integration=error&reason=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return reply.redirect(`${FRONTEND_URL}/settings?integration=error&reason=missing_params`);
    }

    // Verify state
    let userId: string;
    try {
      const payload = jwt.verify(state, JWT_SECRET) as { userId: string; purpose: string };
      if (payload.purpose !== 'workspace_oauth') throw new Error('Wrong purpose');
      userId = payload.userId;
    } catch {
      logger.warn('Google Workspace OAuth: invalid state token');
      return reply.redirect(`${FRONTEND_URL}/settings?integration=error&reason=invalid_state`);
    }

    // Exchange code for tokens
    let tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null };
    try {
      const client = makeOAuthClient();
      const { tokens: t } = await client.getToken(code);
      tokens = t;
    } catch (err) {
      logger.error('Google Workspace token exchange failed:', err);
      return reply.redirect(`${FRONTEND_URL}/settings?integration=error&reason=token_exchange`);
    }

    if (!tokens.access_token) {
      return reply.redirect(`${FRONTEND_URL}/settings?integration=error&reason=no_access_token`);
    }

    // Upsert into user_integrations
    await db
      .insert(userIntegrations)
      .values({
        userId,
        provider: 'google_workspace',
        scopes: WORKSPACE_SCOPES,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userIntegrations.userId, userIntegrations.provider],
        set: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          scopes: WORKSPACE_SCOPES,
          updatedAt: new Date(),
        },
      });

    logger.info(`Google Workspace connected for user ${userId}`);
    return reply.redirect(`${FRONTEND_URL}/settings?integration=success&provider=google_workspace`);
  });

  // Disconnect Google Workspace
  fastify.delete('/google', {
    preHandler: authenticateToken,
    schema: { tags: ['integrations'] },
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    await db
      .delete(userIntegrations)
      .where(
        and(
          eq(userIntegrations.userId, userId),
          eq(userIntegrations.provider, 'google_workspace'),
        ),
      );

    logger.info(`Google Workspace disconnected for user ${userId}`);
    return reply.send({ disconnected: true });
  });
}
