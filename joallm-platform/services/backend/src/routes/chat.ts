import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { llmService } from '../services/llm-providers.js';
import { ragService } from '../services/rag-service.js';
import { db } from '../database/connection.js';
import { messages, chatSessions, users, apiUsage, files, documentChunks } from '../database/schema.js';
import { eq, desc, or, sql, like, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { generateUniqueShortId, isValidShortId } from '../utils/short-id.js';
import { decryptApiKeys } from '../utils/encryption.js';
import { calculateCost } from '../utils/cost-calculator.js';
import { optionalAuth, authenticateToken, requirePermission } from '../middleware/auth.js';
import { requireModelForTier } from '../middleware/subscription.js';
import { runChat } from '../application/chat/chat-orchestrator.js';
import { adaptiveChunker } from '../services/adaptive-chunker.js';

// Helper function to fetch user API keys
async function getUserApiKeys(userId: string) {
  try {
    logger.info('getUserApiKeys called with userId:', userId);
    
    const user = await db
      .select({ apiKeys: users.apiKeys })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const encryptedKeys = user[0]?.apiKeys as Record<string, string> || {};
    const apiKeys = decryptApiKeys(encryptedKeys);
    logger.info('getUserApiKeys result:', { userId, keysCount: Object.keys(apiKeys).length });
    
    return apiKeys;
  } catch (error) {
    logger.error('Failed to fetch user API keys:', error);
    return {};
  }
}

const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
  model: z.string().optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'file']),
    name: z.string(),
    url: z.string()
  })).optional(),
  isStreaming: z.boolean().optional()
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  model: z.string(),
  selectedDocumentIds: z.array(z.string()).optional(),
  parameters: z.object({
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(100000).default(2048),
    topP: z.number().min(0).max(1).default(1.0),
    frequencyPenalty: z.number().min(-2).max(2).default(0.0),
    presencePenalty: z.number().min(-2).max(2).default(0.0)
  }).optional(),
  stream: z.boolean().default(false),
  sessionId: z.string().optional()
});

const SaveMessageToKnowledgeSchema = z.object({
  title: z.string().min(1).max(120).optional(),
});

async function resolveAccessibleDocumentIds(userId: string | undefined, selectedDocumentIds: string[] | undefined): Promise<string[]> {
  if (!userId || !selectedDocumentIds || selectedDocumentIds.length === 0) {
    return [];
  }

  try {
    const accessibleFiles = await db
      .select({ id: files.id })
      .from(files)
      .where(and(
        eq(files.userId, userId),
        sql`${files.id} = ANY(${sql.raw(`ARRAY[${selectedDocumentIds.map(id => `'${id}'`).join(',')}]::uuid[]`)})`
      ));

    return accessibleFiles.map((file) => file.id).filter(Boolean) as string[];
  } catch (error) {
    logger.warn('Failed to resolve selected chat document context:', error);
    return [];
  }
}

async function injectSelectedDocumentContext(
  requestMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; attachments?: Array<{ type: 'image' | 'file'; name: string; url: string }>; timestamp: string; model?: string; id: string }>,
  accessibleDocumentIds: string[]
) {
  if (accessibleDocumentIds.length === 0 || requestMessages.length === 0) {
    return { llmMessages: requestMessages.map((msg) => ({ ...msg })), metadata: undefined as Record<string, any> | undefined };
  }

  const latestUserIndex = [...requestMessages].reverse().findIndex((message) => message.role === 'user');
  if (latestUserIndex === -1) {
    return { llmMessages: requestMessages.map((msg) => ({ ...msg })), metadata: undefined as Record<string, any> | undefined };
  }

  const actualUserIndex = requestMessages.length - 1 - latestUserIndex;
  const latestUserMessage = requestMessages[actualUserIndex];

  try {
    const results = await ragService.search({
      query: latestUserMessage.content,
      fileIds: accessibleDocumentIds,
      limit: 4,
      threshold: 0.1,
      includeMetadata: true,
    });

    if (results.length === 0) {
      return {
        llmMessages: requestMessages.map((msg) => ({ ...msg })),
        metadata: {
          selectedDocumentIds: accessibleDocumentIds,
          selectedDocumentCount: accessibleDocumentIds.length,
          ragContextApplied: false,
          ragResultCount: 0,
        },
      };
    }

    const contextBlock = results
      .map((result, index) => `[Source ${index + 1}: ${result.file.filename}]\n${result.content}`)
      .join('\n\n');

    const llmMessages = requestMessages.map((message, index) => {
      if (index !== actualUserIndex) {
        return { ...message };
      }

      return {
        ...message,
        content: `${message.content}\n\nKnowledge base context from selected documents:\n${contextBlock}\n\nUse the context above when it is relevant. If the context is insufficient, say so clearly instead of assuming unsupported facts.`,
      };
    });

    return {
      llmMessages,
      metadata: {
        selectedDocumentIds: accessibleDocumentIds,
        selectedDocumentCount: accessibleDocumentIds.length,
        ragContextApplied: true,
        ragResultCount: results.length,
        ragSources: results.map((result) => ({
          fileId: result.file.id,
          filename: result.file.filename,
          score: result.score,
          chunkIndex: result.metadata.chunkIndex,
        })),
      },
    };
  } catch (error) {
    logger.warn('Failed to inject selected document context into chat:', error);
    return {
      llmMessages: requestMessages.map((msg) => ({ ...msg })),
      metadata: {
        selectedDocumentIds: accessibleDocumentIds,
        selectedDocumentCount: accessibleDocumentIds.length,
        ragContextApplied: false,
        ragError: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function chatRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post('/messages/:messageId/save-to-knowledge', {
    preHandler: [authenticateToken as any, requirePermission('knowledge.write')],
    schema: {
      description: 'Save a chat message into the knowledge base as a text document',
      tags: ['chat'],
      params: {
        type: 'object',
        properties: {
          messageId: { type: 'string' },
        },
        required: ['messageId'],
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request as any).user.id;

    try {
      const body = SaveMessageToKnowledgeSchema.parse(request.body ?? {});

      const [messageRecord] = await db
        .select({
          id: messages.id,
          sessionId: messages.sessionId,
          role: messages.role,
          content: messages.content,
          createdAt: messages.createdAt,
          sessionTitle: chatSessions.title,
          sessionUserId: chatSessions.userId,
        })
        .from(messages)
        .leftJoin(chatSessions, eq(messages.sessionId, chatSessions.id))
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!messageRecord) {
        return reply.status(404).send({ error: 'Message not found' });
      }

      if (messageRecord.sessionUserId && messageRecord.sessionUserId !== userId) {
        return reply.status(403).send({ error: 'Access denied', message: 'You do not own this message' });
      }

      const rawTitle = body.title?.trim() || `${messageRecord.role === 'assistant' ? 'Assistant' : 'User'} note`;
      const safeTitle = rawTitle.slice(0, 80);
      const textContent = messageRecord.content.trim();

      if (!textContent) {
        return reply.status(400).send({ error: 'Cannot save empty message' });
      }

      const filename = `${safeTitle.replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'chat-note'}.md`;
      const chunks = await adaptiveChunker.chunkDocument(textContent, {
        source: 'chat_message',
        messageId: messageRecord.id,
        sessionId: messageRecord.sessionId,
        role: messageRecord.role,
      });

      const [savedFile] = await db.insert(files).values({
        userId,
        filename,
        originalName: filename,
        mimetype: 'text/markdown',
        size: Buffer.byteLength(textContent, 'utf8'),
        status: 'processed',
        storageProvider: 'volume',
        metadata: {
          extractedText: textContent,
          wordCount: textContent.split(/\s+/).filter(Boolean).length,
          characterCount: textContent.length,
          originalFormat: 'chat-message',
          chunks: chunks.length,
          indexedAt: new Date().toISOString(),
          processingStage: 'indexed',
          indexingStatus: 'completed',
          keywordSearchAvailable: true,
          vectorSearchAvailable: true,
          source: {
            type: 'chat_message',
            messageId: messageRecord.id,
            sessionId: messageRecord.sessionId,
            sessionTitle: messageRecord.sessionTitle,
            role: messageRecord.role,
            createdAt: messageRecord.createdAt.toISOString(),
          },
        } as any,
      }).returning({
        id: files.id,
        filename: files.filename,
        size: files.size,
        status: files.status,
        createdAt: files.createdAt,
      });

      if (chunks.length > 0) {
        await db.insert(documentChunks).values(
          chunks.map((chunk) => ({
            fileId: savedFile.id,
            content: chunk.content,
            chunkIndex: chunk.index,
            metadata: {
              startChar: chunk.startChar,
              endChar: chunk.endChar,
              section: chunk.metadata?.section,
              heading: chunk.metadata?.heading,
            },
          })),
        );

        await ragService.indexDocument(savedFile.id);
      }

      return reply.status(201).send({
        success: true,
        file: {
          id: savedFile.id,
          filename: savedFile.filename,
          size: savedFile.size,
          status: savedFile.status,
          createdAt: savedFile.createdAt,
        },
      });
    } catch (error) {
      logger.error('Failed to save chat message to knowledge:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({
        error: 'Failed to save message to knowledge',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get all chat sessions with pagination and search
  fastify.get('/sessions', {
    preHandler: [authenticateToken as any],
    schema: {
      description: 'Get all chat sessions with pagination and search',
      tags: ['chat'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  shortId: { type: 'string' },
                  title: { type: 'string' },
                  model: { type: 'string' },
                  userId: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  autoTitle: { type: 'boolean' },
                  messageCount: { type: 'number' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                pages: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 20, search } = request.query as { page?: number; limit?: number; search?: string };
    const userId = (request as any).user.id;

    try {
      const offset = (page - 1) * limit;

      // Build where clause scoped to this user + optional search
      const whereClause = search
        ? and(eq(chatSessions.userId, userId), like(chatSessions.title, `%${search}%`))
        : eq(chatSessions.userId, userId);

      const sessions = await db.query.chatSessions.findMany({
        where: whereClause,
        orderBy: [desc(chatSessions.updatedAt)],
        limit,
        offset,
      });

      // Get total count for pagination
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatSessions)
        .where(whereClause);

      // Get message count for each session
      const sessionsWithCount = await Promise.all(
        sessions.map(async (session) => {
          const messageCount = await db.query.messages.findMany({
            where: eq(messages.sessionId, session.id),
          });
          
          return {
            id: session.id,
            shortId: session.shortId,
            title: session.title,
            model: session.model,
            userId: session.userId || 'anonymous',
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
            autoTitle: session.autoTitle,
            messageCount: messageCount.length
          };
        })
      );

      const total = totalCount[0]?.count || 0;
      
      reply.send({
        sessions: sessionsWithCount,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Failed to retrieve chat sessions:', error);
      reply.status(500).send({
        error: 'Failed to retrieve chat sessions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create new chat session
  fastify.post('/sessions', {
    preHandler: optionalAuth as any,
    schema: {
      description: 'Create a new chat session',
      tags: ['chat'],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          model: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            shortId: { type: 'string' },
            title: { type: 'string' },
            model: { type: 'string' },
            userId: { type: 'string' },
            autoTitle: { type: 'boolean' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            messageCount: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const body = request.body as { title?: string; model?: string };
    
    try {
      // Generate unique short ID
      const shortId = await generateUniqueShortId(async (id) => {
        const existing = await db.query.chatSessions.findFirst({
          where: eq(chatSessions.shortId, id)
        });
        return !!existing;
      });
      
      const newSession = await db.insert(chatSessions).values({
        shortId,
        title: body.title || 'New Chat',
        model: body.model || 'gpt-4-turbo',
        autoTitle: false,
        userId: (request as any).user?.id ?? null,
      }).returning();

      const session = newSession[0];
      
      reply.send({
        id: session.id,
        shortId: session.shortId,
        title: session.title,
        model: session.model,
        userId: session.userId || 'anonymous',
        autoTitle: session.autoTitle,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messageCount: 0
      });
    } catch (error) {
      logger.error('Failed to create chat session:', error);
      reply.status(500).send({
        error: 'Failed to create chat session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get single session details by ID or shortId
  fastify.get('/session/:sessionId', {
    schema: {
      description: 'Get a single chat session by UUID or shortId',
      tags: ['chat'],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            shortId: { type: 'string' },
            title: { type: 'string' },
            model: { type: 'string' },
            userId: { type: 'string' },
            autoTitle: { type: 'boolean' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            messageCount: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    
    try {
      // Check if it's a short ID or UUID
      const isShortId = isValidShortId(sessionId);
      
      const session = await db.query.chatSessions.findFirst({
        where: isShortId 
          ? eq(chatSessions.shortId, sessionId)
          : eq(chatSessions.id, sessionId),
      });

      if (!session) {
        return reply.status(404).send({
          error: 'Session not found',
          message: `Chat session ${sessionId} does not exist`
        });
      }

      const messageCount = await db.query.messages.findMany({
        where: eq(messages.sessionId, session.id),
      });

      reply.send({
        id: session.id,
        shortId: session.shortId,
        title: session.title,
        model: session.model,
        userId: session.userId || 'anonymous',
        autoTitle: session.autoTitle,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messageCount: messageCount.length
      });
    } catch (error) {
      logger.error('Failed to retrieve chat session:', error);
      reply.status(500).send({
        error: 'Failed to retrieve chat session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update session title
  fastify.patch('/session/:sessionId/title', {
    preHandler: [authenticateToken as any],
    schema: {
      description: 'Update chat session title',
      tags: ['chat'],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          autoGenerated: { type: 'boolean' }
        },
        required: ['title']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            shortId: { type: 'string' },
            title: { type: 'string' },
            autoTitle: { type: 'boolean' },
            updatedAt: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { title, autoGenerated } = request.body as { title: string; autoGenerated?: boolean };
    const userId = (request as any).user.id;

    try {
      // Find session by ID or shortId
      const isShortId = isValidShortId(sessionId);
      const session = await db.query.chatSessions.findFirst({
        where: isShortId
          ? eq(chatSessions.shortId, sessionId)
          : eq(chatSessions.id, sessionId),
      });

      if (!session) {
        return reply.status(404).send({
          error: 'Session not found',
          message: `Chat session ${sessionId} does not exist`
        });
      }

      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied', message: 'You do not own this session' });
      }

      // Update the session
      const updated = await db
        .update(chatSessions)
        .set({ 
          title,
          autoTitle: autoGenerated || false,
          updatedAt: new Date()
        })
        .where(eq(chatSessions.id, session.id))
        .returning();

      reply.send({
        id: updated[0].id,
        shortId: updated[0].shortId,
        title: updated[0].title,
        autoTitle: updated[0].autoTitle,
        updatedAt: updated[0].updatedAt.toISOString()
      });
    } catch (error) {
      logger.error('Failed to update session title:', error);
      reply.status(500).send({
        error: 'Failed to update session title',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate LLM title for session
  fastify.post('/session/:sessionId/generate-title', {
    preHandler: [authenticateToken as any],
    schema: {
      description: 'Generate an LLM-powered title for the chat session based on conversation content',
      tags: ['chat'],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            shortId: { type: 'string' },
            title: { type: 'string' },
            autoTitle: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const userId = (request as any).user.id;

    try {
      // Find session by ID or shortId
      const isShortId = isValidShortId(sessionId);
      const session = await db.query.chatSessions.findFirst({
        where: isShortId
          ? eq(chatSessions.shortId, sessionId)
          : eq(chatSessions.id, sessionId),
      });

      if (!session) {
        return reply.status(404).send({
          error: 'Session not found',
          message: `Chat session ${sessionId} does not exist`
        });
      }

      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied', message: 'You do not own this session' });
      }

      // Get first few messages from the session
      const sessionMessages = await db.query.messages.findMany({
        where: eq(messages.sessionId, session.id),
        orderBy: [messages.createdAt],
        limit: 6, // Get first 3 exchanges (6 messages)
      });

      if (sessionMessages.length === 0) {
        return reply.status(400).send({
          error: 'Cannot generate title',
          message: 'Session has no messages yet'
        });
      }

      // Build context from messages
      const conversationContext = sessionMessages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      // Get user API keys if available
      const userApiKeys = userId ? await getUserApiKeys(userId) : {};

      // Use LLM to generate a concise title
      const titlePrompt = `Based on the following conversation, generate a concise, descriptive title (3-6 words maximum). Only respond with the title, nothing else:\n\n${conversationContext}`;
      
      const titleResponse = await llmService.generateResponse(
        [{ role: 'user', content: titlePrompt }],
        'llama-3.1-8b-instant', // Use GROQ model for titles (fast and cheap)
        {
          temperature: 0.7,
          maxTokens: 50,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        },
        userApiKeys
      );

      // Clean up the generated title
      let generatedTitle = titleResponse.content.trim().replace(/^["']|["']$/g, '');
      
      // Limit title length
      if (generatedTitle.length > 60) {
        generatedTitle = generatedTitle.substring(0, 57) + '...';
      }

      // Update session with generated title
      const updated = await db
        .update(chatSessions)
        .set({ 
          title: generatedTitle,
          autoTitle: true,
          updatedAt: new Date()
        })
        .where(eq(chatSessions.id, session.id))
        .returning();

      reply.send({
        id: updated[0].id,
        shortId: updated[0].shortId,
        title: updated[0].title,
        autoTitle: updated[0].autoTitle
      });
    } catch (error) {
      logger.error('Failed to generate session title:', error);
      reply.status(500).send({
        error: 'Failed to generate session title',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete chat session (update route to match frontend)
  fastify.delete('/sessions/:sessionId', {
    preHandler: [authenticateToken as any],
    schema: {
      description: 'Delete a chat session and its history',
      tags: ['chat'],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
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
    const { sessionId } = request.params as { sessionId: string };
    const userId = (request as any).user.id;

    try {
      // Verify ownership before deleting
      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, sessionId),
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found', message: `Chat session ${sessionId} does not exist` });
      }

      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied', message: 'You do not own this session' });
      }

      // Delete all messages for this session
      await db.delete(messages).where(eq(messages.sessionId, sessionId));

      // Delete the session
      await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
      
      reply.send({
        success: true,
        message: `Session ${sessionId} deleted successfully`
      });
    } catch (error) {
      logger.error('Failed to delete chat session:', error);
      reply.status(500).send({
        error: 'Failed to delete chat session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Send chat message
  fastify.post('/send', {
    preHandler: [authenticateToken as any, requireModelForTier()],
    schema: {
      description: 'Send a chat message and get AI response',
      tags: ['chat'],
      body: {
        type: 'object',
        properties: {
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                content: { type: 'string' },
                timestamp: { type: 'string' },
                model: { type: 'string' },
                attachments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['image', 'file'] },
                      name: { type: 'string' },
                      url: { type: 'string' }
                    }
                  }
                },
                isStreaming: { type: 'boolean' }
              }
            }
          },
          selectedDocumentIds: {
            type: 'array',
            items: { type: 'string' }
          },
          model: { type: 'string' },
          parameters: {
            type: 'object',
            properties: {
              temperature: { type: 'number' },
              maxTokens: { type: 'number' },
              topP: { type: 'number' },
              frequencyPenalty: { type: 'number' },
              presencePenalty: { type: 'number' }
            }
          },
          stream: { type: 'boolean' },
          sessionId: { type: 'string' }
        },
        required: ['messages', 'model']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                role: { type: 'string' },
                content: { type: 'string' },
                timestamp: { type: 'string' },
                model: { type: 'string' }
              }
            },
            sessionId: { type: 'string' },
            shortId: { type: 'string' },
            usage: {
              type: 'object',
              properties: {
                promptTokens: { type: 'number' },
                completionTokens: { type: 'number' },
                totalTokens: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { messages: requestMessages, model, parameters, sessionId, selectedDocumentIds } = ChatRequestSchema.parse(request.body);
    const userId = (request as any).user?.id;

    try {
      const result = await runChat({ messages: requestMessages, model, parameters, sessionId, userId });
      reply.send(result);
    } catch (error) {
      logger.error('Chat request failed:', error);
      reply.status(500).send({
        error: 'Chat request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Stream chat message (Server-Sent Events)
  fastify.post('/stream', {
    preHandler: [authenticateToken as any, requireModelForTier()],
    schema: {
      description: 'Send a chat message and get streaming AI response',
      tags: ['chat'],
      body: {
        type: 'object',
        properties: {
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                content: { type: 'string' },
                timestamp: { type: 'string' },
                model: { type: 'string' },
                attachments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['image', 'file'] },
                      name: { type: 'string' },
                      url: { type: 'string' }
                    }
                  }
                },
                isStreaming: { type: 'boolean' }
              }
            }
          },
          model: { type: 'string' },
          parameters: {
            type: 'object',
            properties: {
              temperature: { type: 'number' },
              maxTokens: { type: 'number' },
              topP: { type: 'number' },
              frequencyPenalty: { type: 'number' },
              presencePenalty: { type: 'number' }
            }
          },
          sessionId: { type: 'string' }
        },
        required: ['messages', 'model']
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now(); // Track request start time for metrics
    const { messages: requestMessages, model, parameters, sessionId, selectedDocumentIds } = ChatRequestSchema.parse(request.body);
    const userId = (request as any).user?.id;
    
    // Send headers explicitly using raw.writeHead for streaming
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin || 'http://localhost:5173',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    });

    try {
      // Get or create session
      let currentSessionId = sessionId;
      let currentShortId: string;
      
      if (!currentSessionId) {
        // Generate unique short ID for new session
        const shortId = await generateUniqueShortId(async (id) => {
          const existing = await db.query.chatSessions.findFirst({
            where: eq(chatSessions.shortId, id)
          });
          return !!existing;
        });
        
        const newSession = await db.insert(chatSessions).values({
          shortId,
          userId: userId ?? null,
          model,
          parameters,
          autoTitle: false,
          title: requestMessages[requestMessages.length - 1]?.content.substring(0, 50) || 'New Chat',
        }).returning({ id: chatSessions.id, shortId: chatSessions.shortId });
        currentSessionId = newSession[0].id;
        currentShortId = newSession[0].shortId;
      } else {
        // Get existing session's shortId
        const existingSession = await db.query.chatSessions.findFirst({
          where: eq(chatSessions.id, currentSessionId),
        });
        currentShortId = existingSession?.shortId || '';
      }

      // Save all user messages to database (only save if not already saved)
      const existingMessages = await db.query.messages.findMany({
        where: eq(messages.sessionId, currentSessionId),
        columns: { content: true, createdAt: true }
      });
      
      // Save only new user messages that aren't already in the database
      // Check by content and approximate timestamp to avoid duplicates
      const newUserMessages = requestMessages.filter(msg => {
        if (msg.role !== 'user') return false;
        
        // Check if a message with similar content already exists
        const msgTimestamp = new Date(msg.timestamp);
        const isDuplicate = existingMessages.some(existing => 
          existing.content === msg.content &&
          Math.abs(new Date(existing.createdAt).getTime() - msgTimestamp.getTime()) < 5000 // Within 5 seconds
        );
        
        return !isDuplicate;
      });
      
      if (newUserMessages.length > 0) {
        const insertedMessages = await db.insert(messages).values(
          newUserMessages.map(msg => ({
            sessionId: currentSessionId,
            role: msg.role,
            content: msg.content,
            model,
            attachments: msg.attachments || null,
          }))
        ).returning({ id: messages.id });
        
        logger.info('Saved user messages to database:', {
          count: insertedMessages.length,
          messageIds: insertedMessages.map(m => m.id)
        });
      }

      let fullContent = '';
      let usage: any = null;

      const accessibleDocumentIds = await resolveAccessibleDocumentIds(userId, selectedDocumentIds);
      const { llmMessages: contextAwareMessages, metadata: ragMetadata } = await injectSelectedDocumentContext(requestMessages, accessibleDocumentIds);

      // Prepare messages for LLM with attachment context
      const llmMessages = contextAwareMessages.map(msg => {
        let content = msg.content;
        
        // Add attachment information to the message content
        if (msg.attachments && msg.attachments.length > 0) {
          const attachmentInfo = msg.attachments.map(att => 
            `[Attachment: ${att.type} - ${att.name} (${att.url})]`
          ).join(' ');
          content = `${content}\n\nAttachments: ${attachmentInfo}`;
        }
        
        return { role: msg.role, content };
      });

      // Get user API keys if available
      const userApiKeys = userId ? await getUserApiKeys(userId) : {};
      
      // Debug logging
      logger.info('Streaming chat request debug:', { 
        userId, 
        hasUserApiKeys: Object.keys(userApiKeys).length > 0,
        userApiKeys: userApiKeys,
        groqKey: userApiKeys.groq ? `${userApiKeys.groq.substring(0, 10)}...` : 'not set'
      });

      // Generate streaming LLM response
      for await (const chunk of llmService.generateStreamResponse(
        llmMessages,
        model,
        parameters || {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        },
        userApiKeys
      )) {
        if (chunk.content) {
          fullContent += chunk.content;
        }

        if (chunk.usage) {
          usage = chunk.usage;
        }

        const streamChunk = {
          id: `chunk-${Date.now()}-${Math.random()}`,
          content: chunk.content,
          done: chunk.done
        };
        
        reply.raw.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
      }

      // Save assistant message to database
      await db.insert(messages).values({
        sessionId: currentSessionId,
        role: 'assistant',
        content: fullContent,
        model,
        usage,
        metadata: ragMetadata || null,
      });

      // Track API usage for analytics and billing
      if (usage && userId) {
        try {
          const cost = calculateCost(model, usage);
          await db.insert(apiUsage).values({
            userId,
            endpoint: '/api/chat/stream',
            method: 'POST',
            model,
            tokensUsed: usage.totalTokens || 0,
            cost, // Cost in cents
            responseTime: Date.now() - startTime,
            statusCode: 200,
          });
          logger.debug(`API usage tracked: ${usage.totalTokens} tokens, cost: ${cost} cents`);
        } catch (usageError) {
          // Don't fail the request if usage tracking fails
          logger.warn('Failed to log API usage:', usageError);
        }
      }

      // Auto-generate title after first exchange (2 messages: user + assistant)
      const messageCount = await db.query.messages.findMany({
        where: eq(messages.sessionId, currentSessionId),
      });

      if (messageCount.length === 2) {
        // This is the first exchange, generate a title
        try {
          const lastUserMessage = requestMessages.find(msg => msg.role === 'user');
          const titlePrompt = `Based on the following conversation, generate a concise, descriptive title (3-6 words maximum). Only respond with the title, nothing else:\n\nUser: ${lastUserMessage?.content || 'New Chat'}\nAssistant: ${fullContent}`;
          
          const titleResponse = await llmService.generateResponse(
            [{ role: 'user', content: titlePrompt }],
            'llama-3.1-8b-instant',
            {
              temperature: 0.7,
              maxTokens: 50,
              topP: 1.0,
              frequencyPenalty: 0.0,
              presencePenalty: 0.0,
            },
            userApiKeys
          );

          let generatedTitle = titleResponse.content.trim().replace(/^["']|["']$/g, '');
          
          // Limit title length
          if (generatedTitle.length > 60) {
            generatedTitle = generatedTitle.substring(0, 57) + '...';
          }

          // Update session with generated title
          await db
            .update(chatSessions)
            .set({ 
              title: generatedTitle,
              autoTitle: true,
              updatedAt: new Date()
            })
            .where(eq(chatSessions.id, currentSessionId));

          logger.info(`Auto-generated title for session ${currentSessionId}: ${generatedTitle}`);
        } catch (titleError) {
          logger.warn('Failed to auto-generate title:', titleError);
          // Don't fail the main request if title generation fails
        }
      }

      // Send session ID and shortId
      reply.raw.write(`data: ${JSON.stringify({ sessionId: currentSessionId, shortId: currentShortId, done: true })}\n\n`);
      
    } catch (error) {
      logger.error('Streaming chat request failed:', error);
      reply.raw.write(`data: ${JSON.stringify({ error: 'Streaming request failed', done: true })}\n\n`);
    }
    
    reply.raw.end();
  });

  // Get chat history
  fastify.get('/history/:sessionId', {
    preHandler: [authenticateToken as any],
    schema: {
      description: 'Get chat history for a session',
      tags: ['chat'],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  role: { type: 'string' },
                  content: { type: 'string' },
                  timestamp: { type: 'string' },
                  model: { type: 'string' }
                }
              }
            },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const userId = (request as any).user.id;

    try {
      // Get session
      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, sessionId),
      });

      if (!session) {
        return reply.status(404).send({
          error: 'Session not found',
          message: `Chat session ${sessionId} does not exist`
        });
      }

      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied', message: 'You do not own this session' });
      }

      // Get all messages for this session
      const sessionMessages = await db.query.messages.findMany({
        where: eq(messages.sessionId, sessionId),
        orderBy: [messages.createdAt],
      });

      const history = {
        sessionId,
        messages: sessionMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt.toISOString(),
          model: msg.model || session.model
        })),
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString()
      };

      reply.send(history);
    } catch (error) {
      logger.error('Failed to retrieve chat history:', error);
      reply.status(500).send({
        error: 'Failed to retrieve chat history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // PATCH /api/chat/messages/:messageId/signal
  // Record implicit signals: copy and regenerate events
  fastify.patch('/messages/:messageId/signal', {
    preHandler: [authenticateToken as any],
    schema: {
      description: 'Record an implicit training signal (copy or regenerate) for a message',
      tags: ['chat'],
      params: { type: 'object', properties: { messageId: { type: 'string' } }, required: ['messageId'] },
      body: {
        type: 'object',
        required: ['signal'],
        properties: {
          signal: { type: 'string', enum: ['copied', 'regenerated'] },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const { signal } = request.body as { signal: 'copied' | 'regenerated' };
    const userId = (request as any).user.id;

    try {
      const [message] = await db
        .select({ id: messages.id, sessionId: messages.sessionId })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!message) return reply.status(404).send({ error: 'Message not found' });

      if (message.sessionId) {
        const [session] = await db
          .select({ userId: chatSessions.userId })
          .from(chatSessions)
          .where(eq(chatSessions.id, message.sessionId))
          .limit(1);
        if (session?.userId && session.userId !== userId) {
          return reply.status(403).send({ error: 'Access denied' });
        }
      }

      await db
        .update(messages)
        .set(signal === 'copied' ? { wasCopied: true } : { wasRegenerated: true })
        .where(eq(messages.id, messageId));

      return reply.send({ success: true });
    } catch (error) {
      logger.error('Failed to record message signal:', error);
      return reply.status(500).send({ error: 'Failed to record signal' });
    }
  });

  // PATCH /api/chat/sessions/:sessionId/complete
  // Mark a session as completed or abandoned — called when user closes/leaves
  fastify.patch('/sessions/:sessionId/complete', {
    preHandler: [authenticateToken as any],
    schema: {
      description: 'Mark a chat session completion status',
      tags: ['chat'],
      params: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['completed', 'abandoned', 'error'] },
        },
      },
    },
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { status } = request.body as { status: 'completed' | 'abandoned' | 'error' };
    const userId = (request as any).user.id;

    try {
      const [session] = await db
        .select({ userId: chatSessions.userId })
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId))
        .limit(1);

      if (!session) return reply.status(404).send({ error: 'Session not found' });
      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      await db
        .update(chatSessions)
        .set({ completionStatus: status, updatedAt: new Date() })
        .where(eq(chatSessions.id, sessionId));

      return reply.send({ success: true });
    } catch (error) {
      logger.error('Failed to update session completion status:', error);
      return reply.status(500).send({ error: 'Failed to update session' });
    }
  });

}
