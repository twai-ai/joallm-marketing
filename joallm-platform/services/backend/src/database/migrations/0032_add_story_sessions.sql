-- Story sessions: Studio create workspace for multi-medium narrative compose.
-- Free-floating until attach (program_id / campaign_id). Not a new aggregate root.
-- Constitution: Studio creates. Products operate. Platform remembers.

CREATE TABLE IF NOT EXISTS "story_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
  "title" text NOT NULL DEFAULT 'Untitled story',
  "status" text NOT NULL DEFAULT 'draft',
  "program_id" text,
  "campaign_id" uuid,
  "arc" text NOT NULL DEFAULT 'context_proof_ask',
  "tone" text NOT NULL DEFAULT 'atrisi_institutional',
  "beats" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "story_sessions_owner_user_id_idx" ON "story_sessions" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "story_sessions_organization_id_idx" ON "story_sessions" ("organization_id");
CREATE INDEX IF NOT EXISTS "story_sessions_status_idx" ON "story_sessions" ("status");
CREATE INDEX IF NOT EXISTS "story_sessions_program_id_idx" ON "story_sessions" ("owner_user_id", "program_id");
