-- Fix embedding storage to use proper vector type
-- This migration converts text embeddings to vector type for proper pgvector support

-- First, ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add a new vector column for embeddings (Cohere embed-english-v3.0 uses 1024 dimensions)
ALTER TABLE "document_chunks" ADD COLUMN "embedding_vector" vector(1024);

-- Migrate existing JSON string embeddings to vector format
-- This will handle both JSON arrays and existing vector data
UPDATE "document_chunks" 
SET "embedding_vector" = CASE 
  WHEN "embedding" IS NULL THEN NULL
  WHEN "embedding"::text ~ '^\[.*\]$' THEN 
    -- Parse JSON array and convert to vector
    ("embedding"::jsonb)::text::vector
  ELSE 
    -- Handle existing vector data if any
    "embedding"::vector
END
WHERE "embedding" IS NOT NULL;

-- Drop the old embedding column
ALTER TABLE "document_chunks" DROP COLUMN "embedding";

-- Rename the new column to the original name
ALTER TABLE "document_chunks" RENAME COLUMN "embedding_vector" TO "embedding";

-- Recreate the vector index for better performance
DROP INDEX IF EXISTS "document_chunks_embedding_idx";
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- Add a comment to document the change
COMMENT ON COLUMN "document_chunks"."embedding" IS 'Vector embeddings using pgvector extension for similarity search';
