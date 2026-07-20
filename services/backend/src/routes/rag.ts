import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { ragService } from '../services/rag-service.js';
import { enhancedRAGService } from '../services/enhanced-rag-service.js';
import { EndpointValidations, SanitizationUtils } from '../middleware/validation.js';
import { logger } from '../utils/logger.js';
import { generateUniqueShortId } from '../utils/short-id.js';
import { db } from '../database/connection.js';
import { documentChunks, files, searchHistory, ragSearchSessions, ragSearchQueries, users, apiUsage } from '../database/schema.js';
import { decryptApiKeys } from '../utils/encryption.js';
import { calculateCost } from '../utils/cost-calculator.js';
import { cacheService, CacheKeys, CacheTTL } from '../services/cache.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';
import { getMode } from '../services/rag-modes.js';
import { RAGChatError, runRagChat } from '../application/rag/rag-chat-orchestrator.js';

// Helper function to fetch user API keys
async function getUserApiKeys(userId: string) {
  try {
    const user = await db
      .select({ apiKeys: users.apiKeys })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const encryptedKeys = user[0]?.apiKeys as Record<string, string> || {};
    return decryptApiKeys(encryptedKeys);
  } catch (error) {
    logger.error('Failed to fetch user API keys:', error);
    return {};
  }
}

const RAGSearchRequestSchema = z.object({
  query: z.string().min(1),
  fileIds: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(5),
  threshold: z.number().min(0).max(1).default(0.1),
  includeMetadata: z.boolean().default(true),
  sessionId: z.string().optional()
});

const RAGSearchResultSchema = z.object({
  id: z.string(),
  content: z.string(),
  score: z.number(),
  metadata: z.object({
    fileId: z.string(),
    filename: z.string(),
    chunkIndex: z.number(),
    pageNumber: z.number().optional(),
    startChar: z.number(),
    endChar: z.number()
  }),
  file: z.object({
    id: z.string(),
    filename: z.string(),
    uploadDate: z.string(),
    size: z.number()
  })
});

export async function ragRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Search documents using RAG
  fastify.post('/search', {
    preHandler: [authenticateToken as any, EndpointValidations.ragSearch],
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute'
      }
    },
    schema: {
      description: 'Search through uploaded documents using RAG',
      tags: ['rag'],
      body: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          fileIds: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number', default: 5 },
          threshold: { type: 'number', default: 0.1 },
          includeMetadata: { type: 'boolean', default: true }
        },
        required: ['query']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  content: { type: 'string' },
                  score: { type: 'number' },
                  metadata: {
                    type: 'object',
                    properties: {
                      fileId: { type: 'string' },
                      filename: { type: 'string' },
                      chunkIndex: { type: 'number' },
                      pageNumber: { type: 'number' },
                      startChar: { type: 'number' },
                      endChar: { type: 'number' }
                    }
                  },
                  file: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      filename: { type: 'string' },
                      uploadDate: { type: 'string' },
                      size: { type: 'number' }
                    }
                  }
                }
              }
            },
            totalResults: { type: 'number' },
            searchTime: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { query, fileIds, limit, threshold, includeMetadata, sessionId } = RAGSearchRequestSchema.parse(request.body);
    const userId = (request as any).user?.id;

    // Sanitize the query
    const sanitizedQuery = SanitizationUtils.sanitizeQuery(query);

    try {
      // If fileIds are provided, verify all belong to the requesting user
      if (fileIds && fileIds.length > 0 && userId) {
        const ownedFiles = await db
          .select({ id: files.id })
          .from(files)
          .where(and(inArray(files.id, fileIds), eq(files.userId, userId)));

        if (ownedFiles.length !== fileIds.length) {
          return reply.status(403).send({ error: 'Access denied', message: 'One or more files do not belong to you' });
        }
      } else if (fileIds && fileIds.length > 0 && !userId) {
        return reply.status(401).send({ error: 'Authentication required', message: 'Must be logged in to search specific files' });
      }

      const startTime = Date.now();

      // Check cache before hitting Cohere + pgvector
      const cacheKey = CacheKeys.ragSearchResult(sanitizedQuery, fileIds ?? []);
      const cached = await cacheService.get<{ results: any[]; totalResults: number }>(cacheKey);
      if (cached) {
        logger.debug(`RAG cache hit for query: "${sanitizedQuery}"`);
        return reply.send({ query, ...cached, searchTime: 0 });
      }

      // Perform enhanced RAG search
      const results = await enhancedRAGService.search({
        query: sanitizedQuery,
        fileIds,
        userId,
        limit,
        threshold,
        includeMetadata,
        searchType: 'hybrid'
      });

      const searchTime = Date.now() - startTime;
      
      // Calculate average score
      const averageScore = results.length > 0 
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length 
        : 0;
      
      // Log search to history
      await db.insert(searchHistory).values({
        query,
        resultsCount: results.length,
        searchTime,
        averageScore,
        fileIds: fileIds && fileIds.length > 0 ? fileIds : null,
        success: true,
      }).catch(err => {
        logger.warn('Failed to log search history:', err);
      });

      // Log search query to session if sessionId provided
      if (sessionId) {
        try {
          await db.insert(ragSearchQueries).values({
            sessionId,
            query,
            resultsCount: results.length,
            searchTime,
            averageScore,
            searchType: 'hybrid',
            parameters: {
              limit,
              threshold,
              vectorWeight: 0.7,
              keywordWeight: 0.3,
              includeMetadata
            },
            success: true
          });

          // Update session updatedAt timestamp
          await db.update(ragSearchSessions)
            .set({ updatedAt: new Date() })
            .where(eq(ragSearchSessions.id, sessionId));
        } catch (error) {
          logger.warn('Failed to log search query to session:', error);
        }
      }

      // Track API usage for RAG searches (embeddings cost)
      if (userId) {
        try {
          // Estimate embedding tokens (roughly 1 token per 4 characters for English text)
          const estimatedTokens = Math.ceil(sanitizedQuery.length / 4);
          
          // Cohere embedding cost is very low, approximate at $0.0001/1K tokens
          // For this implementation, we'll track it as minimal cost
          const estimatedCost = Math.max(1, Math.ceil(estimatedTokens / 1000 * 0.01)); // Minimum 1 cent
          
          await db.insert(apiUsage).values({
            userId,
            endpoint: '/api/rag/search',
            method: 'POST',
            model: 'embed-english-v3.0', // Cohere embedding model
            tokensUsed: estimatedTokens,
            cost: estimatedCost, // Cost in cents
            responseTime: searchTime,
            statusCode: 200,
          });
          logger.debug(`RAG API usage tracked: ${estimatedTokens} tokens (estimated), cost: ${estimatedCost} cents`);
        } catch (usageError) {
          // Don't fail the request if usage tracking fails
          logger.warn('Failed to log RAG API usage:', usageError);
        }
      }
      
      // Cache the result (fire-and-forget)
      cacheService.set(cacheKey, { results, totalResults: results.length }, CacheTTL.ragSearchResult)
        .catch(err => logger.warn('Failed to cache RAG search result:', err));

      reply.send({
        query,
        results,
        totalResults: results.length,
        searchTime
      });
    } catch (error) {
      logger.error('RAG search failed:', error);
      
      // Log failed search
      await db.insert(searchHistory).values({
        query,
        resultsCount: 0,
        searchTime: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }).catch(err => {
        logger.warn('Failed to log search history:', err);
      });
      
      reply.status(500).send({
        error: 'RAG search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get document chunks
  fastify.get('/chunks/:fileId', {
    schema: {
      description: 'Get all chunks for a specific document',
      tags: ['rag'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' }
        },
        required: ['fileId']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            fileId: { type: 'string' },
            filename: { type: 'string' },
            chunks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  content: { type: 'string' },
                  index: { type: 'number' },
                  metadata: { type: 'object' }
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
    const { fileId } = request.params as { fileId: string };
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    
    // TODO: Implement actual database query
    const mockChunks = [
      {
        id: 'chunk-1',
        content: 'This is the first chunk of the document...',
        index: 0,
        metadata: { pageNumber: 1, startChar: 0, endChar: 500 }
      },
      {
        id: 'chunk-2',
        content: 'This is the second chunk of the document...',
        index: 1,
        metadata: { pageNumber: 1, startChar: 501, endChar: 1000 }
      }
    ];

    reply.send({
      fileId,
      filename: 'document.pdf',
      chunks: mockChunks,
      pagination: {
        page,
        limit,
        total: mockChunks.length,
        pages: Math.ceil(mockChunks.length / limit)
      }
    });
  });

  // Reindex document
  fastify.post('/reindex/:fileId', {
    schema: {
      description: 'Reindex a document for RAG search',
      tags: ['rag'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' }
        },
        required: ['fileId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            jobId: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { fileId } = request.params as { fileId: string };
      
      // Verify file exists
      const [file] = await db
        .select()
        .from(files)
        .where(eq(files.id, fileId))
        .limit(1);
      
      if (!file) {
        return reply.status(404).send({
          success: false,
          error: 'File not found',
          message: `Document ${fileId} not found in database`
        });
      }
      
      // Queue document for reindexing
      const jobId = `reindex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // TODO: Queue actual reindexing job via BullMQ
      // await documentIndexingWorker.add('reindex-document', { fileId, jobId });
      
      logger.info(`Document ${fileId} queued for reindexing with job ${jobId}`);
      
      reply.send({
        success: true,
        message: `Document "${file.filename}" queued for reindexing`,
        jobId
      });
    } catch (error) {
      logger.error('Reindex error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to queue document for reindexing'
      });
    }
  });

  // Get RAG statistics
  fastify.get('/stats', {
    schema: {
      description: 'Get RAG system statistics',
      tags: ['rag'],
      response: {
        200: {
          type: 'object',
          properties: {
            totalDocuments: { type: 'number' },
            totalChunks: { type: 'number' },
            totalEmbeddings: { type: 'number' },
            lastIndexedAt: { type: 'string' },
            averageChunkSize: { type: 'number' },
            supportedFileTypes: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, async (request, reply) => {
    // TODO: Implement actual statistics from database
    reply.send({
      totalDocuments: 15,
      totalChunks: 1247,
      totalEmbeddings: 1247,
      lastIndexedAt: new Date(Date.now() - 3600000).toISOString(),
      averageChunkSize: 512,
      supportedFileTypes: ['PDF', 'TXT', 'MD', 'DOC', 'DOCX']
    });
  });

  // Advanced RAG Analytics Dashboard
  fastify.get('/analytics/dashboard', {
    schema: {
      description: 'Get comprehensive RAG analytics dashboard data',
      tags: ['rag', 'analytics'],
      querystring: {
        type: 'object',
        properties: {
          timeRange: { type: 'string', enum: ['1h', '24h', '7d', '30d'], default: '24h' },
          includeDetails: { type: 'boolean', default: false }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            searchMetrics: {
              type: 'object',
              properties: {
                totalSearches: { type: 'number' },
                averageResponseTime: { type: 'number' },
                successRate: { type: 'number' },
                topQueries: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      query: { type: 'string' },
                      frequency: { type: 'number' },
                      averageScore: { type: 'number' }
                    }
                  }
                }
              }
            },
            documentMetrics: {
              type: 'object',
              properties: {
                totalDocuments: { type: 'number' },
                totalChunks: { type: 'number' },
                mostAccessedDocuments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      accessCount: { type: 'number' },
                      lastAccessed: { type: 'string' }
                    }
                  }
                },
                chunkUtilization: { type: 'number' },
                embeddingCoverage: { type: 'number' }
              }
            },
            performanceMetrics: {
              type: 'object',
              properties: {
                averageRelevanceScore: { type: 'number' },
                contextEfficiency: { type: 'number' },
                searchLatency: { type: 'number' },
                embeddingGenerationTime: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { timeRange = '24h', includeDetails = false } = request.query as { 
      timeRange?: string; 
      includeDetails?: boolean 
    };
    
    try {
      // Calculate time window
      const now = new Date();
      let startTime: Date;
      
      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      // Get document statistics
      const [filesData] = await db.select({
        count: sql<number>`count(*)::int`
      }).from(files);
      
      const totalDocuments = filesData?.count || 0;
      
      // Get total chunks count separately
      const [chunksData] = await db.select({
        count: sql<number>`count(*)::int`
      }).from(documentChunks);
      
      const totalChunks = chunksData?.count || 0;

      // Get files with chunk counts
      const filesWithStats = await db.select({
        id: files.id,
        filename: files.filename,
        createdAt: files.createdAt,
        chunkCount: sql<number>`(
          SELECT count(*)::int FROM ${documentChunks} 
          WHERE document_chunks.file_id = ${files.id}
        )`
      })
      .from(files)
      .orderBy(sql`${files.createdAt} DESC`);

      // Calculate chunk utilization (chunks with embeddings / total chunks)
      const chunksWithEmbeddings = await db.select({
        count: sql<number>`count(*)::int`
      })
      .from(documentChunks)
      .where(sql`${documentChunks.embedding} IS NOT NULL`);
      
      const chunksWithEmbeddingsCount = chunksWithEmbeddings[0]?.count || 0;
      const embeddingCoverage = totalChunks > 0 ? chunksWithEmbeddingsCount / totalChunks : 0;

      // Get most accessed documents based on search history (simplified approach)
      const mostAccessedDocuments = filesWithStats
        .slice(0, 5)
        .map(file => ({
          id: file.id,
          name: file.filename || 'Unknown',
          accessCount: file.chunkCount || 0,
          lastAccessed: file.createdAt.toISOString()
        }));

      // Calculate chunk utilization (simplified - based on embedding coverage)
      const chunkUtilization = embeddingCoverage; // Use embedding coverage as a proxy for utilization

      // Get search metrics from search_history (simplified)
      const [searchMetricsData] = await db.select({
        totalSearches: sql<number>`count(*)::int`,
        averageResponseTime: sql<number>`avg(search_time)::int`,
        averageRelevanceScore: sql<number>`avg(average_score)::float`,
        successRate: sql<number>`avg(CASE WHEN success THEN 1.0 ELSE 0.0 END)::float`
      })
      .from(searchHistory)
      .where(sql`${searchHistory.createdAt} >= ${startTime.toISOString()}`);

      // Get additional metrics from rag_search_queries (simplified)
      const [ragSearchMetricsData] = await db.select({
        totalRAGSearches: sql<number>`count(*)::int`,
        averageRAGResponseTime: sql<number>`avg(search_time)::int`,
        averageRAGRelevanceScore: sql<number>`avg(average_score)::float`,
        ragSuccessRate: sql<number>`avg(CASE WHEN success THEN 1.0 ELSE 0.0 END)::float`
      })
      .from(ragSearchQueries)
      .where(sql`${ragSearchQueries.createdAt} >= ${startTime.toISOString()}`);
      
      const totalSearches = (searchMetricsData?.totalSearches || 0) + (ragSearchMetricsData?.totalRAGSearches || 0);
      const averageResponseTime = Math.round(
        ((searchMetricsData?.averageResponseTime || 0) + (ragSearchMetricsData?.averageRAGResponseTime || 0)) / 2
      );
      const averageRelevanceScore = Math.round(
        ((searchMetricsData?.averageRelevanceScore || 0) + (ragSearchMetricsData?.averageRAGRelevanceScore || 0)) / 2 * 100
      ) / 100;
      const successRate = Math.round(
        ((searchMetricsData?.successRate || 0) + (ragSearchMetricsData?.ragSuccessRate || 0)) / 2 * 100
      ) / 100;

      // Get top queries from search_history (simplified)
      const topQueriesData = await db.select({
        query: searchHistory.query,
        frequency: sql<number>`count(*)::int`,
        averageScore: sql<number>`avg(average_score)::float`
      })
      .from(searchHistory)
      .where(sql`${searchHistory.createdAt} >= ${startTime.toISOString()}`)
      .groupBy(searchHistory.query)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

      const topQueries = topQueriesData.map(q => ({
        query: q.query,
        frequency: q.frequency,
        averageScore: q.averageScore || 0
      }));

      // Build analytics response with real data
      const analytics = {
        searchMetrics: {
          totalSearches,
          averageResponseTime,
          successRate,
          topQueries
        },
        documentMetrics: {
          totalDocuments,
          totalChunks,
          mostAccessedDocuments,
          chunkUtilization,
          embeddingCoverage
        },
        performanceMetrics: {
          averageRelevanceScore,
          contextEfficiency: Math.round(chunkUtilization * 100) / 100, // Based on actual chunk utilization
          searchLatency: averageResponseTime,
          embeddingGenerationTime: Math.round(embeddingCoverage * 200) // Estimate based on embedding coverage
        }
      };
      
      reply.send(analytics);
    } catch (error) {
      logger.error('RAG analytics failed:', error);
      logger.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timeRange,
        includeDetails
      });
      reply.status(500).send({
        error: 'RAG analytics failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check server logs for more information'
      });
    }
  });

  // Hybrid Search - Combining vector and keyword search
  fastify.post('/search/hybrid', {
    preHandler: [authenticateToken as any],
    schema: {
      description: 'Perform hybrid search combining vector and keyword search',
      tags: ['rag'],
      body: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          fileIds: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number', default: 5 },
          vectorWeight: { type: 'number', default: 0.7, minimum: 0, maximum: 1 },
          keywordWeight: { type: 'number', default: 0.3, minimum: 0, maximum: 1 },
          threshold: { type: 'number', default: 0.1 },
          includeMetadata: { type: 'boolean', default: true },
          sessionId: { type: 'string' }
        },
        required: ['query']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  content: { type: 'string' },
                  score: { type: 'number' },
                  vectorScore: { type: 'number' },
                  keywordScore: { type: 'number' },
                  metadata: { type: 'object' },
                  file: { type: 'object' }
                }
              }
            },
            totalResults: { type: 'number' },
            searchTime: { type: 'number' },
            searchMethod: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const {
      query,
      fileIds = [],
      limit = 5,
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      threshold = 0.1,
      includeMetadata = true,
      sessionId
    } = request.body as {
      query: string;
      fileIds?: string[];
      limit?: number;
      vectorWeight?: number;
      keywordWeight?: number;
      threshold?: number;
      includeMetadata?: boolean;
      sessionId?: string;
    };
    const userId = (request as any).user?.id;

    try {
      const startTime = Date.now();

      // Perform both vector and keyword search
      const vectorResults = await ragService.search({
        query,
        fileIds,
        userId,
        limit: limit * 2, // Get more results for fusion
        threshold: 0.1, // Lower threshold for initial retrieval
        includeMetadata
      });

      // Real keyword search using PostgreSQL full-text search (tsvector/tsquery)
      // Sanitize query for tsquery: strip special chars, join terms with &
      const tsQuery = query
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(t => `${t}:*`) // prefix matching
        .join(' & ');

      let keywordRows: { id: string; rank: number }[] = [];
      if (tsQuery) {
        const chunkIds = vectorResults.map(r => r.id).filter(Boolean);
        const whereClause = chunkIds.length > 0
          ? sql`dc.id = ANY(${chunkIds}) AND to_tsvector('english', dc.content) @@ to_tsquery('english', ${tsQuery})`
          : sql`to_tsvector('english', dc.content) @@ to_tsquery('english', ${tsQuery})`;

        try {
          const rows = await db.execute<{ id: string; rank: number }>(sql`
            SELECT dc.id, ts_rank(to_tsvector('english', dc.content), to_tsquery('english', ${tsQuery})) AS rank
            FROM document_chunks dc
            WHERE ${whereClause}
          `);
          keywordRows = (rows as any) as { id: string; rank: number }[];
        } catch {
          // tsvector search failed (e.g. empty tsquery) — fall back to zero scores
        }
      }

      const keywordScoreMap = new Map<string, number>(
        keywordRows.map(r => [r.id, Math.min(Number(r.rank) * 5, 1.0)])
      );

      const keywordResults = vectorResults.map(result => ({
        ...result,
        keywordScore: keywordScoreMap.get(result.id) ?? 0,
      }));

      // Combine and rank results
      const combinedResults = vectorResults.map((vectorResult, index) => {
        const keywordResult = keywordResults[index];
        const combinedScore = (vectorResult.score * vectorWeight) + (keywordResult.keywordScore * keywordWeight);
        
        return {
          ...vectorResult,
          vectorScore: vectorResult.score,
          keywordScore: keywordResult.keywordScore,
          score: combinedScore
        };
      });

      // Sort by combined score and apply threshold
      const finalResults = combinedResults
        .filter(result => result.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      const searchTime = Date.now() - startTime;
      
      // Log search query to session if sessionId provided
      if (sessionId) {
        try {
          const averageScore = finalResults.length > 0 
            ? finalResults.reduce((sum, r) => sum + r.score, 0) / finalResults.length 
            : 0;

          await db.insert(ragSearchQueries).values({
            sessionId,
            query,
            resultsCount: finalResults.length,
            searchTime,
            averageScore,
            searchType: 'hybrid',
            parameters: {
              limit,
              threshold,
              vectorWeight,
              keywordWeight,
              includeMetadata
            },
            success: true
          });

          // Update session updatedAt timestamp
          await db.update(ragSearchSessions)
            .set({ updatedAt: new Date() })
            .where(eq(ragSearchSessions.id, sessionId));
        } catch (error) {
          logger.warn('Failed to log search query to session:', error);
        }
      }
      
      reply.send({
        query,
        results: finalResults,
        totalResults: finalResults.length,
        searchTime,
        searchMethod: 'hybrid'
      });
    } catch (error) {
      logger.error('Hybrid search failed:', error);
      reply.status(500).send({
        error: 'Hybrid search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Query Enhancement - Rewrite and expand queries
  fastify.post('/query/enhance', {
    schema: {
      description: 'Enhance query with rewriting and expansion',
      tags: ['rag'],
      body: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          enhancementType: { 
            type: 'string', 
            enum: ['rewrite', 'expand', 'classify', 'all'], 
            default: 'all' 
          },
          context: { type: 'string' },
          maxExpansions: { type: 'number', default: 3 }
        },
        required: ['query']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            originalQuery: { type: 'string' },
            enhancedQuery: { type: 'string' },
            expandedQueries: { type: 'array', items: { type: 'string' } },
            queryClassification: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                complexity: { type: 'string' },
                domain: { type: 'string' },
                requiresContext: { type: 'boolean' }
              }
            },
            suggestions: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { 
      query, 
      enhancementType = 'all', 
      context = '', 
      maxExpansions = 3 
    } = request.body as {
      query: string;
      enhancementType?: string;
      context?: string;
      maxExpansions?: number;
    };
    
    try {
      // TODO: Implement actual query enhancement using LLM
      const mockEnhancement = {
        originalQuery: query,
        enhancedQuery: query + " (detailed analysis and examples)",
        expandedQueries: [
          query + " best practices",
          query + " implementation guide",
          query + " common issues and solutions"
        ].slice(0, maxExpansions),
        queryClassification: {
          type: query.includes('?') ? 'factual' : 'analytical',
          complexity: query.split(' ').length > 5 ? 'complex' : 'simple',
          domain: query.toLowerCase().includes('code') ? 'technical' : 'general',
          requiresContext: query.split(' ').length > 3
        },
        suggestions: [
          "Try adding more specific terms",
          "Consider breaking into multiple queries",
          "Include relevant context or examples"
        ]
      };
      
      reply.send(mockEnhancement);
    } catch (error) {
      logger.error('Query enhancement failed:', error);
      reply.status(500).send({
        error: 'Query enhancement failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // RAG Chat - Conversational interface with knowledge base
  fastify.post('/chat', {
    preHandler: [optionalAuth as any],
    schema: {
      description: 'Chat with the knowledge base using RAG',
      tags: ['rag', 'chat'],
      body: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          conversationId: { type: 'string' },
          documentIds: { type: 'array', items: { type: 'string' } },
          includeContext: { type: 'boolean', default: true },
          maxTokens: { type: 'number', default: 1000 },
          model: { type: 'string', default: 'llama-3.1-8b-instant' },
          mode: { type: 'string', enum: ['standard', 'research', 'compliance', 'decision'], default: 'standard' }
        },
        required: ['message']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            response: { type: 'string' },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  filename: { type: 'string' },
                  content: { type: 'string' },
                  score: { type: 'number' },
                  chunkIndex: { type: 'number' }
                }
              }
            },
            conversationId: { type: 'string' },
            timestamp: { type: 'string' },
            mode: { type: 'string' },
            confidence: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { message, conversationId, documentIds, includeContext = true, maxTokens = 1000, model = 'llama-3.1-8b-instant', mode: modeId } = request.body as {
      message: string;
      conversationId?: string;
      documentIds?: string[];
      includeContext?: boolean;
      maxTokens?: number;
      model?: string;
      mode?: string;
    };
    const userId = (request as any).user?.id;

    try {
      const result = await runRagChat({
        message,
        conversationId,
        documentIds,
        maxTokens,
        model,
        mode: modeId,
        userId,
      });

      return reply.send(result);
    } catch (error) {
      if (error instanceof RAGChatError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      logger.error('RAG chat failed:', error);
      return reply.status(500).send({
        error: 'Chat failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Context Management - Dynamic context window sizing
  fastify.post('/context/optimize', {
    schema: {
      description: 'Optimize context window for given query and documents',
      tags: ['rag'],
      body: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          documentIds: { type: 'array', items: { type: 'string' } },
          maxTokens: { type: 'number', default: 4000 },
          priorityScoring: { type: 'boolean', default: true },
          contextCompression: { type: 'boolean', default: false }
        },
        required: ['query', 'documentIds']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            optimizedContext: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  content: { type: 'string' },
                  relevanceScore: { type: 'number' },
                  tokenCount: { type: 'number' },
                  priority: { type: 'number' }
                }
              }
            },
            totalTokens: { type: 'number' },
            compressionRatio: { type: 'number' },
            contextEfficiency: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { 
      query, 
      documentIds, 
      maxTokens = 4000, 
      priorityScoring = true, 
      contextCompression = false 
    } = request.body as {
      query: string;
      documentIds: string[];
      maxTokens?: number;
      priorityScoring?: boolean;
      contextCompression?: boolean;
    };
    
    try {
      // Get relevant chunks for the documents
      const searchResults = await ragService.search({
        query,
        fileIds: documentIds,
        limit: 20, // Get more chunks for optimization
        threshold: 0.1,
        includeMetadata: true
      });

      // TODO: Implement actual context optimization
      const optimizedContext = searchResults
        .map((result, index) => ({
          id: result.id,
          content: result.content,
          relevanceScore: result.score,
          tokenCount: Math.ceil(result.content.length / 4), // Rough token estimation
          priority: priorityScoring ? result.score * (1 - index * 0.05) : 1.0
        }))
        .sort((a, b) => b.priority - a.priority);

      // Fit within token limit
      let totalTokens = 0;
      const finalContext = [];
      
      for (const chunk of optimizedContext) {
        if (totalTokens + chunk.tokenCount <= maxTokens) {
          finalContext.push(chunk);
          totalTokens += chunk.tokenCount;
        } else {
          break;
        }
      }

      const compressionRatio = contextCompression ? 0.8 : 1.0;
      const contextEfficiency = finalContext.length > 0 ? 
        finalContext.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / finalContext.length : 0;

      reply.send({
        optimizedContext: finalContext,
        totalTokens: Math.floor(totalTokens * compressionRatio),
        compressionRatio,
        contextEfficiency
      });
    } catch (error) {
      logger.error('Context optimization failed:', error);
      reply.status(500).send({
        error: 'Context optimization failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // RAG Search Sessions Management

  // Create new RAG search session
  fastify.post('/sessions', {
    schema: {
      description: 'Create a new RAG search session',
      tags: ['rag', 'sessions'],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          searchType: { type: 'string', enum: ['vector', 'keyword', 'hybrid'] },
          parameters: { type: 'object' },
          documentIds: { type: 'array', items: { type: 'string' } }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            shortId: { type: 'string' },
            title: { type: 'string' },
            searchType: { type: 'string' },
            userId: { type: 'string' },
            parameters: { type: 'object' },
            documentIds: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            queryCount: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { 
        title = 'New RAG Search', 
        searchType = 'hybrid',
        parameters = {
          limit: 5,
          threshold: 0.1,
          vectorWeight: 0.7,
          keywordWeight: 0.3,
          includeMetadata: true
        },
        documentIds = [] 
      } = request.body as {
        title?: string;
        searchType?: 'vector' | 'keyword' | 'hybrid';
        parameters?: {
          limit: number;
          threshold: number;
          vectorWeight: number;
          keywordWeight: number;
          includeMetadata: boolean;
        };
        documentIds?: string[];
      };

      // Generate unique short ID
      const shortId = await generateUniqueShortId(async (id) => {
        const existing = await db.query.ragSearchSessions.findFirst({
          where: eq(ragSearchSessions.shortId, id)
        });
        return !!existing;
      });

      // Create new RAG search session
      const newSession = await db.insert(ragSearchSessions).values({
        shortId,
        title,
        searchType,
        parameters,
        documentIds,
        isActive: true,
      }).returning({ 
        id: ragSearchSessions.id, 
        shortId: ragSearchSessions.shortId,
        title: ragSearchSessions.title,
        searchType: ragSearchSessions.searchType,
        parameters: ragSearchSessions.parameters,
        documentIds: ragSearchSessions.documentIds,
        createdAt: ragSearchSessions.createdAt,
        updatedAt: ragSearchSessions.updatedAt
      });

      const session = newSession[0];

      reply.send({
        id: session.id,
        shortId: session.shortId,
        title: session.title,
        searchType: session.searchType,
        userId: request.user?.id || null,
        parameters: session.parameters,
        documentIds: session.documentIds,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        queryCount: 0
      });
    } catch (error) {
      logger.error('Failed to create RAG search session:', error);
      reply.status(500).send({
        error: 'Failed to create RAG search session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get all RAG search sessions
  fastify.get('/sessions', {
    schema: {
      description: 'Get all RAG search sessions with pagination',
      tags: ['rag', 'sessions'],
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
                  searchType: { type: 'string' },
                  userId: { type: 'string' },
                  parameters: { type: 'object' },
                  documentIds: { type: 'array', items: { type: 'string' } },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  queryCount: { type: 'number' }
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
    try {
      const { page = 1, limit = 20, search } = request.query as {
        page?: number;
        limit?: number;
        search?: string;
      };

      const offset = (page - 1) * limit;

      // Build query conditions
      const conditions = [];
      if (search) {
        conditions.push(sql`${ragSearchSessions.title} ILIKE ${`%${search}%`}`);
      }

      // Get sessions with query count
      const sessions = await db
        .select({
          id: ragSearchSessions.id,
          shortId: ragSearchSessions.shortId,
          title: ragSearchSessions.title,
          searchType: ragSearchSessions.searchType,
          userId: ragSearchSessions.userId,
          parameters: ragSearchSessions.parameters,
          documentIds: ragSearchSessions.documentIds,
          createdAt: ragSearchSessions.createdAt,
          updatedAt: ragSearchSessions.updatedAt,
          queryCount: sql<number>`COALESCE(COUNT(${ragSearchQueries.id}), 0)`
        })
        .from(ragSearchSessions)
        .leftJoin(ragSearchQueries, eq(ragSearchSessions.id, ragSearchQueries.sessionId))
        .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
        .groupBy(ragSearchSessions.id)
        .orderBy(sql`${ragSearchSessions.updatedAt} DESC`)
        .limit(limit)
        .offset(offset);

      // Get total count
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(ragSearchSessions)
        .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined);

      const total = totalResult[0]?.count || 0;
      const pages = Math.ceil(total / limit);

      reply.send({
        sessions: sessions.map(session => ({
          ...session,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    } catch (error) {
      logger.error('Failed to get RAG search sessions:', error);
      reply.status(500).send({
        error: 'Failed to get RAG search sessions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get RAG search session queries
  fastify.get('/sessions/:sessionId/queries', {
    schema: {
      description: 'Get queries for a RAG search session',
      tags: ['rag', 'sessions'],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 50 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  query: { type: 'string' },
                  enhancedQuery: { type: 'string' },
                  resultsCount: { type: 'number' },
                  searchTime: { type: 'number' },
                  averageScore: { type: 'number' },
                  searchType: { type: 'string' },
                  parameters: { type: 'object' },
                  success: { type: 'boolean' },
                  errorMessage: { type: 'string' },
                  createdAt: { type: 'string' }
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
    try {
      const { sessionId } = request.params as { sessionId: string };
      const { page = 1, limit = 50 } = request.query as {
        page?: number;
        limit?: number;
      };

      const offset = (page - 1) * limit;

      // Get queries for the session
      const queries = await db
        .select()
        .from(ragSearchQueries)
        .where(eq(ragSearchQueries.sessionId, sessionId))
        .orderBy(sql`${ragSearchQueries.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      // Get total count
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(ragSearchQueries)
        .where(eq(ragSearchQueries.sessionId, sessionId));

      const total = totalResult[0]?.count || 0;
      const pages = Math.ceil(total / limit);

      reply.send({
        queries: queries.map(query => ({
          ...query,
          createdAt: query.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    } catch (error) {
      logger.error('Failed to get RAG search session queries:', error);
      reply.status(500).send({
        error: 'Failed to get RAG search session queries',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get RAG session messages
  fastify.get('/sessions/:sessionId/messages', {
    schema: {
      description: 'Get messages for a RAG chat session',
      tags: ['rag', 'sessions'],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      
      // For now, return empty messages - we'll implement proper storage later
      reply.send({
        messages: []
      });
    } catch (error) {
      logger.error('Failed to get RAG session messages:', error);
      reply.status(500).send({
        error: 'Failed to get RAG session messages',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Debug endpoint to test RAG service directly
  fastify.post('/debug-search', {
    schema: {
      description: 'Debug RAG search directly',
      tags: ['rag', 'debug'],
      body: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          threshold: { type: 'number', default: 0.1 }
        },
        required: ['query']
      }
    }
  }, async (request, reply) => {
    try {
      const { query, threshold = 0.1 } = request.body as { query: string; threshold?: number };
      
      logger.info(`Debug RAG search: "${query}" with threshold ${threshold}`);
      
      const searchResults = await ragService.search({
        query,
        limit: 5,
        threshold,
        includeMetadata: true
      });
      
      logger.info(`Debug RAG search results: ${searchResults.length} results`);
      
      return reply.send({
        query,
        results: searchResults,
        totalResults: searchResults.length,
        threshold
      });
    } catch (error) {
      logger.error('Debug RAG search failed:', error);
      return reply.status(500).send({ error: 'Debug search failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Send message in RAG session
  fastify.post('/sessions/:sessionId/messages', {
    schema: {
      description: 'Send a message in a RAG chat session',
      tags: ['rag', 'sessions'],
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          documentIds: { type: 'array', items: { type: 'string' } },
          includeContext: { type: 'boolean', default: true },
          maxTokens: { type: 'number', default: 1000 },
          model: { type: 'string', default: 'llama-3.1-8b-instant' }
        },
        required: ['message']
      }
    }
  }, async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const { message, documentIds, includeContext = true, maxTokens = 1000, model = 'llama-3.1-8b-instant' } = request.body as {
        message: string;
        documentIds?: string[];
        includeContext?: boolean;
        maxTokens?: number;
        model?: string;
      };
      const userId = (request as any).user?.id;

      // Get user API keys if available
      const userApiKeys = userId ? await getUserApiKeys(userId) : {};

      // Use the existing RAG chat logic but with session context
      const searchResults = await ragService.search({
        query: message,
        fileIds: documentIds,
        limit: 5,
        threshold: 0.1,
        includeMetadata: true
      });

      if (!searchResults || searchResults.length === 0) {
        return reply.send({
          response: "I couldn't find relevant information in the knowledge base to answer your question. Please try rephrasing your question or check if the relevant documents are uploaded and processed.",
          sources: [],
          sessionId,
          timestamp: new Date().toISOString()
        });
      }

      // Build a clean, business-focused context from search results
      const context = searchResults.map((result, index) => {
        const file = result.file || {};
        const filename = file.filename || result.metadata?.filename || 'documentation';
        return `[From ${filename}]\n${result.content}`;
      }).join('\n\n---\n\n');

      // Create a business-centric prompt for the LLM
      const systemPrompt = `You are an intelligent business assistant with access to a knowledge base. Your goal is to provide clear, actionable, and business-focused answers.

CORE PRINCIPLES:
• Focus on business value and practical outcomes
• Provide direct answers first, then supporting details
• Use clear, professional language that non-technical users understand
• Be concise but comprehensive
• Highlight key takeaways and action items

KNOWLEDGE BASE CONTENT:
${context}

HOW TO RESPOND:
1. Start with a direct answer to the user's question
2. Provide 2-3 key points that support your answer
3. Include practical next steps or recommendations when relevant
4. Keep technical jargon to a minimum - explain when necessary
5. Use natural, conversational language
6. Only mention source documents if directly relevant to understanding

FORMATTING STYLE:
• Use plain, clean text without markdown symbols
• Structure responses with clear sections (use "Key Points:", "Next Steps:", etc.)
• Use bullet points (•) or numbered lists (1., 2., 3.) for clarity
• Add line breaks between sections for readability
• Keep paragraphs short (2-4 sentences max)
• Make it scannable - busy professionals should quickly grasp the main points

TONE:
• Professional but approachable
• Confident and helpful
• Solution-oriented
• Empathetic to business needs`;

      const userPrompt = `Question: ${message}

Please provide a business-focused answer that helps me understand and take action.`;

      // Generate a proper conversational response using the LLM service
      let response: string;
      try {
        // Import the LLM service to generate a proper response
        const { llmService } = await import('../services/llm-providers.js');
        
        const llmResponse = await llmService.generateResponse(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          model, // Use the model specified in the request
          {
            temperature: 0.7, // Balanced creativity and accuracy
            maxTokens: maxTokens,
            topP: 1.0,
            frequencyPenalty: 0.0,
            presencePenalty: 0.0
          },
          userApiKeys
        );

        response = llmResponse.content || 'I apologize, but I was unable to generate a response. Please try rephrasing your question.';
      } catch (llmError) {
        logger.error('LLM service failed:', llmError);
        
        // Fallback to a business-focused summary if LLM fails
        const topResult = searchResults[0];
        const file = topResult.file || {};
        const filename = file.filename || topResult.metadata?.filename || 'the knowledge base';
        
        // Create a clean, business-focused fallback response
        const keyInsights = searchResults.slice(0, 3).map((result, index) => {
          const content = result.content.substring(0, 250).trim();
          return `${index + 1}. ${content}${result.content.length > 250 ? '...' : ''}`;
        }).join('\n\n');

        response = `Based on ${filename} and related documentation, here's what I found:\n\n${keyInsights}\n\n${searchResults.length > 3 ? `Additional information is available from ${searchResults.length - 3} more sources. ` : ''}Would you like me to elaborate on any specific aspect?`;
      }

      // Format sources for response
      const sources = searchResults.map(result => ({
        id: result.id,
        filename: result.file.filename || result.metadata.filename || 'Unknown',
        content: result.content,
        score: result.score,
        chunkIndex: result.metadata.chunkIndex
      }));

      return reply.send({
        response,
        sources,
        sessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('RAG session message failed:', error);
      reply.status(500).send({
        error: 'RAG session message failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
