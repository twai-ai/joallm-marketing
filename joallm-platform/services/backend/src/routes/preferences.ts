import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { db } from '../database/connection.js';
import { userPreferences } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';

// Validation schemas
const UpdatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  compactMode: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  notificationFrequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).optional(),
  analyticsEnabled: z.boolean().optional(),
  errorReporting: z.boolean().optional(),
  autoSave: z.boolean().optional(),
  streamingEnabled: z.boolean().optional(),
  keyboardShortcutsEnabled: z.boolean().optional(),
  customShortcuts: z.record(z.any()).optional(),
  defaultModel: z.string().optional(),
  defaultTemperature: z.number().min(0).max(2).optional(),
  defaultMaxTokens: z.number().int().min(1).max(100000).optional(),
  workspaceMode: z.enum(['personal', 'team', 'enterprise']).optional(),
  multimodalSettings: z.object({
    enabledCapabilities: z.array(z.enum(['vision', 'speech', 'document_intelligence', 'multimodal_reasoning'])).optional(),
    routing: z.object({
      vision: z.object({
        primaryProvider: z.enum(['platform_default', 'openai', 'anthropic', 'groq', 'cohere', 'ollama']),
        fallbackProviders: z.array(z.enum(['openai', 'anthropic', 'groq', 'cohere', 'ollama'])),
        processingMode: z.enum(['analyze_directly', 'extract_first', 'add_to_knowledge', 'route_to_workflow']),
      }).optional(),
      speech: z.object({
        primaryProvider: z.enum(['platform_default', 'openai', 'anthropic', 'groq', 'cohere', 'ollama']),
        fallbackProviders: z.array(z.enum(['openai', 'anthropic', 'groq', 'cohere', 'ollama'])),
        processingMode: z.enum(['analyze_directly', 'extract_first', 'add_to_knowledge', 'route_to_workflow']),
      }).optional(),
      document_intelligence: z.object({
        primaryProvider: z.enum(['platform_default', 'openai', 'anthropic', 'groq', 'cohere', 'ollama']),
        fallbackProviders: z.array(z.enum(['openai', 'anthropic', 'groq', 'cohere', 'ollama'])),
        processingMode: z.enum(['analyze_directly', 'extract_first', 'add_to_knowledge', 'route_to_workflow']),
      }).optional(),
      multimodal_reasoning: z.object({
        primaryProvider: z.enum(['platform_default', 'openai', 'anthropic', 'groq', 'cohere', 'ollama']),
        fallbackProviders: z.array(z.enum(['openai', 'anthropic', 'groq', 'cohere', 'ollama'])),
        processingMode: z.enum(['analyze_directly', 'extract_first', 'add_to_knowledge', 'route_to_workflow']),
      }).optional(),
    }).optional(),
  }).optional(),
});

const UpdateThemeSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']),
});

const UpdateShortcutsSchema = z.object({
  customShortcuts: z.record(z.any()),
});

export async function preferencesRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Get user preferences
  fastify.get('/', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get user preferences',
      tags: ['preferences']
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;

      let preferences = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      // If no preferences exist, create default ones
      if (preferences.length === 0) {
        const [newPreferences] = await db
          .insert(userPreferences)
          .values({
            userId,
          })
          .returning();
        
        preferences = [newPreferences];
        logger.info(`Created default preferences for user ${userId}`);
      }

      return { preferences: preferences[0] };
    } catch (error) {
      logger.error('Failed to fetch user preferences:', error);
      return reply.status(500).send({ error: 'Failed to fetch preferences' });
    }
  });

  // Update user preferences
  fastify.put('/', {
    preHandler: authenticateToken,
    schema: {
      description: 'Update user preferences',
      tags: ['preferences'],
      body: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
          fontSize: { type: 'string', enum: ['small', 'medium', 'large'] },
          compactMode: { type: 'boolean' },
          emailNotifications: { type: 'boolean' },
          pushNotifications: { type: 'boolean' },
          notificationFrequency: { type: 'string', enum: ['immediate', 'hourly', 'daily', 'weekly'] },
          analyticsEnabled: { type: 'boolean' },
          errorReporting: { type: 'boolean' },
          autoSave: { type: 'boolean' },
          streamingEnabled: { type: 'boolean' },
          keyboardShortcutsEnabled: { type: 'boolean' },
          customShortcuts: { type: 'object' },
          defaultModel: { type: 'string' },
          defaultTemperature: { type: 'number' },
          defaultMaxTokens: { type: 'integer' },
          workspaceMode: { type: 'string', enum: ['personal', 'team', 'enterprise'] },
          multimodalSettings: {
            type: 'object',
            properties: {
              enabledCapabilities: {
                type: 'array',
                items: { type: 'string', enum: ['vision', 'speech', 'document_intelligence', 'multimodal_reasoning'] },
              },
              routing: {
                type: 'object',
                properties: {
                  vision: { type: 'object' },
                  speech: { type: 'object' },
                  document_intelligence: { type: 'object' },
                  multimodal_reasoning: { type: 'object' },
                },
              },
            },
          },
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = UpdatePreferencesSchema.parse(request.body);

      // Check if preferences exist
      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      let updated;

      if (existing.length === 0) {
        // Create new preferences
        [updated] = await db
          .insert(userPreferences)
          .values({
            userId,
            ...body,
          })
          .returning();
      } else {
        // Update existing preferences
        [updated] = await db
          .update(userPreferences)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, userId))
          .returning();
      }

      logger.info(`Updated preferences for user ${userId}`);

      return {
        success: true,
        preferences: updated,
      };
    } catch (error) {
      logger.error('Failed to update preferences:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to update preferences' });
    }
  });

  // Update theme only (quick update)
  fastify.patch('/theme', {
    preHandler: authenticateToken,
    schema: {
      description: 'Update theme preference only',
      tags: ['preferences'],
      body: {
        type: 'object',
        required: ['theme'],
        properties: {
          theme: { type: 'string', enum: ['light', 'dark', 'auto'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = UpdateThemeSchema.parse(request.body);

      // Check if preferences exist
      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      let updated;

      if (existing.length === 0) {
        // Create new preferences with theme
        [updated] = await db
          .insert(userPreferences)
          .values({
            userId,
            theme: body.theme,
          })
          .returning();
      } else {
        // Update theme
        [updated] = await db
          .update(userPreferences)
          .set({
            theme: body.theme,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, userId))
          .returning();
      }

      logger.info(`Updated theme to ${body.theme} for user ${userId}`);

      return {
        success: true,
        theme: updated.theme,
      };
    } catch (error) {
      logger.error('Failed to update theme:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to update theme' });
    }
  });

  // Update keyboard shortcuts only
  fastify.patch('/shortcuts', {
    preHandler: authenticateToken,
    schema: {
      description: 'Update keyboard shortcuts',
      tags: ['preferences'],
      body: {
        type: 'object',
        required: ['customShortcuts'],
        properties: {
          customShortcuts: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = UpdateShortcutsSchema.parse(request.body);

      // Check if preferences exist
      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      let updated;

      if (existing.length === 0) {
        // Create new preferences with shortcuts
        [updated] = await db
          .insert(userPreferences)
          .values({
            userId,
            customShortcuts: body.customShortcuts,
          })
          .returning();
      } else {
        // Update shortcuts
        [updated] = await db
          .update(userPreferences)
          .set({
            customShortcuts: body.customShortcuts,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, userId))
          .returning();
      }

      logger.info(`Updated keyboard shortcuts for user ${userId}`);

      return {
        success: true,
        customShortcuts: updated.customShortcuts,
      };
    } catch (error) {
      logger.error('Failed to update shortcuts:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to update shortcuts' });
    }
  });

  // Reset preferences to default
  fastify.post('/reset', {
    preHandler: authenticateToken,
    schema: {
      description: 'Reset preferences to default values',
      tags: ['preferences']
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;

      // Delete existing preferences (will be recreated with defaults on next get)
      await db.delete(userPreferences).where(eq(userPreferences.userId, userId));

      logger.info(`Reset preferences for user ${userId}`);

      return {
        success: true,
        message: 'Preferences reset to defaults',
      };
    } catch (error) {
      logger.error('Failed to reset preferences:', error);
      return reply.status(500).send({ error: 'Failed to reset preferences' });
    }
  });
}
