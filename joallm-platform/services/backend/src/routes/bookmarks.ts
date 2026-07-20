import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { db } from '../database/connection.js';
import { bookmarks } from '../database/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';

// Validation schemas
const CreateBookmarkSchema = z.object({
  itemType: z.enum(['message', 'chat_session', 'file', 'workflow', 'search_result']),
  itemId: z.string().uuid(),
  title: z.string().optional(),
  notes: z.string().optional(),
});

const UpdateBookmarkSchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
});

export async function bookmarksRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Get all bookmarks for user
  fastify.get('/', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get all bookmarks for the authenticated user',
      tags: ['bookmarks'],
      querystring: {
        type: 'object',
        properties: {
          type: { 
            type: 'string',
            enum: ['message', 'chat_session', 'file', 'workflow', 'search_result']
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const { type } = request.query as { type?: string };

      let query = db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.userId, userId));

      if (type) {
        query = db
          .select()
          .from(bookmarks)
          .where(and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.itemType, type as any)
          ));
      }

      const userBookmarks = await query.orderBy(desc(bookmarks.createdAt));

      return { bookmarks: userBookmarks };
    } catch (error) {
      logger.error('Failed to fetch bookmarks:', error);
      return reply.status(500).send({ error: 'Failed to fetch bookmarks' });
    }
  });

  // Get bookmark counts by type
  fastify.get('/count', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get bookmark counts by type',
      tags: ['bookmarks']
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;

      const allBookmarks = await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.userId, userId));

      const counts = allBookmarks.reduce((acc, bookmark) => {
        acc[bookmark.itemType] = (acc[bookmark.itemType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: allBookmarks.length,
        byType: counts,
      };
    } catch (error) {
      logger.error('Failed to fetch bookmark counts:', error);
      return reply.status(500).send({ error: 'Failed to fetch bookmark counts' });
    }
  });

  // Create bookmark
  fastify.post('/', {
    preHandler: authenticateToken,
    schema: {
      description: 'Create a new bookmark',
      tags: ['bookmarks'],
      body: {
        type: 'object',
        required: ['itemType', 'itemId'],
        properties: {
          itemType: { 
            type: 'string',
            enum: ['message', 'chat_session', 'file', 'workflow', 'search_result']
          },
          itemId: { type: 'string' },
          title: { type: 'string' },
          notes: { type: 'string' },
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = CreateBookmarkSchema.parse(request.body);

      // Check if bookmark already exists
      const existing = await db
        .select()
        .from(bookmarks)
        .where(and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.itemType, body.itemType),
          eq(bookmarks.itemId, body.itemId)
        ))
        .limit(1);

      if (existing.length > 0) {
        return reply.status(409).send({ 
          error: 'Bookmark already exists',
          bookmark: existing[0]
        });
      }

      const [newBookmark] = await db
        .insert(bookmarks)
        .values({
          userId,
          itemType: body.itemType,
          itemId: body.itemId,
          title: body.title,
          notes: body.notes,
        })
        .returning();

      logger.info(`Created bookmark: ${newBookmark.id} for user ${userId}`);

      return reply.status(201).send({
        success: true,
        bookmark: newBookmark,
      });
    } catch (error) {
      logger.error('Failed to create bookmark:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to create bookmark' });
    }
  });

  // Update bookmark
  fastify.put('/:bookmarkId', {
    preHandler: authenticateToken,
    schema: {
      description: 'Update a bookmark',
      tags: ['bookmarks'],
      params: {
        type: 'object',
        properties: {
          bookmarkId: { type: 'string' }
        },
        required: ['bookmarkId']
      }
    }
  }, async (request, reply) => {
    const { bookmarkId } = request.params as { bookmarkId: string };
    const userId = (request as any).user.id;

    try {
      const body = UpdateBookmarkSchema.parse(request.body);

      // Verify ownership
      const existing = await db
        .select()
        .from(bookmarks)
        .where(and(
          eq(bookmarks.id, bookmarkId),
          eq(bookmarks.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Bookmark not found' });
      }

      const [updatedBookmark] = await db
        .update(bookmarks)
        .set(body)
        .where(eq(bookmarks.id, bookmarkId))
        .returning();

      logger.info(`Updated bookmark: ${bookmarkId}`);

      return { success: true, bookmark: updatedBookmark };
    } catch (error) {
      logger.error(`Failed to update bookmark ${bookmarkId}:`, error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to update bookmark' });
    }
  });

  // Delete bookmark
  fastify.delete('/:bookmarkId', {
    preHandler: authenticateToken,
    schema: {
      description: 'Delete a bookmark',
      tags: ['bookmarks'],
      params: {
        type: 'object',
        properties: {
          bookmarkId: { type: 'string' }
        },
        required: ['bookmarkId']
      }
    }
  }, async (request, reply) => {
    const { bookmarkId } = request.params as { bookmarkId: string };
    const userId = (request as any).user.id;

    try {
      // Verify ownership
      const existing = await db
        .select()
        .from(bookmarks)
        .where(and(
          eq(bookmarks.id, bookmarkId),
          eq(bookmarks.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Bookmark not found' });
      }

      await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId));

      logger.info(`Deleted bookmark: ${bookmarkId}`);

      return { success: true, message: 'Bookmark deleted successfully' };
    } catch (error) {
      logger.error(`Failed to delete bookmark ${bookmarkId}:`, error);
      return reply.status(500).send({ error: 'Failed to delete bookmark' });
    }
  });

  // Check if item is bookmarked
  fastify.get('/check/:itemType/:itemId', {
    preHandler: authenticateToken,
    schema: {
      description: 'Check if an item is bookmarked',
      tags: ['bookmarks'],
      params: {
        type: 'object',
        properties: {
          itemType: { 
            type: 'string',
            enum: ['message', 'chat_session', 'file', 'workflow', 'search_result']
          },
          itemId: { type: 'string' }
        },
        required: ['itemType', 'itemId']
      }
    }
  }, async (request, reply) => {
    const { itemType, itemId } = request.params as { itemType: string; itemId: string };
    const userId = (request as any).user.id;

    try {
      const bookmark = await db
        .select()
        .from(bookmarks)
        .where(and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.itemType, itemType as any),
          eq(bookmarks.itemId, itemId)
        ))
        .limit(1);

      return {
        isBookmarked: bookmark.length > 0,
        bookmark: bookmark.length > 0 ? bookmark[0] : null,
      };
    } catch (error) {
      logger.error(`Failed to check bookmark status for ${itemType}:${itemId}:`, error);
      return reply.status(500).send({ error: 'Failed to check bookmark status' });
    }
  });
}

