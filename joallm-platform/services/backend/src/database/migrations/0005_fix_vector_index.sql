-- Fix vector index: Remove btree index and ensure ivfflat index exists
-- Issue: Cohere embeddings (1024 dimensions = 4096 bytes) exceed btree max (2704 bytes)
-- Solution: Use ivfflat vector index instead

-- Drop any existing btree index
DROP INDEX IF EXISTS "document_chunks_embedding_idx";

-- Create proper ivfflat vector index for pgvector
-- This is required for embeddings larger than 2704 bytes
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_idx" 
ON "document_chunks" 
USING ivfflat ("embedding" vector_cosine_ops) 
WITH (lists = 100);

-- Verify vector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add comment explaining the index type
COMMENT ON INDEX "document_chunks_embedding_idx" IS 
'IVFFlat vector index for similarity search using pgvector. Required for embeddings > 2704 bytes (btree limit).';

