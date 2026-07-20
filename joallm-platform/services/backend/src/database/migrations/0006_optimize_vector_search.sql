-- Optimize vector search with HNSW index
-- This migration adds optimized indexes for pgvector similarity search

-- Drop existing index if it exists
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- Create optimized HNSW index for vector similarity search
-- HNSW (Hierarchical Navigable Small World) is faster than IVFFlat for large datasets
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- m: maximum number of connections per node (higher = better recall, more memory)
-- ef_construction: size of dynamic candidate list during construction (higher = better recall, slower build)

-- Add comment
COMMENT ON INDEX document_chunks_embedding_hnsw_idx IS 'HNSW index for fast vector similarity search using cosine distance';



