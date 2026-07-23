import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import { eq, and, ne } from 'drizzle-orm';
import { redisInstance, isRedisAvailable } from '../services/queue.js';
import { generateToken, generateRefreshToken, verifyRefreshToken, authenticateToken, blacklistToken, isTokenBlacklisted, AuthenticatedRequest } from '../middleware/auth.js';
import { EndpointValidations, SanitizationUtils } from '../middleware/validation.js';
import { db } from '../database/connection.js';
import { users, userSecurity } from '../database/schema.js';
import { logger } from '../utils/logger.js';
import { googleAuthService } from '../services/googleAuthService.js';
import { auditLog } from '../utils/audit.js';
import { applyInternalAccessOverrides } from '../services/access-control.js';
import { normalizePublicUrl, resolveRequestOrigin } from '../utils/public-url.js';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

/** Normalize FRONTEND_URL (Railway often injects host without scheme). */
function getFrontendUrl(): string {
  return normalizePublicUrl(process.env.FRONTEND_URL, 'http://localhost:5174');
}

/** Prefer GOOGLE_REDIRECT_URI; otherwise derive from the public request host. */
function getGoogleRedirectUri(request: FastifyRequest): string {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) {
    return googleAuthService.resolveRedirectUri(configured);
  }
  const origin = resolveRequestOrigin(request.headers as Record<string, unknown>);
  if (origin) {
    return `${origin}/api/auth/google/callback`;
  }
  return googleAuthService.resolveRedirectUri();
}

type OAuthCodePayload = { accessToken: string; refreshToken: string };
const oauthCodeMemory = new Map<string, { payload: OAuthCodePayload; expiresAt: number }>();

async function storeOAuthCode(code: string, payload: OAuthCodePayload): Promise<void> {
  // Always keep an in-process copy so exchange works even if Redis blips.
  oauthCodeMemory.set(code, { payload, expiresAt: Date.now() + 300_000 });
  if (!isRedisAvailable || !redisInstance) return;
  try {
    await (redisInstance as any).set(`oauth_code:${code}`, JSON.stringify(payload), 'EX', 300);
  } catch (error) {
    logger.warn('OAuth code Redis store failed; using memory fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function consumeOAuthCode(code: string): Promise<OAuthCodePayload | null> {
  if (isRedisAvailable && redisInstance) {
    try {
      const key = `oauth_code:${code}`;
      const raw = await (redisInstance as any).get(key);
      if (raw) {
        await (redisInstance as any).del(key);
        oauthCodeMemory.delete(code);
        return JSON.parse(raw) as OAuthCodePayload;
      }
    } catch (error) {
      logger.warn('OAuth code Redis consume failed; trying memory', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const entry = oauthCodeMemory.get(code);
  if (!entry) return null;
  oauthCodeMemory.delete(code);
  if (entry.expiresAt < Date.now()) return null;
  return entry.payload;
}

// Register new user
async function register(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = registerSchema.parse(request.body);
    
    // Sanitize inputs
    const sanitizedBody = {
      email: body.email.toLowerCase().trim(),
      password: body.password,
      name: SanitizationUtils.sanitizeContent(body.name)
    };
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, sanitizedBody.email)).limit(1);
    
    if (existingUser.length > 0) {
      reply.status(409).send({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(sanitizedBody.password, saltRounds);

    // Create user
    // All users get 'casual' role by default
    const userRole = 'casual';
    
    const [newUser] = await db.insert(users).values({
      email: sanitizedBody.email,
      password: hashedPassword,
      name: sanitizedBody.name,
      role: userRole,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt
    });

    const { issueInstitutionSession } = await import('../services/institution-session.js');
    const session = await issueInstitutionSession({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      platformRole: newUser.role || 'casual',
      authMethod: 'password',
      request,
    });

    if (!session.ok) {
      await db.delete(users).where(eq(users.id, newUser.id));
      reply.status(403).send({
        error: 'Membership denied',
        message: session.reason,
        code: 'membership_denied',
      });
      return;
    }

    reply.status(201).send({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatar: null,
        role: newUser.role || 'casual',
        subscriptionTier: 'free',
        usageStats: {
          totalTokens: 0,
          totalRequests: 0,
          totalFiles: 0,
          lastReset: new Date().toISOString(),
        },
        organizationId: session.admission.organizationId,
        organizationCode: session.admission.organizationCode,
        membershipRole: session.admission.role,
        permissions: session.admission.permissions,
        experiences: session.admission.experiences,
        createdAt: newUser.createdAt.toISOString(),
        updatedAt: newUser.createdAt.toISOString()
      },
      token: session.accessToken,
      refreshToken: session.refreshToken
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400).send({
        error: 'Validation error',
        message: error.errors[0].message
      });
      return;
    }

    logger.error('Registration error:', error);
    reply.status(500).send({
      error: 'Registration failed',
      message: 'Internal server error'
    });
  }
}

// Login user
async function login(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = loginSchema.parse(request.body);
    
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    
    if (!user) {
      reply.status(401).send({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
      return;
    }

    // Check account lockout before verifying password
    const [securityRecord] = await db.select().from(userSecurity).where(eq(userSecurity.userId, user.id)).limit(1);
    if (securityRecord?.lockedUntil && securityRecord.lockedUntil > new Date()) {
      await auditLog('account_locked', { userId: user.id, metadata: { email: user.email }, request });
      reply.status(423).send({
        error: 'Account locked',
        message: 'Too many failed login attempts. Please try again later.'
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(body.password, user.password);

    if (!isValidPassword) {
      // Increment failed login attempts
      const attempts = (securityRecord?.failedLoginAttempts ?? 0) + 1;
      const lockPayload: Record<string, any> = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minute lockout
        lockPayload.lockedUntil = lockUntil;
      }
      if (securityRecord) {
        await db.update(userSecurity).set(lockPayload).where(eq(userSecurity.userId, user.id));
      } else {
        await db.insert(userSecurity).values({ userId: user.id, ...lockPayload });
      }
      await auditLog('login_failed', { userId: user.id, metadata: { email: user.email, attempts }, request });
      reply.status(401).send({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
      return;
    }

    // Reset failed attempts on successful password check
    if (securityRecord) {
      await db.update(userSecurity)
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(userSecurity.userId, user.id));
    }

    // Check if 2FA is enabled for this user
    const [security] = securityRecord
      ? [securityRecord]
      : await db.select().from(userSecurity).where(eq(userSecurity.userId, user.id)).limit(1);
    if (security?.twoFactorEnabled) {
      // Issue a short-lived pre-auth token; the client must complete 2FA to get a full token
      const preAuthToken = generateToken({ id: user.id, email: user.email, role: 'pending_2fa' }, '10m');
      reply.status(200).send({
        requiresTwoFactor: true,
        preAuthToken,
        message: 'Please provide your 2FA code to complete login',
      });
      return;
    }

    const effectiveAccess = applyInternalAccessOverrides(
      user.email,
      user.role || 'casual',
      user.subscriptionTier || 'free',
    );
    const finalRole = effectiveAccess.role;
    const finalTier = effectiveAccess.subscriptionTier;

    const { issueInstitutionSession } = await import('../services/institution-session.js');
    const session = await issueInstitutionSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      platformRole: finalRole || 'casual',
      authMethod: 'password',
      request,
    });

    if (!session.ok) {
      reply.status(403).send({
        error: 'Membership denied',
        message: session.reason,
        code: 'membership_denied',
      });
      return;
    }

    reply.send({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: finalRole || 'casual',
        subscriptionTier: finalTier as any,
        usageStats: user.usageStats || {
          totalTokens: 0,
          totalRequests: 0,
          totalFiles: 0,
          lastReset: new Date().toISOString(),
        },
        organizationId: session.admission.organizationId,
        organizationCode: session.admission.organizationCode,
        membershipRole: session.admission.role,
        permissions: session.admission.permissions,
        experiences: session.admission.experiences,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      },
      token: session.accessToken,
      refreshToken: session.refreshToken
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400).send({
        error: 'Validation error',
        message: error.errors[0].message
      });
      return;
    }

    logger.error('Login error:', error);
    reply.status(500).send({
      error: 'Login failed',
      message: 'Internal server error'
    });
  }
}

// Refresh access token
async function refreshToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = refreshTokenSchema.parse(request.body);
    
    // Verify refresh token
    const tokenData = verifyRefreshToken(body.refreshToken);
    if (!tokenData) {
      reply.status(401).send({
        error: 'Invalid refresh token',
        message: 'Refresh token is invalid or expired'
      });
      return;
    }

    // Reject blacklisted refresh tokens (covers logout and password-change revocation)
    if (await isTokenBlacklisted(body.refreshToken)) {
      reply.status(401).send({
        error: 'Token revoked',
        message: 'Refresh token has been revoked'
      });
      return;
    }

    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.id, tokenData.id)).limit(1);
    if (!user) {
      reply.status(401).send({
        error: 'User not found',
        message: 'User associated with refresh token not found'
      });
      return;
    }

    // Generate new access token
    const effectiveAccess = applyInternalAccessOverrides(
      user.email,
      user.role || 'casual',
      user.subscriptionTier || 'free',
    );

    const newAccessToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: effectiveAccess.role || 'casual'
    });

    reply.send({
      message: 'Token refreshed successfully',
      accessToken: newAccessToken
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400).send({
        error: 'Validation error',
        message: error.errors[0].message
      });
      return;
    }

    logger.error('Refresh token error:', error);
    reply.status(500).send({
      error: 'Token refresh failed',
      message: 'Internal server error'
    });
  }
}

// Get current user profile
async function getProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!request.user) {
      reply.status(401).send({
        error: 'Authentication required',
        message: 'Please log in to access your profile'
      });
      return;
    }

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatar: users.avatar,
      role: users.role,
      subscriptionTier: users.subscriptionTier,
      usageStats: users.usageStats,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    }).from(users).where(eq(users.id, request.user.id)).limit(1);

    if (!user) {
      reply.status(404).send({
        error: 'User not found',
        message: 'User profile not found'
      });
      return;
    }

    const effectiveAccess = applyInternalAccessOverrides(
      user.email,
      user.role || 'casual',
      user.subscriptionTier || 'free',
    );

    const { admitUserToOrganization } = await import('../services/organization-admission.js');
    const admission = await admitUserToOrganization({
      userId: user.id,
      email: user.email,
      authMethod: 'google',
    });

    reply.send({
      user: {
        ...user,
        role: effectiveAccess.role as any,
        subscriptionTier: effectiveAccess.subscriptionTier as any,
        ...(admission.ok
          ? {
              organizationId: admission.organizationId,
              organizationCode: admission.organizationCode,
              organizationSlug: admission.organizationSlug,
              membershipId: admission.membershipId,
              membershipRole: admission.role,
              permissions: admission.permissions,
              experiences: admission.experiences,
            }
          : {}),
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    reply.status(500).send({
      error: 'Failed to get profile',
      message: 'Internal server error'
    });
  }
}

// Update user profile
async function updateProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!request.user) {
      reply.status(401).send({
        error: 'Authentication required',
        message: 'Please log in to update your profile'
      });
      return;
    }

    const updateSchema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').optional(),
      email: z.string().email('Invalid email format').optional()
    });

    const body = updateSchema.parse(request.body);

    // Check if email is already taken by another user
    if (body.email) {
      const [existingUser] = await db.select().from(users)
        .where(and(eq(users.email, body.email), ne(users.id, request.user.id)))
        .limit(1);
      
      if (existingUser) {
        reply.status(409).send({
          error: 'Email already taken',
          message: 'This email is already registered to another account'
        });
        return;
      }
    }

    // Update user
    const [updatedUser] = await db.update(users)
      .set({
        ...body,
        updatedAt: new Date()
      })
      .where(eq(users.id, request.user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        role: users.role,
        subscriptionTier: users.subscriptionTier,
        usageStats: users.usageStats,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      });

    const effectiveAccess = applyInternalAccessOverrides(
      updatedUser.email,
      updatedUser.role || 'casual',
      updatedUser.subscriptionTier || 'free',
    );

    reply.send({
      message: 'Profile updated successfully',
      user: {
        ...updatedUser,
        role: effectiveAccess.role as any,
        subscriptionTier: effectiveAccess.subscriptionTier as any,
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400).send({
        error: 'Validation error',
        message: error.errors[0].message
      });
      return;
    }

    logger.error('Update profile error:', error);
    reply.status(500).send({
      error: 'Failed to update profile',
      message: 'Internal server error'
    });
  }
}

// Change password
async function changePassword(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!request.user) {
      reply.status(401).send({
        error: 'Authentication required',
        message: 'Please log in to change your password'
      });
      return;
    }

    const body = changePasswordSchema.parse(request.body);

    // Get current user with password
    const [user] = await db.select().from(users).where(eq(users.id, request.user.id)).limit(1);
    
    if (!user) {
      reply.status(404).send({
        error: 'User not found',
        message: 'User not found'
      });
      return;
    }

    // Superusers (by role, not hardcoded email) can skip current password verification
    const isSuperUser = user.role === 'superuser';
    let isValidPassword = true;

    if (!isSuperUser) {
      // Verify current password for regular users
      if (!body.currentPassword) {
        reply.status(400).send({
          error: 'Current password required',
          message: 'Current password is required for regular users'
        });
        return;
      }
      isValidPassword = await bcrypt.compare(body.currentPassword, user.password);
    }
    
    if (!isValidPassword) {
      reply.status(401).send({
        error: 'Invalid password',
        message: 'Current password is incorrect'
      });
      return;
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(body.newPassword, saltRounds);

    // Update password
    await db.update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, request.user.id));

    await auditLog('password_change', { userId: request.user.id, request });
    reply.send({
      message: 'Password changed successfully'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400).send({
        error: 'Validation error',
        message: error.errors[0].message
      });
      return;
    }

    logger.error('Change password error:', error);
    reply.status(500).send({
      error: 'Failed to change password',
      message: 'Internal server error'
    });
  }
}

// Logout — blacklist the access token so it cannot be reused
async function logout(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      await blacklistToken(token);
    }
    // Also blacklist the refresh token when provided by the client
    const refreshToken = (request.body as any)?.refreshToken;
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
      await blacklistToken(refreshToken);
    }
    const userId = (request as any).user?.id;
    if (userId) await auditLog('logout', { userId, request });
    reply.send({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    reply.status(500).send({
      error: 'Logout failed',
      message: 'Internal server error'
    });
  }
}

// Google OAuth handlers
async function googleAuthStatus(_request: FastifyRequest, reply: FastifyReply) {
  const redirectUri = googleAuthService.resolveRedirectUri(process.env.GOOGLE_REDIRECT_URI);
  return reply.send({
    ok: true,
    redirectUri,
    frontendUrl: getFrontendUrl(),
    hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    redisAvailable: Boolean(isRedisAvailable),
  });
}

async function googleAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const redirectUri = getGoogleRedirectUri(request);
    logger.info('Google OAuth initiated', { redirectUri, frontendUrl: getFrontendUrl() });
    const authUrl = googleAuthService.generateAuthUrl(redirectUri);
    reply.redirect(authUrl);
  } catch (error) {
    logger.error('Google auth error:', error);
    reply.redirect(`${getFrontendUrl()}/auth/error?message=${encodeURIComponent('Google authentication setup failed')}`);
  }
}

async function googleCallback(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { code?: string; error?: string; error_description?: string };
    const redirectUri = getGoogleRedirectUri(request);

    logger.info('Google OAuth callback received', {
      code: query.code ? 'present' : 'missing',
      error: query.error || null,
      redirectUri,
    });

    if (query.error) {
      const reason = query.error_description || query.error;
      reply.redirect(
        `${getFrontendUrl()}/auth/error?message=${encodeURIComponent(`Google denied access: ${reason}`)}`,
      );
      return;
    }

    if (!query.code) {
      logger.error('No authorization code in callback');
      reply.redirect(
        `${getFrontendUrl()}/auth/error?message=${encodeURIComponent('No authorization code provided')}`,
      );
      return;
    }

    // Get user info from Google (redirect_uri must match the one used to start the flow)
    logger.info('Exchanging code for tokens...', { redirectUri });
    const { userInfo } = await googleAuthService.getTokenAndUserInfo(query.code, redirectUri);
    logger.info('Successfully got user info:', { email: userInfo.email, name: userInfo.name });

    // Check if user exists
    let [user] = await db.select().from(users).where(eq(users.email, userInfo.email)).limit(1);

    if (!user) {
      // Create new user — store a bcrypt hash so password column constraints stay valid
      const placeholderPassword = await bcrypt.hash(`oauth-${randomUUID()}`, 12);
      const newUser = await db.insert(users).values({
        email: userInfo.email,
        name: userInfo.name,
        password: placeholderPassword,
        avatar: userInfo.picture || null,
        role: 'casual', // Default role for OAuth users
        subscriptionTier: 'free',
        usageStats: {
          totalTokens: 0,
          totalRequests: 0,
          totalFiles: 0,
          lastReset: new Date().toISOString(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      user = newUser[0];
    } else {
      // Update existing user with Google info
      await db.update(users)
        .set({
          name: userInfo.name,
          avatar: userInfo.picture || null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      
      // Update local user object with new values
      user = { ...user, name: userInfo.name, avatar: userInfo.picture || null };
    }

    const effectiveAccess = applyInternalAccessOverrides(
      user.email,
      user.role || 'casual',
      user.subscriptionTier || 'free',
    );

    const { issueInstitutionSession } = await import('../services/institution-session.js');
    const session = await issueInstitutionSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      platformRole: effectiveAccess.role || 'casual',
      authMethod: 'google',
      request,
    });

    if (!session.ok) {
      reply.redirect(
        `${getFrontendUrl()}/auth/error?message=${encodeURIComponent(session.reason)}`,
      );
      return;
    }

    const oauthCode = randomUUID();
    await storeOAuthCode(oauthCode, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    const redirectUrl = `${getFrontendUrl()}/auth/callback?code=${oauthCode}`;
    logger.info('Google OAuth success, redirecting to frontend', {
      frontendUrl: getFrontendUrl(),
      redis: isRedisAvailable,
      organizationId: session.admission.organizationId,
    });
    reply.redirect(redirectUrl);

  } catch (error) {
    logger.error('Google callback error:', error);
    const detail = error instanceof Error ? error.message : 'Authentication failed';
    const hint = /redirect_uri/i.test(detail)
      ? ' Check GOOGLE_REDIRECT_URI matches Google Console exactly.'
      : '';
    reply.redirect(
      `${getFrontendUrl()}/auth/error?message=${encodeURIComponent(`${detail}${hint}`)}`,
    );
  }
}

// Delete account
async function deleteAccount(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).user.id;
    const { password } = request.body as { password: string };

    if (!password) {
      return reply.status(400).send({ 
        error: 'Password required',
        message: 'Please provide your password to confirm account deletion'
      });
    }

    // Get user to verify password
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return reply.status(401).send({ 
        error: 'Invalid password',
        message: 'Password is incorrect'
      });
    }

    // Delete user (cascades to all related data)
    await db.delete(users).where(eq(users.id, userId));

    logger.info(`Deleted account for user ${userId} (${user.email})`);

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  } catch (error) {
    logger.error('Failed to delete account:', error);
    return reply.status(500).send({ 
      error: 'Failed to delete account',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Forgot password — issues a reset token (logged; email delivery is out-of-scope here)
async function forgotPassword(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);

    // Always respond 200 to prevent user enumeration
    if (!user) {
      return reply.send({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const rawToken = randomUUID();
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const [existing] = await db.select().from(userSecurity).where(eq(userSecurity.userId, user.id)).limit(1);
    if (existing) {
      await db.update(userSecurity)
        .set({ passwordResetToken: hashedToken, passwordResetExpires: expires })
        .where(eq(userSecurity.userId, user.id));
    } else {
      await db.insert(userSecurity).values({
        userId: user.id,
        passwordResetToken: hashedToken,
        passwordResetExpires: expires,
      });
    }

    // TODO: send email with rawToken reset link
    logger.info(`Password reset token issued for user ${user.id}`);
    await auditLog('password_reset_request', { userId: user.id, request });

    return reply.send({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Validation error', message: error.errors[0].message });
    }
    logger.error('Forgot password error:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}

// Reset password using token
async function resetPassword(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { token, newPassword } = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    }).parse(request.body);

    const hashedToken = createHash('sha256').update(token).digest('hex');

    const [security] = await db.select().from(userSecurity)
      .where(eq(userSecurity.passwordResetToken, hashedToken))
      .limit(1);

    if (!security || !security.passwordResetExpires || security.passwordResetExpires < new Date()) {
      return reply.status(400).send({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(users.id, security.userId));
    await db.update(userSecurity)
      .set({ passwordResetToken: null, passwordResetExpires: null, failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(userSecurity.userId, security.userId));

    await auditLog('password_reset_complete', { userId: security.userId, request });
    return reply.send({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Validation error', message: error.errors[0].message });
    }
    logger.error('Reset password error:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}

// Exchange a one-time OAuth code for JWT tokens
async function exchangeOAuthCode(request: FastifyRequest, reply: FastifyReply) {
  const { code } = request.query as { code?: string };
  if (!code) {
    return reply.status(400).send({ error: 'Missing code parameter' });
  }
  try {
    const payload = await consumeOAuthCode(code);
    if (!payload) {
      return reply.status(401).send({ error: 'Invalid or expired code' });
    }
    return reply.send({ token: payload.accessToken, refreshToken: payload.refreshToken });
  } catch (error) {
    logger.error('OAuth code exchange error:', error);
    return reply.status(500).send({ error: 'Token exchange failed' });
  }
}

const authRateLimit = { max: 5, timeWindow: '1 minute' };

export async function authRoutes(fastify: FastifyInstance) {
  // Public routes
  fastify.post('/register', { preHandler: EndpointValidations.register, config: { rateLimit: authRateLimit } }, register);
  fastify.post('/login', { preHandler: EndpointValidations.login, config: { rateLimit: authRateLimit } }, login);
  fastify.post('/refresh', { config: { rateLimit: authRateLimit } }, refreshToken);
  fastify.get('/exchange', exchangeOAuthCode); // Exchange OAuth code for JWTs
  fastify.post('/forgot-password', { config: { rateLimit: authRateLimit } }, forgotPassword);
  fastify.post('/reset-password', { config: { rateLimit: authRateLimit } }, resetPassword);

  // Google OAuth routes
  fastify.get('/google/status', googleAuthStatus);
  fastify.get('/google', googleAuth);
  fastify.get('/google/callback', googleCallback);

  // Protected routes
  fastify.get('/profile', { preHandler: authenticateToken }, getProfile);
  fastify.put('/profile', { preHandler: [authenticateToken, EndpointValidations.register] }, updateProfile);
  fastify.put('/change-password', { preHandler: [authenticateToken, EndpointValidations.changePassword] }, changePassword);
  fastify.post('/logout', { preHandler: authenticateToken }, logout);
  fastify.delete('/account', { preHandler: authenticateToken }, deleteAccount);
}
