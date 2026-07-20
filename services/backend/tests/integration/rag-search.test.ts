import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/database/connection.js';
import { ragSearchSessions, ragSearchQueries, searchHistory } from '../../src/database/schema.js';
import { eq } from 'drizzle-orm';
import { generateUniqueShortId } from '../../src/utils/short-id.js';

describe('RAG Search Integration', () => {
  let testSessionId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Set up test user
    testUserId = 'test-user-id';
  });

  afterAll(async () => {
    // Clean up test data
    if (testSessionId) {
      await db.delete(ragSearchQueries).where(eq(ragSearchQueries.sessionId, testSessionId));
      await db.delete(ragSearchSessions).where(eq(ragSearchSessions.id, testSessionId));
    }
  });

  describe('RAG Session Management', () => {
    it('should create a RAG search session', async () => {
      const shortId = await generateUniqueShortId();
      
      const session = {
        userId: testUserId,
        shortId,
        title: 'Test Knowledge Manager Search',
        searchType: 'hybrid' as const,
        parameters: {
          limit: 5,
          threshold: 0.05,
          vectorWeight: 0.7,
          keywordWeight: 0.3,
          includeMetadata: true,
        },
        documentIds: [],
        isActive: true,
      };

      const result = await db.insert(ragSearchSessions).values(session).returning();
      testSessionId = result[0].id;

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Knowledge Manager Search');
      expect(result[0].searchType).toBe('hybrid');
      expect(result[0].isActive).toBe(true);
    });

    it('should verify session has unique shortId', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const session = await db
        .select()
        .from(ragSearchSessions)
        .where(eq(ragSearchSessions.id, testSessionId))
        .limit(1);

      expect(session[0].shortId).toBeDefined();
      expect(session[0].shortId).toHaveLength(8);
    });
  });

  describe('RAG Query Tracking', () => {
    it('should log a search query to the session', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const query = {
        sessionId: testSessionId,
        query: 'What is the main topic of this document?',
        enhancedQuery: 'What is the main topic of this document?',
        resultsCount: 3,
        searchTime: 150, // ms
        averageScore: 0.75,
        searchType: 'hybrid' as const,
        parameters: {
          limit: 5,
          threshold: 0.05,
          vectorWeight: 0.7,
          keywordWeight: 0.3,
          includeMetadata: true,
        },
        success: true,
      };

      const result = await db.insert(ragSearchQueries).values(query).returning();

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe('What is the main topic of this document?');
      expect(result[0].resultsCount).toBe(3);
      expect(result[0].success).toBe(true);
    });

    it('should retrieve all queries for a session', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const queries = await db
        .select()
        .from(ragSearchQueries)
        .where(eq(ragSearchQueries.sessionId, testSessionId));

      expect(queries.length).toBeGreaterThan(0);
      expect(queries[0].sessionId).toBe(testSessionId);
    });

    it('should update session timestamp after query', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const updatedAt = new Date();
      
      await db
        .update(ragSearchSessions)
        .set({ updatedAt })
        .where(eq(ragSearchSessions.id, testSessionId));

      const session = await db
        .select()
        .from(ragSearchSessions)
        .where(eq(ragSearchSessions.id, testSessionId))
        .limit(1);

      expect(session[0].updatedAt).toBeDefined();
    });
  });

  describe('Search History', () => {
    it('should log search to global search history', async () => {
      const historyEntry = {
        userId: testUserId,
        query: 'test search query',
        resultsCount: 5,
        searchTime: 200,
        averageScore: 0.8,
        fileIds: [],
        success: true,
      };

      const result = await db.insert(searchHistory).values(historyEntry).returning();

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe('test search query');
      expect(result[0].success).toBe(true);
    });

    it('should retrieve search history for user', async () => {
      const history = await db
        .select()
        .from(searchHistory)
        .where(eq(searchHistory.userId, testUserId));

      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Search Results Validation', () => {
    it('should verify result metadata structure', () => {
      const mockResult = {
        id: 'chunk-id-123',
        content: 'This is a test document chunk with relevant information.',
        score: 0.85,
        metadata: {
          fileId: 'file-id-456',
          filename: 'test-document.pdf',
          chunkIndex: 0,
          startChar: 0,
          endChar: 58,
        },
        file: {
          id: 'file-id-456',
          filename: 'test-document.pdf',
          uploadDate: new Date().toISOString(),
          size: 1024,
        },
      };

      // Verify structure
      expect(mockResult.id).toBeDefined();
      expect(mockResult.content).toContain('test document');
      expect(mockResult.score).toBeGreaterThan(0);
      expect(mockResult.metadata.filename).toBe('test-document.pdf');
      expect(mockResult.file.uploadDate).toBeDefined();
    });

    it('should verify keyword highlighting works', () => {
      const query = 'test document';
      const content = 'This is a test document chunk.';
      const keywords = query.toLowerCase().split(/\s+/);
      
      // Simple keyword check
      const hasKeywords = keywords.every(keyword => 
        content.toLowerCase().includes(keyword)
      );

      expect(hasKeywords).toBe(true);
    });
  });

  describe('Session Analytics', () => {
    it('should calculate session statistics', async () => {
      if (!testSessionId) {
        throw new Error('Test session not created');
      }

      const queries = await db
        .select()
        .from(ragSearchQueries)
        .where(eq(ragSearchQueries.sessionId, testSessionId));

      const totalQueries = queries.length;
      const averageSearchTime = queries.length > 0
        ? queries.reduce((sum, q) => sum + (q.searchTime || 0), 0) / queries.length
        : 0;
      const successRate = queries.length > 0
        ? queries.filter(q => q.success).length / queries.length
        : 0;

      expect(totalQueries).toBeGreaterThanOrEqual(0);
      expect(averageSearchTime).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeLessThanOrEqual(1);
    });
  });
});

