-- Fix embedding index to use pgvector-compatible index types
-- The B-tree index is too small for 1024-dimensional vectors

-- Drop the problematic B-tree index
DROP INDEX IF EXISTS "document_chunks_embedding_idx";

-- Create a proper ivfflat index for pgvector
-- ivfflat is optimized for approximate nearest neighbor search with vectors
-- The 'lists' parameter controls the number of clusters (100 is a good default for small to medium datasets)
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_ivfflat_idx" 
ON "document_chunks" 
USING ivfflat ("embedding" vector_cosine_ops) 
WITH (lists = 100);

-- Alternative: If you want exact nearest neighbor search (slower but more accurate)
-- CREATE INDEX IF NOT EXISTS "document_chunks_embedding_idx" 
-- ON "document_chunks" 
-- USING ivfflat ("embedding" vector_l2_ops) 
-- WITH (lists = 100);

-- Add index on file_id for faster lookups
CREATE INDEX IF NOT EXISTS "document_chunks_file_id_idx" 
ON "document_chunks" ("file_id");

-- Add index on chunk_index for ordered retrieval
CREATE INDEX IF NOT EXISTS "document_chunks_chunk_index_idx" 
ON "document_chunks" ("chunk_index");

-- Verify the indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'document_chunks'
ORDER BY indexname;




