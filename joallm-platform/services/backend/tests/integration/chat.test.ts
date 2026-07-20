import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/database/connection.js';
import { chatSessions, messages, apiUsage } from '../../src/database/schema.js';
import { eq } from 'drizzle-orm';
import { generateUniqueShortId } from '../../src/utils/short-id.js';
import { calculateCost } from '../../src/utils/cost-calculator.js';

describe('Chat Integration', () => {
  let testSessionId: string;
  let testUserId: string;
  let testMessageId: string;

  beforeAll(async () => {
    // Set up test user
    testUserId = 'test-user-id';
  });

  afterAll(async () => {
    // Clean up test data
    if (testSessionId) {
      await db.delete(messages).where(eq(messages.sessionId, testSessionId));
      await db.delete(chatSessions).where(eq(chatSessions.id, testSessionId));
    }
    if (testUserId) {
      await db.delete(apiUsage).where(eq(apiUsage.userId, testUserId));
    }
  });

  describe('Chat Session Management', () => {
    it('should create a new chat session', async () => {
      const shortId = await generateUniqueShortId();
      
      const session = {
        userId: testUserId,
        shortId,
        slug: `chat-${shortId}`,
        title: 'Test Chat Session',
        model: 'llama-3.3-70b-versatile',
        parameters: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        },
        autoTitle: false,
        isActive: true,
      };

      const result = await db.insert(chatSessions).values(session).returning();
      testSessionId = result[0].id;

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Chat Session');
      expect(result[0].model).toBe('llama-3.3-70b-versatile');
      expect(result[0].isActive).toBe(true);
    });

    it('should verify session has unique shortId and slug', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const session = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, testSessionId))
        .limit(1);

      expect(session[0].shortId).toBeDefined();
      expect(session[0].slug).toContain('chat-');
      expect(session[0].shortId).toHaveLength(8);
    });
  });

  describe('Message Exchange', () => {
    it('should save user message to session', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const userMessage = {
        sessionId: testSessionId,
        role: 'user' as const,
        content: 'What is the capital of France?',
        model: null,
        attachments: null,
        usage: null,
        metadata: null,
      };

      const result = await db.insert(messages).values(userMessage).returning();

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('What is the capital of France?');
    });

    it('should save assistant message with usage stats', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const assistantMessage = {
        sessionId: testSessionId,
        role: 'assistant' as const,
        content: 'The capital of France is Paris.',
        model: 'llama-3.3-70b-versatile',
        attachments: null,
        usage: {
          promptTokens: 15,
          completionTokens: 10,
          totalTokens: 25,
        },
        metadata: null,
      };

      const result = await db.insert(messages).values(assistantMessage).returning();
      testMessageId = result[0].id;

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].model).toBe('llama-3.3-70b-versatile');
      expect(result[0].usage).toBeDefined();
      expect(result[0].usage.totalTokens).toBe(25);
    });

    it('should retrieve message history for session', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, testSessionId));

      expect(history.length).toBeGreaterThanOrEqual(2); // User + assistant
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });
  });

  describe('API Usage Tracking', () => {
    it('should track API usage after message', async () => {
      const usage = {
        promptTokens: 15,
        completionTokens: 10,
        totalTokens: 25,
      };

      const model = 'llama-3.3-70b-versatile';
      const cost = calculateCost(model, usage);

      const apiUsageEntry = {
        userId: testUserId,
        endpoint: '/api/chat/stream',
        method: 'POST',
        model,
        tokensUsed: usage.totalTokens,
        cost,
        responseTime: 1500, // ms
        statusCode: 200,
      };

      const result = await db.insert(apiUsage).values(apiUsageEntry).returning();

      expect(result).toHaveLength(1);
      expect(result[0].tokensUsed).toBe(25);
      expect(result[0].cost).toBeGreaterThan(0);
      expect(result[0].statusCode).toBe(200);
    });

    it('should calculate cost correctly', () => {
      const usage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };

      const cost = calculateCost('llama-3.3-70b-versatile', usage);

      // Cost should be: (100/1000 * 0.059) + (50/1000 * 0.079) = 0.0059 + 0.00395 = 0.00985 cents
      // Rounded to 2 decimal places
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(1); // Should be less than 1 cent
    });

    it('should retrieve usage statistics for user', async () => {
      const userUsage = await db
        .select()
        .from(apiUsage)
        .where(eq(apiUsage.userId, testUserId));

      expect(userUsage.length).toBeGreaterThan(0);
      
      const totalCost = userUsage.reduce((sum, entry) => sum + (entry.cost || 0), 0);
      const totalTokens = userUsage.reduce((sum, entry) => sum + (entry.tokensUsed || 0), 0);

      expect(totalCost).toBeGreaterThan(0);
      expect(totalTokens).toBeGreaterThan(0);
    });
  });

  describe('Session Title Generation', () => {
    it('should update session with auto-generated title', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const generatedTitle = 'Capital of France';
      
      await db
        .update(chatSessions)
        .set({ 
          title: generatedTitle,
          autoTitle: true,
        })
        .where(eq(chatSessions.id, testSessionId));

      const session = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, testSessionId))
        .limit(1);

      expect(session[0].title).toBe('Capital of France');
      expect(session[0].autoTitle).toBe(true);
    });
  });

  describe('Session Persistence', () => {
    it('should verify session remains active', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const session = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, testSessionId))
        .limit(1);

      expect(session[0].isActive).toBe(true);
    });

    it('should update session timestamp', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const updatedAt = new Date();
      
      await db
        .update(chatSessions)
        .set({ updatedAt })
        .where(eq(chatSessions.id, testSessionId));

      const session = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, testSessionId))
        .limit(1);

      expect(session[0].updatedAt).toBeDefined();
    });
  });

  describe('Session Deletion', () => {
    it('should delete session and cascade to messages', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      // Delete session
      await db.delete(chatSessions).where(eq(chatSessions.id, testSessionId));

      // Verify session is deleted
      const deletedSession = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, testSessionId));

      expect(deletedSession).toHaveLength(0);

      // Verify messages are deleted (should cascade)
      const remainingMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, testSessionId));

      expect(remainingMessages).toHaveLength(0);

      // Clear testSessionId so cleanup doesn't try to delete again
      testSessionId = '';
    });
  });
});

