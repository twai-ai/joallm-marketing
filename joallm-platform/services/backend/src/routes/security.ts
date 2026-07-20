import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection.js';
import { userSecurity, users } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken, generateRefreshToken, generateToken } from '../middleware/auth.js';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

// Validation schemas
const Enable2FASchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

const Verify2FASchema = z.object({
  code: z.string().length(6, '2FA code must be 6 digits'),
});

const Disable2FASchema = z.object({
  password: z.string().min(1, 'Password is required'),
  code: z.string().length(6, '2FA code must be 6 digits'),
});

export async function securityRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Get security settings
  fastify.get('/', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get user security settings',
      tags: ['security']
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;

      let security = await db
        .select()
        .from(userSecurity)
        .where(eq(userSecurity.userId, userId))
        .limit(1);

      // If no security record exists, create default one
      if (security.length === 0) {
        const [newSecurity] = await db
          .insert(userSecurity)
          .values({
            userId,
          })
          .returning();
        
        security = [newSecurity];
        logger.info(`Created default security settings for user ${userId}`);
      }

      // Don't expose sensitive data
      const { twoFactorSecret, twoFactorBackupCodes, passwordResetToken, ...safeData } = security[0];

      return { 
        security: {
          ...safeData,
          hasTwoFactorSecret: !!twoFactorSecret,
          hasBackupCodes: (twoFactorBackupCodes as any)?.length > 0,
        }
      };
    } catch (error) {
      logger.error('Failed to fetch security settings:', error);
      return reply.status(500).send({ error: 'Failed to fetch security settings' });
    }
  });

  // Enable 2FA - Step 1: Generate secret and QR code
  fastify.post('/2fa/setup', {
    preHandler: authenticateToken,
    schema: {
      description: 'Generate 2FA secret and QR code',
      tags: ['security'],
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = Enable2FASchema.parse(request.body);

      // Verify password (skip for OAuth-only users who have no password hash)
      const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (dbUser?.password) {
        const isPasswordValid = await bcrypt.compare(body.password, dbUser.password);
        if (!isPasswordValid) {
          return reply.status(401).send({ error: 'Invalid password', message: 'Password verification failed' });
        }
      }

      // Generate secret
      const secret = authenticator.generateSecret();

      // Generate OTP auth URL
      const userEmail = dbUser?.email ?? (request as any).user.email;
      const otpauthUrl = authenticator.keyuri(
        userEmail,
        'JoaLLM',
        secret
      );

      // Generate QR code
      const qrCode = await QRCode.toDataURL(otpauthUrl);

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );

      // Store secret temporarily (not verified yet)
      const existing = await db
        .select()
        .from(userSecurity)
        .where(eq(userSecurity.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(userSecurity).values({
          userId,
          twoFactorSecret: secret,
          twoFactorBackupCodes: backupCodes,
          twoFactorEnabled: false, // Not enabled until verified
        });
      } else {
        await db
          .update(userSecurity)
          .set({
            twoFactorSecret: secret,
            twoFactorBackupCodes: backupCodes,
            updatedAt: new Date(),
          })
          .where(eq(userSecurity.userId, userId));
      }

      logger.info(`Generated 2FA secret for user ${userId}`);

      return {
        success: true,
        secret,
        qrCode,
        backupCodes,
        message: 'Scan the QR code with your authenticator app',
      };
    } catch (error) {
      logger.error('Failed to setup 2FA:', error);
      return reply.status(500).send({ error: 'Failed to setup 2FA' });
    }
  });

  // Enable 2FA - Step 2: Verify code and enable
  fastify.post('/2fa/enable', {
    preHandler: authenticateToken,
    schema: {
      description: 'Verify 2FA code and enable 2FA',
      tags: ['security'],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = Verify2FASchema.parse(request.body);

      // Get secret
      const security = await db
        .select()
        .from(userSecurity)
        .where(eq(userSecurity.userId, userId))
        .limit(1);

      if (security.length === 0 || !security[0].twoFactorSecret) {
        return reply.status(400).send({ 
          error: '2FA not setup',
          message: 'Please call /2fa/setup first'
        });
      }

      // Verify code
      const isValid = authenticator.verify({
        token: body.code,
        secret: security[0].twoFactorSecret,
      });

      if (!isValid) {
        return reply.status(400).send({ 
          error: 'Invalid code',
          message: 'The verification code is incorrect'
        });
      }

      // Enable 2FA
      await db
        .update(userSecurity)
        .set({
          twoFactorEnabled: true,
          twoFactorVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userSecurity.userId, userId));

      logger.info(`Enabled 2FA for user ${userId}`);

      return {
        success: true,
        message: '2FA enabled successfully',
      };
    } catch (error) {
      logger.error('Failed to enable 2FA:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to enable 2FA' });
    }
  });

  // Disable 2FA
  fastify.post('/2fa/disable', {
    preHandler: authenticateToken,
    schema: {
      description: 'Disable 2FA',
      tags: ['security'],
      body: {
        type: 'object',
        required: ['password', 'code'],
        properties: {
          password: { type: 'string' },
          code: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = Disable2FASchema.parse(request.body);

      // Get secret
      const security = await db
        .select()
        .from(userSecurity)
        .where(eq(userSecurity.userId, userId))
        .limit(1);

      if (security.length === 0 || !security[0].twoFactorEnabled) {
        return reply.status(400).send({ 
          error: '2FA not enabled',
          message: '2FA is not currently enabled'
        });
      }

      // Verify password (skip for OAuth-only users who have no password hash)
      const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (dbUser?.password) {
        const isPasswordValid = await bcrypt.compare(body.password, dbUser.password);
        if (!isPasswordValid) {
          return reply.status(401).send({ error: 'Invalid password', message: 'Password verification failed' });
        }
      }

      // Verify TOTP code
      const isValid = authenticator.verify({
        token: body.code,
        secret: security[0].twoFactorSecret!,
      });

      if (!isValid) {
        return reply.status(400).send({
          error: 'Invalid code',
          message: 'The verification code is incorrect'
        });
      }

      // Disable 2FA
      await db
        .update(userSecurity)
        .set({
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
          twoFactorVerifiedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(userSecurity.userId, userId));

      logger.info(`Disabled 2FA for user ${userId}`);

      return {
        success: true,
        message: '2FA disabled successfully',
      };
    } catch (error) {
      logger.error('Failed to disable 2FA:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to disable 2FA' });
    }
  });

  // Verify 2FA code (for login)
  fastify.post('/2fa/verify', {
    preHandler: authenticateToken,
    schema: {
      description: 'Verify 2FA code',
      tags: ['security'],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = Verify2FASchema.parse(request.body);

      const security = await db
        .select()
        .from(userSecurity)
        .where(eq(userSecurity.userId, userId))
        .limit(1);

      if (security.length === 0 || !security[0].twoFactorEnabled || !security[0].twoFactorSecret) {
        return reply.status(400).send({ 
          error: '2FA not enabled',
        });
      }

      // Verify code
      const isValid = authenticator.verify({
        token: body.code,
        secret: security[0].twoFactorSecret,
      });

      if (!isValid) {
        // Check backup codes
        const backupCodes = security[0].twoFactorBackupCodes as string[] || [];
        const backupCodeMatch = backupCodes.find(code => code === body.code);

        if (backupCodeMatch) {
          // Remove used backup code
          const remainingCodes = backupCodes.filter(code => code !== body.code);
          await db
            .update(userSecurity)
            .set({
              twoFactorBackupCodes: remainingCodes,
              updatedAt: new Date(),
            })
            .where(eq(userSecurity.userId, userId));

          logger.info(`User ${userId} used backup code`);

          if ((request as any).user.role === 'pending_2fa') {
            const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
            if (!dbUser) {
              return reply.status(404).send({ error: 'User not found' });
            }

            const accessToken = generateToken({
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name,
              role: dbUser.role || 'casual'
            });
            const refreshToken = generateRefreshToken({
              id: dbUser.id,
              email: dbUser.email
            });

            return {
              success: true,
              verified: true,
              usedBackupCode: true,
              remainingBackupCodes: remainingCodes.length,
              token: accessToken,
              refreshToken,
              user: {
                id: dbUser.id,
                email: dbUser.email,
                name: dbUser.name,
                avatar: dbUser.avatar,
                role: dbUser.role || 'casual',
                subscriptionTier: dbUser.subscriptionTier || 'free',
                usageStats: dbUser.usageStats || {
                  totalTokens: 0,
                  totalRequests: 0,
                  totalFiles: 0,
                  lastReset: new Date().toISOString(),
                },
                createdAt: dbUser.createdAt.toISOString(),
                updatedAt: dbUser.updatedAt.toISOString(),
              }
            };
          }

          return {
            success: true,
            verified: true,
            usedBackupCode: true,
            remainingBackupCodes: remainingCodes.length,
          };
        }

        return reply.status(400).send({ 
          error: 'Invalid code',
          verified: false,
        });
      }

      if ((request as any).user.role === 'pending_2fa') {
        const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!dbUser) {
          return reply.status(404).send({ error: 'User not found' });
        }

        const accessToken = generateToken({
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role || 'casual'
        });
        const refreshToken = generateRefreshToken({
          id: dbUser.id,
          email: dbUser.email
        });

        return {
          success: true,
          verified: true,
          token: accessToken,
          refreshToken,
          user: {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            avatar: dbUser.avatar,
            role: dbUser.role || 'casual',
            subscriptionTier: dbUser.subscriptionTier || 'free',
            usageStats: dbUser.usageStats || {
              totalTokens: 0,
              totalRequests: 0,
              totalFiles: 0,
              lastReset: new Date().toISOString(),
            },
            createdAt: dbUser.createdAt.toISOString(),
            updatedAt: dbUser.updatedAt.toISOString(),
          }
        };
      }

      return {
        success: true,
        verified: true,
      };
    } catch (error) {
      logger.error('Failed to verify 2FA code:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to verify 2FA code' });
    }
  });

  // Get active sessions
  fastify.get('/sessions', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get active sessions for user',
      tags: ['security']
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;

      const security = await db
        .select()
        .from(userSecurity)
        .where(eq(userSecurity.userId, userId))
        .limit(1);

      if (security.length === 0) {
        return { sessions: [] };
      }

      const activeSessions = security[0].activeSessions || [];

      return {
        sessions: activeSessions,
        lastLogin: security[0].lastLoginAt,
        lastLoginIp: security[0].lastLoginIp,
      };
    } catch (error) {
      logger.error('Failed to fetch active sessions:', error);
      return reply.status(500).send({ error: 'Failed to fetch active sessions' });
    }
  });

  // Revoke session
  fastify.delete('/sessions/:sessionId', {
    preHandler: authenticateToken,
    schema: {
      description: 'Revoke an active session',
      tags: ['security'],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const userId = (request as any).user.id;

    try {
      const security = await db
        .select()
        .from(userSecurity)
        .where(eq(userSecurity.userId, userId))
        .limit(1);

      if (security.length === 0) {
        return reply.status(404).send({ error: 'Security settings not found' });
      }

      const activeSessions = (security[0].activeSessions as any[]) || [];
      const filteredSessions = activeSessions.filter((s: any) => s.token !== sessionId);

      await db
        .update(userSecurity)
        .set({
          activeSessions: filteredSessions,
          updatedAt: new Date(),
        })
        .where(eq(userSecurity.userId, userId));

      logger.info(`Revoked session ${sessionId} for user ${userId}`);

      return {
        success: true,
        message: 'Session revoked successfully',
      };
    } catch (error) {
      logger.error(`Failed to revoke session ${sessionId}:`, error);
      return reply.status(500).send({ error: 'Failed to revoke session' });
    }
  });

  // Update last login
  fastify.post('/login-tracked', {
    preHandler: authenticateToken,
    schema: {
      description: 'Update last login information',
      tags: ['security']
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const ipAddress = request.headers['x-forwarded-for'] as string ||
                       request.headers['x-real-ip'] as string ||
                       request.ip;

      // Check if security record exists
      const existing = await db
        .select()
        .from(userSecurity)
        .where(eq(userSecurity.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(userSecurity).values({
          userId,
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress,
        });
      } else {
        await db
          .update(userSecurity)
          .set({
            lastLoginAt: new Date(),
            lastLoginIp: ipAddress,
            failedLoginAttempts: 0, // Reset failed attempts on successful login
            updatedAt: new Date(),
          })
          .where(eq(userSecurity.userId, userId));
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to update login tracking:', error);
      return reply.status(500).send({ error: 'Failed to update login tracking' });
    }
  });
}
