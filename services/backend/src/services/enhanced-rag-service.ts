import { eq, and, sql, desc, asc, or, like, inArray } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { documentChunks, files, searchHistory } from '../database/schema.js';
import { embeddingService } from './embedding-service.js';
import { logger } from '../utils/logger.js';

export interface EnhancedRAGSearchResult {
  id: string;
  content: string;
  score: number;
  vectorScore: number;
  keywordScore: number;
  metadata: {
    fileId: string | null;
    filename: string;
    chunkIndex: number;
    pageNumber?: number;
    startChar: number;
    endChar: number;
    section?: string;
    heading?: string;
  };
  file: {
    id: string | null;
    filename: string;
    uploadDate: string;
    size: number;
    mimetype: string;
  };
}

export interface EnhancedRAGSearchOptions {
  query: string;
  fileIds?: string[];
  userId?: string;
  limit?: number;
  threshold?: number;
  includeMetadata?: boolean;
  searchType?: 'vector' | 'keyword' | 'hybrid';
  vectorWeight?: number;
  keywordWeight?: number;
  boostRecent?: boolean;
  boostPopular?: boolean;
}

export interface QueryEnhancementResult {
  originalQuery: string;
  enhancedQuery: string;
  expandedQueries: string[];
  queryClassification: {
    type: 'factual' | 'analytical' | 'procedural' | 'conceptual';
    complexity: 'simple' | 'medium' | 'complex';
    domain: 'technical' | 'business' | 'general';
    requiresContext: boolean;
  };
  suggestions: string[];
}

export class EnhancedRAGService {
  private readonly CHUNK_SIZE = 512;
  private readonly CHUNK_OVERLAP = 50;
  private readonly MAX_QUERY_LENGTH = 1000;

  async search(options: EnhancedRAGSearchOptions): Promise<EnhancedRAGSearchResult[]> {
    const {
      query,
      fileIds = [],
      userId,
      limit = 5,
      threshold = 0.3, // Lowered from 0.7 to 0.3 for better recall
      includeMetadata = true,
      searchType = 'hybrid',
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      boostRecent = false,
      boostPopular = false
    } = options;

    try {
      logger.info(`Enhanced RAG search: "${query}" (type: ${searchType}, limit: ${limit})`);

      // Enhance the query first
      const enhancedQuery = await this.enhanceQuery(query);
      
      let results: EnhancedRAGSearchResult[] = [];

      switch (searchType) {
        case 'vector':
          results = await this.vectorSearch(enhancedQuery.enhancedQuery, fileIds, userId, limit * 2, threshold);
          // If vector search returns no results, fall back to keyword search
          if (results.length === 0) {
            logger.info('Vector search returned no results, falling back to keyword search');
            results = await this.keywordSearch(enhancedQuery.enhancedQuery, fileIds, userId, limit * 2, threshold);
          }
          break;
        case 'keyword':
          results = await this.keywordSearch(enhancedQuery.enhancedQuery, fileIds, userId, limit * 2, threshold);
          break;
        case 'hybrid':
          results = await this.hybridSearch(
            enhancedQuery.enhancedQuery,
            fileIds,
            userId,
            limit * 2,
            threshold,
            vectorWeight,
            keywordWeight
          );
          break;
      }

      // Apply boosting if requested
      if (boostRecent || boostPopular) {
        results = await this.applyBoosting(results, boostRecent, boostPopular);
      }

      // Apply final filtering and ranking
      const finalResults = results
        .filter(result => result.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Log search to history
      await this.logSearch(query, finalResults.length, 0); // TODO: Calculate actual search duration

      logger.info(`Enhanced RAG search completed: ${finalResults.length} results`);
      return finalResults;

    } catch (error) {
      logger.error('Enhanced RAG search failed:', error);
      throw new Error('Enhanced RAG search failed');
    }
  }

  private async vectorSearch(
    query: string,
    fileIds: string[],
    userId: string | undefined,
    limit: number,
    threshold: number
  ): Promise<EnhancedRAGSearchResult[]> {
    try {
      // Generate query embedding — capture model name for dimension-mismatch guard
      let queryEmbedding: number[];
      let queryModel: string;
      try {
        const result = await embeddingService.generateQueryEmbeddingFull(query);
        queryEmbedding = result.embedding;
        queryModel = result.model;
      } catch (embeddingError) {
        logger.warn('Failed to generate query embedding for vector search, returning empty results:', embeddingError);
        return [];
      }

      // Only search chunks indexed with the same model; null = pre-migration rows (safe fallback)
      const modelFilter = sql`(${documentChunks.embeddingModel} = ${queryModel} OR ${documentChunks.embeddingModel} IS NULL)`;

      // Use native pgvector cosine distance for vector search
      const vectorLiteral = `[${queryEmbedding.join(',')}]`;
      const results = await db
        .select({
          id: documentChunks.id,
          content: documentChunks.content,
          chunkIndex: documentChunks.chunkIndex,
          metadata: documentChunks.metadata,
          fileId: documentChunks.fileId,
          filename: files.filename,
          uploadDate: files.createdAt,
          size: files.size,
          mimetype: files.mimetype,
          distance: sql<number>`(${documentChunks.embedding} <=> ${vectorLiteral}::vector)`,
        })
        .from(documentChunks)
        .innerJoin(files, eq(documentChunks.fileId, files.id))
        .where(
          and(
            eq(files.status, 'processed'),
            sql`${documentChunks.embedding} IS NOT NULL`,
            modelFilter,
            fileIds.length > 0 ? inArray(documentChunks.fileId, fileIds) : sql`true`,
            fileIds.length === 0 && userId ? eq(files.userId, userId) : sql`true`
          )
        )
        .orderBy(sql`${documentChunks.embedding} <=> ${vectorLiteral}::vector`)
        .limit(limit * 2);

      if (results.length === 0) {
        logger.info('No chunks with embeddings found for vector search');
        return [];
      }

      const resultsWithScores = results.map(result => {
        const similarity = 1 - result.distance;
        return {
          id: result.id,
          content: result.content,
          score: similarity,
          vectorScore: similarity,
          keywordScore: 0,
          metadata: {
            fileId: result.fileId,
            filename: result.filename,
            chunkIndex: result.chunkIndex,
            pageNumber: result.metadata?.pageNumber,
            startChar: result.metadata?.startChar || 0,
            endChar: result.metadata?.endChar || result.content.length,
            section: result.metadata?.section,
            heading: result.metadata?.heading,
          },
          file: {
            id: result.fileId,
            filename: result.filename,
            uploadDate: result.uploadDate.toISOString(),
            size: result.size,
            mimetype: result.mimetype,
          },
        };
      }) as EnhancedRAGSearchResult[];

      return resultsWithScores;

    } catch (error) {
      logger.error('Vector search failed:', error);
      // Return empty array instead of throwing - allows hybrid search to fall back to keyword
      return [];
    }
  }

  private async keywordSearch(
    query: string,
    fileIds: string[],
    userId: string | undefined,
    limit: number,
    threshold: number
  ): Promise<EnhancedRAGSearchResult[]> {
    try {
      // Extract keywords from query
      const keywords = this.extractKeywords(query);
      
      // If no keywords extracted, return empty results
      if (keywords.length === 0) {
        logger.warn('No keywords extracted from query for keyword search');
        return [];
      }
      
      // Build keyword search query using Postgres full-text search (tsvector / tsquery)
      // for proper tokenisation, stemming, and stop-word removal.
      const tsQuery = keywords.map(k => `${k}:*`).join(' | ');
      const results = await db
        .select({
          id: documentChunks.id,
          content: documentChunks.content,
          chunkIndex: documentChunks.chunkIndex,
          metadata: documentChunks.metadata,
          fileId: documentChunks.fileId,
          filename: files.filename,
          uploadDate: files.createdAt,
          size: files.size,
          mimetype: files.mimetype,
          rank: sql<number>`ts_rank(to_tsvector('english', ${documentChunks.content}), to_tsquery('english', ${tsQuery}))`,
        })
        .from(documentChunks)
        .innerJoin(files, eq(documentChunks.fileId, files.id))
        .where(
          and(
            eq(files.status, 'processed'),
            sql`to_tsvector('english', ${documentChunks.content}) @@ to_tsquery('english', ${tsQuery})`,
            fileIds.length > 0 ? inArray(documentChunks.fileId, fileIds) : sql`true`,
            fileIds.length === 0 && userId ? eq(files.userId, userId) : sql`true`
          )
        )
        .orderBy(sql`ts_rank(to_tsvector('english', ${documentChunks.content}), to_tsquery('english', ${tsQuery})) DESC`)
        .limit(limit * 2);

      // Use FTS rank as keyword score (normalise to 0-1 range via min-max)
      const maxRank = Math.max(...results.map(r => r.rank ?? 0), 1e-9);
      const resultsWithScores = results.map(result => {
        const keywordScore = (result.rank ?? 0) / maxRank;

        return {
          id: result.id,
          content: result.content,
          score: keywordScore,
          vectorScore: 0,
          keywordScore: keywordScore,
          metadata: {
            fileId: result.fileId,
            filename: result.filename,
            chunkIndex: result.chunkIndex,
            pageNumber: result.metadata?.pageNumber,
            startChar: result.metadata?.startChar || 0,
            endChar: result.metadata?.endChar || result.content.length,
            section: result.metadata?.section,
            heading: result.metadata?.heading,
          },
          file: {
            id: result.fileId,
            filename: result.filename,
            uploadDate: result.uploadDate.toISOString(),
            size: result.size,
            mimetype: result.mimetype,
          },
        };
      });

      return resultsWithScores;

    } catch (error) {
      logger.error('Keyword search failed:', error);
      // Return empty array instead of throwing to allow graceful degradation
      return [];
    }
  }

  private async hybridSearch(
    query: string,
    fileIds: string[],
    userId: string | undefined,
    limit: number,
    threshold: number,
    vectorWeight: number,
    keywordWeight: number
  ): Promise<EnhancedRAGSearchResult[]> {
    try {
      // Perform both vector and keyword search
      // Use Promise.allSettled to handle failures gracefully
      const [vectorResult, keywordResult] = await Promise.allSettled([
        this.vectorSearch(query, fileIds, userId, limit, 0.3).catch(() => []), // Lower threshold for initial retrieval
        this.keywordSearch(query, fileIds, userId, limit, 0.3).catch(() => [])
      ]);

      const vectorResults = vectorResult.status === 'fulfilled' ? vectorResult.value : [];
      const keywordResults = keywordResult.status === 'fulfilled' ? keywordResult.value : [];

      // If vector search failed or returned no results, rely more on keyword search
      const effectiveVectorWeight = vectorResults.length > 0 ? vectorWeight : 0;
      const effectiveKeywordWeight = vectorResults.length > 0 ? keywordWeight : 1.0;

      // Create a map of results by ID for efficient lookup
      const resultMap = new Map<string, EnhancedRAGSearchResult>();

      // Add vector results
      vectorResults.forEach(result => {
        resultMap.set(result.id, result);
      });

      // Merge keyword results
      keywordResults.forEach(result => {
        const existing = resultMap.get(result.id);
        if (existing) {
          // Combine scores using effective weights
          existing.keywordScore = result.keywordScore;
          existing.score = (existing.vectorScore * effectiveVectorWeight) + (result.keywordScore * effectiveKeywordWeight);
        } else {
          // Add new result with keyword score only
          result.score = result.keywordScore * effectiveKeywordWeight;
          resultMap.set(result.id, result);
        }
      });

      // Convert map back to array and sort by score
      return Array.from(resultMap.values())
        .sort((a, b) => b.score - a.score);

    } catch (error) {
      logger.error('Hybrid search failed:', error);
      // Fallback to keyword search only
      try {
        return await this.keywordSearch(query, fileIds, userId, limit, threshold);
      } catch (keywordError) {
        logger.error('Keyword search fallback also failed:', keywordError);
        return [];
      }
    }
  }

  private async enhanceQuery(query: string): Promise<QueryEnhancementResult> {
    try {
      // Basic query enhancement
      const enhancedQuery = query.trim();
      const expandedQueries = this.generateQueryExpansions(query);
      
      const classification = this.classifyQuery(query);
      const suggestions = this.generateSuggestions(query, classification);

      return {
        originalQuery: query,
        enhancedQuery,
        expandedQueries,
        queryClassification: classification,
        suggestions
      };

    } catch (error) {
      logger.error('Query enhancement failed:', error);
      return {
        originalQuery: query,
        enhancedQuery: query,
        expandedQueries: [query],
        queryClassification: {
          type: 'factual',
          complexity: 'medium',
          domain: 'general',
          requiresContext: true
        },
        suggestions: []
      };
    }
  }

  private extractKeywords(query: string): string[] {
    // Simple keyword extraction - in production, use NLP libraries
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 10); // Limit to 10 keywords
  }

  private calculateKeywordScore(content: string, keywords: string[]): number {
    const contentLower = content.toLowerCase();
    let score = 0;
    let totalKeywords = 0;

    keywords.forEach(keyword => {
      const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
      if (matches > 0) {
        score += matches;
        totalKeywords++;
      }
    });

    // Normalize score
    return totalKeywords > 0 ? Math.min(score / (content.length / 100), 1.0) : 0;
  }

  private generateQueryExpansions(query: string): string[] {
    // Simple query expansion - in production, use more sophisticated methods
    const expansions = [];
    
    if (query.includes('how')) {
      expansions.push(query.replace('how', 'what is the process for'));
      expansions.push(query.replace('how', 'what are the steps to'));
    }
    
    if (query.includes('what')) {
      expansions.push(query.replace('what', 'which'));
      expansions.push(query.replace('what', 'where can I find'));
    }

    return expansions.slice(0, 3);
  }

  private classifyQuery(query: string): QueryEnhancementResult['queryClassification'] {
    const queryLower = query.toLowerCase();
    
    let type: 'factual' | 'analytical' | 'procedural' | 'conceptual' = 'factual';
    if (queryLower.includes('how') || queryLower.includes('step')) {
      type = 'procedural';
    } else if (queryLower.includes('why') || queryLower.includes('analyze')) {
      type = 'analytical';
    } else if (queryLower.includes('what is') || queryLower.includes('define')) {
      type = 'conceptual';
    }

    const complexity = query.split(' ').length > 8 ? 'complex' : 
                      query.split(' ').length > 4 ? 'medium' : 'simple';

    let domain: 'technical' | 'business' | 'general' = 'general';
    if (queryLower.includes('code') || queryLower.includes('api') || queryLower.includes('function')) {
      domain = 'technical';
    } else if (queryLower.includes('business') || queryLower.includes('strategy') || queryLower.includes('market')) {
      domain = 'business';
    }

    return {
      type,
      complexity,
      domain,
      requiresContext: query.split(' ').length > 3
    };
  }

  private generateSuggestions(query: string, classification: QueryEnhancementResult['queryClassification']): string[] {
    const suggestions = [];
    
    if (classification.complexity === 'simple') {
      suggestions.push('Try adding more specific terms to your query');
    }
    
    if (classification.type === 'factual') {
      suggestions.push('Consider asking "how" or "why" for more detailed information');
    }
    
    if (classification.domain === 'technical') {
      suggestions.push('Include specific technology names or versions');
    }

    return suggestions;
  }

  private async applyBoosting(
    results: EnhancedRAGSearchResult[],
    boostRecent: boolean,
    boostPopular: boolean
  ): Promise<EnhancedRAGSearchResult[]> {
    // TODO: Implement boosting based on recency and popularity
    // This would require additional data like access counts and timestamps
    return results;
  }

  private async logSearch(query: string, resultCount: number, searchTime: number): Promise<void> {
    try {
      await db.insert(searchHistory).values({
        query,
        resultsCount: resultCount,
        searchTime: Math.min(searchTime, 2147483647), // Ensure it fits in 32-bit integer
        success: true,
        fileIds: null, // Don't pass empty array to avoid JSON parsing issues
      });
    } catch (error) {
      logger.warn('Failed to log search history:', error);
    }
  }

  // Advanced RAG features
  async getContextualSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      // Get similar queries from search history
      const similarQueries = await db
        .select({
          query: searchHistory.query,
          frequency: sql<number>`count(*)::int`
        })
        .from(searchHistory)
        .where(like(searchHistory.query, `%${query}%`))
        .groupBy(searchHistory.query)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      return similarQueries.map(q => q.query);

    } catch (error) {
      logger.error('Failed to get contextual suggestions:', error);
      return [];
    }
  }

  async getRelatedDocuments(fileId: string, limit: number = 5): Promise<EnhancedRAGSearchResult[]> {
    try {
      // Get a sample chunk from the document
      const sampleChunk = await db
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.fileId, fileId))
        .limit(1);

      if (sampleChunk.length === 0) {
        return [];
      }

      // Use the sample chunk content to find related documents
      return await this.search({
        query: sampleChunk[0].content.substring(0, 200),
        limit,
        threshold: 0.5,
        searchType: 'vector'
      });

    } catch (error) {
      logger.error('Failed to get related documents:', error);
      return [];
    }
  }

  async getDocumentSummary(fileId: string): Promise<string> {
    try {
      // Get all chunks for the document
      const chunks = await db
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.fileId, fileId))
        .orderBy(asc(documentChunks.chunkIndex))
        .limit(10); // Get first 10 chunks for summary

      if (chunks.length === 0) {
        return 'No content available for summary.';
      }

      // Combine chunks and create a summary
      const content = chunks.map(chunk => chunk.content).join(' ');
      return content.substring(0, 500) + (content.length > 500 ? '...' : '');

    } catch (error) {
      logger.error('Failed to get document summary:', error);
      return 'Failed to generate document summary.';
    }
  }

  /**
   * Search with confidence analysis to detect out-of-knowledge queries
   */
  async searchWithConfidence(options: EnhancedRAGSearchOptions): Promise<ConfidenceResult> {
    const results = await this.search(options);
    const explicitSelection = (options.fileIds ?? []).length > 0;

    // When the user explicitly selects documents, skip confidence tiering.
    // They know those files are relevant — return all results above the search threshold
    // so the full selected context reaches the LLM.
    if (explicitSelection) {
      if (results.length === 0) {
        logger.info('Explicit selection: no chunks found in selected files above threshold');
        return {
          hasRelevantResults: false,
          confidence: 'none',
          results: [],
          reason: 'No matching content found in the selected documents'
        };
      }
      logger.info(`Explicit selection: returning all ${results.length} results from selected files`);
      return {
        hasRelevantResults: true,
        confidence: results[0].score >= 0.6 ? 'high' : results[0].score >= 0.4 ? 'medium' : 'low',
        results,
        reason: `Found ${results.length} results from ${options.fileIds!.length} selected file(s)`
      };
    }

    // Open search: apply confidence tiering to avoid hallucination on weak matches
    // Strategy 1: any result >= 0.6
    const highConfidenceResults = results.filter(r => r.score >= 0.6);
    if (highConfidenceResults.length > 0) {
      logger.info(`High confidence: ${highConfidenceResults.length} results with score >= 0.6`);
      return {
        hasRelevantResults: true,
        confidence: 'high',
        results: highConfidenceResults,
        reason: `Found ${highConfidenceResults.length} highly relevant results`
      };
    }

    // Strategy 2: cluster of medium confidence results
    const mediumConfidenceResults = results.filter(r => r.score >= 0.4);
    if (mediumConfidenceResults.length >= 2) {
      logger.info(`Medium confidence: ${mediumConfidenceResults.length} results with score >= 0.4`);
      return {
        hasRelevantResults: true,
        confidence: 'medium',
        results: mediumConfidenceResults,
        reason: `Found ${mediumConfidenceResults.length} moderately relevant results`
      };
    }

    // Strategy 3: gap analysis — single standout result
    if (results.length > 0) {
      const topScore = results[0].score;
      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      const scoreGap = topScore - avgScore;
      if (topScore >= 0.35 && scoreGap >= 0.15) {
        logger.info(`Low confidence: Top score ${topScore.toFixed(3)}, gap ${scoreGap.toFixed(3)}`);
        return {
          hasRelevantResults: true,
          confidence: 'low',
          results: [results[0]],
          reason: 'Found one potentially relevant result with caution'
        };
      }
    }

    logger.info(`No confidence: Best score ${results.length > 0 ? results[0].score.toFixed(3) : 'N/A'}`);
    return {
      hasRelevantResults: false,
      confidence: 'none',
      results: [],
      reason: 'No relevant information found in knowledge base'
    };
  }
}

export interface ConfidenceResult {
  hasRelevantResults: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  results: EnhancedRAGSearchResult[];
  reason: string;
}

export const enhancedRAGService = new EnhancedRAGService();
