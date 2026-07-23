import { FastifyRequest, FastifyReply } from 'fastify';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { applyInternalAccessOverrides, hasPermission, type Permission } from '../services/access-control.js';
import { db } from '../database/connection.js';
import { users } from '../database/schema.js';
import { eq } from 'drizzle-orm';

// Lazy import to avoid circular deps — resolved at runtime
let _redisInstance: any = null;
async function getRedis() {
  if (_redisInstance === null) {
    try {
      const { redisInstance } = await import('../services/queue.js');
      _redisInstance = redisInstance ?? false; // false = "attempted but unavailable"
    } catch {
      _redisInstance = false;
    }
  }
  return _redisInstance || null;
}

export function tokenBlacklistKey(token: string): string {
  return `blacklist:token:${crypto.createHash('sha256').update(token).digest('hex')}`;
}

async function getDbBlacklist() {
  try {
    const { db } = await import('../database/connection.js');
    const { revokedTokens } = await import('../database/schema.js');
    const { eq, lt } = await import('drizzle-orm');
    return { db, revokedTokens, eq, lt };
  } catch {
    return null;
  }
}

export async function blacklistToken(token: string): Promise<void> {
  const decoded = jwt.decode(token) as any;
  const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
  if (ttl <= 0) return; // Already expired

  const key = tokenBlacklistKey(token);
  const redis = await getRedis();

  if (redis) {
    try {
      await redis.set(key, '1', 'EX', ttl);
      return;
    } catch (err) {
      logger.warn('Redis blacklist failed, falling back to DB:', err);
    }
  }

  // DB fallback when Redis is unavailable
  const dbCtx = await getDbBlacklist();
  if (!dbCtx) {
    logger.warn('Token blacklist unavailable (no Redis, no DB): logout token will expire naturally');
    return;
  }
  try {
    const expiresAt = new Date((decoded?.exp ?? Math.floor(Date.now() / 1000) + 86400) * 1000);
    // Opportunistically clean up expired entries on every insert
    await dbCtx.db.delete(dbCtx.revokedTokens).where(dbCtx.lt(dbCtx.revokedTokens.expiresAt, new Date()));
    await dbCtx.db.insert(dbCtx.revokedTokens)
      .values({ tokenHash: key, expiresAt })
      .onConflictDoNothing();
  } catch (err) {
    logger.warn('DB blacklist fallback failed:', err);
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const key = tokenBlacklistKey(token);
  const redis = await getRedis();

  if (redis) {
    try {
      const val = await redis.get(key);
      if (val === '1') return true;
    } catch {
      // Redis unavailable, fall through to DB check
    }
  }

  // DB fallback
  const dbCtx = await getDbBlacklist();
  if (!dbCtx) return false;
  try {
    const rows = await dbCtx.db
      .select({ tokenHash: dbCtx.revokedTokens.tokenHash })
      .from(dbCtx.revokedTokens)
      .where(dbCtx.eq(dbCtx.revokedTokens.tokenHash, key))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role: 'casual' | 'premium' | 'admin' | 'superuser' | 'pending_2fa';
  /** Institution tenant claims (Platform Identity) */
  organizationId?: string;
  organizationCode?: string;
  organizationSlug?: string;
  membershipId?: string;
  membershipRole?: 'owner' | 'admin' | 'member' | 'viewer';
  permissions?: string[];
  experiences?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthenticatedUser;
}

export type SessionClaims = {
  id: string;
  email: string;
  role: string;
  name?: string;
  organizationId?: string;
  organizationCode?: string;
  organizationSlug?: string;
  membershipId?: string;
  membershipRole?: string;
  permissions?: string[];
  experiences?: string[];
};

// JWT token generation
export function generateToken(
  user: SessionClaims,
  expiresIn: SignOptions['expiresIn'] = '24h'
): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
      organizationCode: user.organizationCode,
      organizationSlug: user.organizationSlug,
      membershipId: user.membershipId,
      membershipRole: user.membershipRole,
      permissions: user.permissions,
      experiences: user.experiences,
    },
    config.jwtSecret,
    { expiresIn } // default 24 hour access token
  );
}

// Refresh token generation
export function generateRefreshToken(user: { id: string; email: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      type: 'refresh'
    },
    config.jwtSecret,
    { expiresIn: '7d' } // Long-lived refresh token
  );
}

// JWT token verification
export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
  } catch (error) {
    logger.error('Token verification failed:', error);
    return null;
  }
}

// Refresh token verification
export function verifyRefreshToken(token: string): { id: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    if (decoded.type === 'refresh') {
      return { id: decoded.id, email: decoded.email };
    }
    return null;
  } catch (error) {
    logger.error('Refresh token verification failed:', error);
    return null;
  }
}

// Authentication middleware
export async function authenticateToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      reply.status(401).send({
        error: 'Access denied',
        message: 'No token provided'
      });
      return;
    }

    const user = verifyToken(token);
    if (!user) {
      reply.status(403).send({
        error: 'Access denied',
        message: 'Invalid token'
      });
      return;
    }

    // Block pending_2fa tokens from all routes except the 2FA verify endpoint
    if ((user as any).role === 'pending_2fa') {
      const path = request.url.split('?')[0];
      if (!path.endsWith('/2fa/verify')) {
        reply.status(403).send({
          error: 'Access denied',
          message: '2FA verification required'
        });
        return;
      }
    }

    // Check token blacklist (for logged-out tokens)
    if (await isTokenBlacklisted(token)) {
      reply.status(401).send({
        error: 'Access denied',
        message: 'Token has been revoked'
      });
      return;
    }

    // Normalise legacy role values from old JWTs (e.g. 'user' → 'casual')
    const ROLE_ALIASES: Record<string, AuthenticatedUser['role']> = {
      user: 'casual',
      moderator: 'premium',
    };
    if ((user as any).role in ROLE_ALIASES) {
      (user as any).role = ROLE_ALIASES[(user as any).role];
    }

    // Always hydrate the current role/email from the database so permission
    // checks reflect role changes immediately, even for older JWTs.
    const [dbUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!dbUser) {
      reply.status(401).send({
        error: 'Access denied',
        message: 'User account not found'
      });
      return;
    }

    const effective = applyInternalAccessOverrides(
      dbUser.email ?? undefined,
      dbUser.role ?? 'casual',
      'free',
    );

    user.email = dbUser.email;
    if (dbUser.name) {
      user.name = dbUser.name;
    }
    user.role = effective.role as AuthenticatedUser['role'];

    // Add user to request object
    request.user = user;

    // Debug logging
    logger.info('Authentication successful:', { userId: user.id, email: user.email });
  } catch (error) {
    logger.error('Authentication error:', error);
    reply.status(500).send({
      error: 'Authentication failed',
      message: 'Internal server error'
    });
  }
}

// Permission-based authorization middleware
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = (request as any).user as AuthenticatedUser | undefined;
    if (!user) {
      reply.status(401).send({ error: 'Access denied', message: 'Authentication required' });
      return;
    }
    if (!hasPermission(user.role, permission)) {
      reply.status(403).send({
        error: 'Subscription upgrade required',
        message: 'This feature requires JoaLLM Pro. Upgrade your plan to continue.',
        role: user.role,
        requiredPermission: permission,
        upgradeRequired: true,
      });
    }
  };
}

// Role-based authorization middleware
export function requireRole(requiredRole: 'user' | 'admin') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.status(401).send({
        error: 'Access denied',
        message: 'Authentication required'
      });
      return;
    }

    if (request.user.role !== requiredRole && request.user.role !== 'admin') {
      reply.status(403).send({
        error: 'Access denied',
        message: `Role '${requiredRole}' required`
      });
      return;
    }
  };
}

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuth(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const user = verifyToken(token);
      if (user) {
        request.user = user;
      }
    }
  } catch (error) {
    // Silently fail for optional auth
    logger.debug('Optional auth failed:', error);
  }
}

// API key authentication for service-to-service communication
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string;
  
  if (!apiKey) {
    reply.status(401).send({
      error: 'Access denied',
      message: 'API key required'
    });
    return;
  }

  if (apiKey !== config.apiKey) {
    reply.status(403).send({
      error: 'Access denied',
      message: 'Invalid API key'
    });
    return;
  }
}

// Rate limiting per user
export function createUserRateLimit(max: number, timeWindow: string) {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      // Fall back to IP-based rate limiting
      return;
    }

    // TODO: Implement user-specific rate limiting using Redis
    // This would track requests per user ID instead of IP
    logger.debug(`Rate limiting for user ${request.user.id}: ${max} requests per ${timeWindow}`);
  };
}
