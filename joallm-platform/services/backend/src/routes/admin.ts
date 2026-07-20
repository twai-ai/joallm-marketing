import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../database/connection.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export async function adminRoutes(fastify: FastifyInstance) {

  // Fix vector index endpoint
  fastify.post('/fix-vector-index', {
    preHandler: [authenticateToken, requireRole('admin')],
    schema: {
      description: 'Fix the vector index to use ivfflat instead of btree',
      tags: ['admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            previousIndex: { type: 'string' },
            newIndex: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('🔧 Fixing vector index...');
      
      // Check current index
      const currentIndexResult = await db.execute(sql`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE indexname = 'document_chunks_embedding_idx'
      `);
      
      const currentIndex = (currentIndexResult as any)[0];
      const previousIndexDef = currentIndex?.indexdef || 'No index found';
      
      logger.info(`Current index: ${previousIndexDef}`);
      
      // Check if it's already correct
      if (previousIndexDef.includes('ivfflat')) {
        return reply.send({
          success: true,
          message: 'Index is already correct (ivfflat)',
          previousIndex: previousIndexDef,
          newIndex: previousIndexDef
        });
      }
      
      // Drop existing index
      await db.execute(sql`DROP INDEX IF EXISTS "document_chunks_embedding_idx"`);
      logger.info('✓ Dropped old index');
      
      // Create new ivfflat index
      await db.execute(sql`
        CREATE INDEX "document_chunks_embedding_idx" 
        ON "document_chunks" 
        USING ivfflat ("embedding" vector_cosine_ops) 
        WITH (lists = 100)
      `);
      logger.info('✓ Created new ivfflat index');
      
      // Verify new index
      const newIndexResult = await db.execute(sql`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE indexname = 'document_chunks_embedding_idx'
      `);
      
      const newIndex = (newIndexResult as any)[0];
      const newIndexDef = newIndex?.indexdef || 'Unknown';
      
      logger.info(`New index: ${newIndexDef}`);
      
      if (newIndexDef.includes('ivfflat')) {
        logger.info('✅ Vector index fixed successfully!');
        return reply.send({
          success: true,
          message: 'Vector index fixed successfully! Embeddings can now be stored.',
          previousIndex: previousIndexDef,
          newIndex: newIndexDef
        });
      } else {
        throw new Error('Index was created but not as ivfflat');
      }
      
    } catch (error) {
      logger.error('Failed to fix vector index:', error);
      return reply.status(500).send({
        success: false,
        message: `Failed to fix index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check embedding storage status
  fastify.get('/check-embeddings', {
    preHandler: [authenticateToken, requireRole('admin')],
    schema: {
      description: 'Check how many chunks have embeddings stored',
      tags: ['admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            totalChunks: { type: 'number' },
            chunksWithEmbeddings: { type: 'number' },
            chunksWithoutEmbeddings: { type: 'number' },
            percentageIndexed: { type: 'number' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_chunks,
          COUNT(embedding) as chunks_with_embeddings,
          COUNT(*) - COUNT(embedding) as chunks_without_embeddings,
          ROUND((COUNT(embedding)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as percentage_indexed
        FROM document_chunks
      `);
      
      const result = (stats as any)[0];
      
      return reply.send({
        totalChunks: parseInt(result.total_chunks),
        chunksWithEmbeddings: parseInt(result.chunks_with_embeddings),
        chunksWithoutEmbeddings: parseInt(result.chunks_without_embeddings),
        percentageIndexed: parseFloat(result.percentage_indexed),
        message: result.chunks_with_embeddings === '0' 
          ? '❌ No chunks have embeddings! Run /admin/fix-vector-index then reprocess files.'
          : result.percentage_indexed === '100.00'
          ? '✅ All chunks are indexed!'
          : `⚠️ Only ${result.percentage_indexed}% of chunks are indexed. Some files need reprocessing.`
      });
      
    } catch (error) {
      logger.error('Failed to check embeddings:', error);
      return reply.status(500).send({
        error: 'Failed to check embedding status'
      });
    }
  });

  // Check vector index status
  fastify.get('/check-vector-index', {
    preHandler: [authenticateToken, requireRole('admin')],
    schema: {
      description: 'Check the status of the vector index',
      tags: ['admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            exists: { type: 'boolean' },
            type: { type: 'string' },
            indexDef: { type: 'string' },
            isCorrect: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const indexResult = await db.execute(sql`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE indexname = 'document_chunks_embedding_idx'
      `);
      
      const index = (indexResult as any)[0];
      
      if (!index) {
        return reply.send({
          exists: false,
          type: 'none',
          indexDef: '',
          isCorrect: false,
          message: 'No index exists - embeddings cannot be stored!'
        });
      }
      
      const indexDef = index.indexdef;
      const isIvfflat = indexDef.includes('ivfflat');
      const isBtree = indexDef.includes('btree');
      
      return reply.send({
        exists: true,
        type: isIvfflat ? 'ivfflat' : (isBtree ? 'btree' : 'unknown'),
        indexDef: indexDef,
        isCorrect: isIvfflat,
        message: isIvfflat 
          ? '✅ Index is correct (ivfflat) - embeddings will work!'
          : '❌ Index is btree - embeddings will fail! Run /admin/fix-vector-index to fix.'
      });
      
    } catch (error) {
      logger.error('Failed to check vector index:', error);
      return reply.status(500).send({
        error: 'Failed to check index status'
      });
    }
  });
}

