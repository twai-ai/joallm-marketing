import { eq, and, sql } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { documentChunks } from '../database/schema.js';
import { embeddingService } from './embedding-service.js';
import { logger } from '../utils/logger.js';
import { enhancedRAGService } from './enhanced-rag-service.js';

export interface RAGSearchResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    fileId: string | null;
    filename: string;
    chunkIndex: number;
    pageNumber?: number;
    startChar: number;
    endChar: number;
  };
  file: {
    id: string | null;
    filename: string;
    uploadDate: string;
    size: number;
  };
}

export interface RAGSearchOptions {
  query: string;
  fileIds?: string[];
  userId?: string;
  limit?: number;
  threshold?: number;
  includeMetadata?: boolean;
}

export class RAGService {
  // Delegates to enhancedRAGService so there is a single authoritative search implementation.
  // Callers that need hybrid/keyword modes should prefer enhancedRAGService directly.
  async search(options: RAGSearchOptions): Promise<RAGSearchResult[]> {
    const { query, fileIds = [], userId, limit = 5, threshold = 0.7 } = options;
    try {
      const results = await enhancedRAGService.search({ query, fileIds, userId, limit, threshold });
      return results.map(r => ({
        id: r.id,
        content: r.content,
        score: r.score,
        metadata: {
          fileId: r.metadata.fileId,
          filename: r.metadata.filename,
          chunkIndex: r.metadata.chunkIndex,
          pageNumber: r.metadata.pageNumber,
          startChar: r.metadata.startChar,
          endChar: r.metadata.endChar,
        },
        file: {
          id: r.file.id,
          filename: r.file.filename,
          uploadDate: r.file.uploadDate,
          size: r.file.size,
        },
      }));
    } catch (error) {
      logger.error('RAG search failed:', error);
      throw new Error('RAG search failed');
    }
  }

  async indexDocument(fileId: string): Promise<void> {
    try {
      logger.info(`📊 Starting indexing for document: ${fileId}`);

      // Get document chunks that don't have embeddings
      const chunksWithoutEmbeddings = await db
        .select()
        .from(documentChunks)
        .where(
          and(
            eq(documentChunks.fileId, fileId),
            sql`${documentChunks.embedding} IS NULL`
          )
        );

      logger.info(`Found ${chunksWithoutEmbeddings.length} chunks without embeddings for ${fileId}`);

      if (chunksWithoutEmbeddings.length === 0) {
        logger.info(`✓ No chunks to index for document: ${fileId} (already indexed)`);
        return;
      }

      logger.info(`🔄 Generating embeddings for ${chunksWithoutEmbeddings.length} chunks using embedding service`);

      // Generate embeddings for all chunks
      const texts = chunksWithoutEmbeddings.map(chunk => chunk.content);
      logger.info(`Calling embedding service with ${texts.length} texts...`);
      
      const embeddingResults = await embeddingService.generateEmbeddings(texts);
      logger.info(`✓ Received ${embeddingResults.length} embeddings from service`);

      // Update chunks with embeddings in small batches to avoid a long serial write tail.
      logger.info(`Updating database with embeddings...`);
      const updates = chunksWithoutEmbeddings.map((chunk, index) =>
        db
          .update(documentChunks)
          .set({
            embedding: embeddingResults[index].embedding,
            embeddingModel: embeddingResults[index].model,
          })
          .where(eq(documentChunks.id, chunk.id))
      );

      for (let i = 0; i < updates.length; i += 20) {
        await Promise.all(updates.slice(i, i + 20));
      }

      logger.info(`✅ Successfully indexed ${chunksWithoutEmbeddings.length} chunks for document: ${fileId}`);

    } catch (error) {
      logger.error(`Failed to index document ${fileId}:`, error);
      throw new Error('Document indexing failed');
    }
  }

  async reindexDocument(fileId: string): Promise<void> {
    try {
      logger.info(`Reindexing document: ${fileId}`);

      // Clear existing embeddings
      await db
        .update(documentChunks)
        .set({ embedding: null })
        .where(eq(documentChunks.fileId, fileId));

      // Reindex the document
      await this.indexDocument(fileId);

      logger.info(`Successfully reindexed document: ${fileId}`);

    } catch (error) {
      logger.error(`Failed to reindex document ${fileId}:`, error);
      throw new Error('Document reindexing failed');
    }
  }

  async getDocumentChunks(fileId: string, page: number = 1, limit: number = 20) {
    try {
      const offset = (page - 1) * limit;

      const chunks = await db
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.fileId, fileId))
        .orderBy(documentChunks.chunkIndex)
        .limit(limit)
        .offset(offset);

      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(documentChunks)
        .where(eq(documentChunks.fileId, fileId));

      return {
        chunks: chunks.map(chunk => ({
          id: chunk.id,
          content: chunk.content,
          index: chunk.chunkIndex,
          metadata: chunk.metadata,
        })),
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      };

    } catch (error) {
      logger.error(`Failed to get document chunks for ${fileId}:`, error);
      throw new Error('Failed to retrieve document chunks');
    }
  }

  async getStats() {
    try {
      const stats = await db
        .select({
          totalDocuments: sql<number>`count(distinct ${documentChunks.fileId})`,
          totalChunks: sql<number>`count(*)`,
          totalEmbeddings: sql<number>`count(${documentChunks.embedding})`,
          averageChunkSize: sql<number>`avg(length(${documentChunks.content}))`,
        })
        .from(documentChunks);

      const lastIndexed = await db
        .select({
          lastIndexedAt: sql<Date>`max(${documentChunks.createdAt})`,
        })
        .from(documentChunks)
        .where(sql`${documentChunks.embedding} IS NOT NULL`);

      return {
        totalDocuments: stats[0].totalDocuments || 0,
        totalChunks: stats[0].totalChunks || 0,
        totalEmbeddings: stats[0].totalEmbeddings || 0,
        averageChunkSize: Math.round(stats[0].averageChunkSize || 0),
        lastIndexedAt: lastIndexed[0].lastIndexedAt?.toISOString(),
        supportedFileTypes: ['PDF', 'TXT', 'MD', 'DOC', 'DOCX'],
      };

    } catch (error) {
      logger.error('Failed to get RAG stats:', error);
      throw new Error('Failed to retrieve RAG statistics');
    }
  }
}

export const ragService = new RAGService();

