-- Track which embedding model was used per chunk so dimension mismatches
-- (e.g. Cohere 1024-dim vs OpenAI 1536-dim) can be detected at query time.
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding_model TEXT;

CREATE INDEX IF NOT EXISTS document_chunks_embedding_model_idx
  ON document_chunks (embedding_model);
