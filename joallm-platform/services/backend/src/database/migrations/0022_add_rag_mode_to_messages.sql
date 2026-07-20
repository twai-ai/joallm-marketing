ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "rag_mode" text CHECK ("rag_mode" IN ('standard', 'research', 'compliance', 'decision'));
CREATE INDEX IF NOT EXISTS "messages_rag_mode_idx" ON "messages" ("rag_mode");
