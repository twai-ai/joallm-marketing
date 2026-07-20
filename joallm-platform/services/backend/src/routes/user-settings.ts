import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { db } from '../database/connection.js';
import { users, userPreferences } from '../database/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireTierFeature } from '../middleware/subscription.js';
import { encryptApiKeys, decryptApiKeys, maskSensitiveData } from '../utils/encryption.js';

const ApiKeysSchema = z.object({
  openai: z.string().optional(),
  anthropic: z.string().optional(),
  groq: z.string().optional(),
  cohere: z.string().optional(),
  ollama: z.string().optional(),
});

const UpdateApiKeysSchema = z.object({
  apiKeys: ApiKeysSchema,
});

export async function userSettingsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Get user's API keys
  fastify.get('/api-keys', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get user API keys',
      tags: ['user-settings'],
      response: {
        200: {
          type: 'object',
          properties: {
            apiKeys: {
              type: 'object',
              properties: {
                openai: { type: 'string' },
                anthropic: { type: 'string' },
                groq: { type: 'string' },
                cohere: { type: 'string' },
                ollama: { type: 'string' },
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      
      const user = await db
        .select({ apiKeys: users.apiKeys })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const encryptedKeys = user[0].apiKeys as Record<string, string> || {};
      
      // Decrypt API keys
      const decryptedKeys = decryptApiKeys(encryptedKeys);
      
      // Mask API keys for security
      const maskedKeys = Object.entries(decryptedKeys).reduce((acc, [key, value]) => {
        if (value) {
          acc[key] = maskSensitiveData(value);
        }
        return acc;
      }, {} as Record<string, string>);

      return { apiKeys: maskedKeys };
    } catch (error) {
      logger.error('Failed to get user API keys:', error);
      return reply.status(500).send({ error: 'Failed to retrieve API keys' });
    }
  });

  // Update user's API keys
  fastify.put('/api-keys', {
    preHandler: authenticateToken,
    schema: {
      description: 'Update user API keys',
      tags: ['user-settings'],
      body: {
        type: 'object',
        properties: {
          apiKeys: {
            type: 'object',
            properties: {
              openai: { type: 'string' },
              anthropic: { type: 'string' },
              groq: { type: 'string' },
              cohere: { type: 'string' },
              ollama: { type: 'string' }
            }
          }
        },
        required: ['apiKeys']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const { apiKeys } = request.body as z.infer<typeof UpdateApiKeysSchema>;

      // Validate API keys format
      const validatedKeys = ApiKeysSchema.parse(apiKeys);

      // Encrypt API keys before storing
      const encryptedKeys = encryptApiKeys(validatedKeys as Record<string, string>);

      // Update user's API keys
      await db
        .update(users)
        .set({ 
          apiKeys: encryptedKeys,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // Log with masked keys
      const maskedLog = Object.entries(validatedKeys).reduce((acc, [key, value]) => {
        if (value) acc[key] = maskSensitiveData(value);
        return acc;
      }, {} as Record<string, string>);
      
      logger.info(`Updated API keys for user ${userId}:`, maskedLog);

      return { 
        success: true, 
        message: 'API keys updated successfully' 
      };
    } catch (error) {
      logger.error('Failed to update user API keys:', error);
      return reply.status(500).send({ error: 'Failed to update API keys' });
    }
  });

  // Delete specific provider API key
  fastify.delete('/api-keys/:provider', {
    preHandler: authenticateToken,
    schema: {
      description: 'Delete specific provider API key',
      tags: ['user-settings'],
      params: {
        type: 'object',
        properties: {
          provider: { 
            type: 'string',
            enum: ['openai', 'anthropic', 'groq', 'cohere', 'ollama']
          }
        },
        required: ['provider']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { provider } = request.params as { provider: string };

    try {
      const userId = (request as any).user.id;

      // Get current API keys
      const user = await db
        .select({ apiKeys: users.apiKeys })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const currentKeys = user[0].apiKeys || {};
      
      // Remove the specific provider key
      delete currentKeys[provider as keyof typeof currentKeys];

      // Update user's API keys
      await db
        .update(users)
        .set({ 
          apiKeys: currentKeys,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      logger.info(`Deleted ${provider} API key for user ${userId}`);

      return { 
        success: true, 
        message: `${provider} API key deleted successfully` 
      };
    } catch (error) {
      logger.error(`Failed to delete ${provider} API key:`, error);
      return reply.status(500).send({ error: 'Failed to delete API key' });
    }
  });

  // Export all user data
  fastify.get('/export', {
    preHandler: [authenticateToken, requireTierFeature('canExportData')],
    schema: {
      description: 'Export all user data',
      tags: ['user-settings'],
      response: {
        200: {
          type: 'object',
          properties: {
            export: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;

      // Import necessary tables
      const { chatSessions, messages, files, workflows, workflowExecutions, 
              bookmarks, userPreferences, ragSearchSessions, ragSearchQueries } = await import('../database/schema.js');

      // Fetch all user data
      const [user, sessions, userFiles, userWorkflows, executions, userBookmarks, preferences, searchSessions] =
        await Promise.all([
          db.select().from(users).where(eq(users.id, userId)).limit(1),
          db.select().from(chatSessions).where(eq(chatSessions.userId, userId)),
          db.select().from(files).where(eq(files.userId, userId)),
          db.select().from(workflows).where(eq(workflows.userId, userId)),
          db.select().from(workflowExecutions).where(eq(workflowExecutions.userId, userId)),
          db.select().from(bookmarks).where(eq(bookmarks.userId, userId)),
          db.select().from(userPreferences).where(eq(userPreferences.userId, userId)),
          db.select().from(ragSearchSessions).where(eq(ragSearchSessions.userId, userId)),
        ]);

      // Fetch messages via the user's chat sessions
      const sessionIds = sessions.map(s => s.id);
      const allMessages = sessionIds.length > 0
        ? await db.select().from(messages).where(inArray(messages.sessionId, sessionIds))
        : [];

      // Fetch RAG queries via the user's search sessions
      const searchSessionIds = searchSessions.map(s => s.id);
      const searchQueries = searchSessionIds.length > 0
        ? await db.select().from(ragSearchQueries).where(inArray(ragSearchQueries.sessionId, searchSessionIds))
        : [];

      const exportData = {
        exportedAt: new Date().toISOString(),
        user: user[0],
        chatSessions: sessions,
        messages: allMessages,
        files: userFiles,
        workflows: userWorkflows,
        workflowExecutions: executions,
        bookmarks: userBookmarks,
        preferences: preferences[0] || null,
        searchSessions: searchSessions,
        searchQueries: searchQueries,
        statistics: {
          totalChatSessions: sessions.length,
          totalMessages: allMessages.length,
          totalFiles: userFiles.length,
          totalWorkflows: userWorkflows.length,
          totalBookmarks: userBookmarks.length,
        }
      };

      logger.info(`Exported data for user ${userId}`);

      // Set headers for file download
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="joallm-data-export-${Date.now()}.json"`);

      return exportData;
    } catch (error) {
      logger.error('Failed to export user data:', error);
      return reply.status(500).send({ error: 'Failed to export data' });
    }
  });

  // Get storage configuration for the user
  fastify.get('/storage', {
    preHandler: authenticateToken,
    schema: { description: 'Get user storage provider preference', tags: ['user-settings'] }
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    try {
      const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
      const storageConfig = (prefs?.customShortcuts as any)?.storage ?? { provider: 'volume' };
      return reply.send({ storage: storageConfig });
    } catch (error) {
      logger.error('Failed to get storage config:', error);
      return reply.status(500).send({ error: 'Failed to get storage config' });
    }
  });

  // Update storage provider preference (cloud storage requires pro+)
  fastify.put('/storage', {
    preHandler: [authenticateToken, requireTierFeature('canUseCloudStorage')],
    schema: {
      description: 'Update user storage provider preference',
      tags: ['user-settings'],
      body: {
        type: 'object',
        required: ['provider'],
        properties: {
          provider: { type: 'string', enum: ['volume', 'cloudflare-r2', 'aws-s3'] },
          // Provider-specific credentials stored per-user (encrypted at rest)
          r2AccountId: { type: 'string' },
          r2AccessKeyId: { type: 'string' },
          r2SecretAccessKey: { type: 'string' },
          r2BucketName: { type: 'string' },
          s3BucketName: { type: 'string' },
          s3Region: { type: 'string' },
          s3AccessKeyId: { type: 'string' },
          s3SecretAccessKey: { type: 'string' },
        }
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const body = request.body as Record<string, string>;
    try {
      const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
      const currentCustom = (existing?.customShortcuts as any) ?? {};

      const storageConfig = { provider: body.provider };
      // Store non-secret config; sensitive credentials go through the API keys mechanism
      const updated = { ...currentCustom, storage: storageConfig };

      if (existing) {
        await db.update(userPreferences).set({ customShortcuts: updated, updatedAt: new Date() }).where(eq(userPreferences.userId, userId));
      } else {
        await db.insert(userPreferences).values({ userId, customShortcuts: updated });
      }

      logger.info(`User ${userId} set storage provider to ${body.provider}`);
      return reply.send({ success: true, storage: storageConfig });
    } catch (error) {
      logger.error('Failed to update storage config:', error);
      return reply.status(500).send({ error: 'Failed to update storage config' });
    }
  });
}
