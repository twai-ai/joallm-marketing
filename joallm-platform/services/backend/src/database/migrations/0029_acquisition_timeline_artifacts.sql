-- Phase A: relationship maturity on Person
ALTER TABLE "acquisition_persons"
  ADD COLUMN IF NOT EXISTS "relationship_maturity" text NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS "acquisition_persons_relationship_maturity_idx"
  ON "acquisition_persons" ("owner_user_id", "relationship_maturity");

-- Phase B: KnowledgeArtifact (Interpretation layer output on Timeline)
CREATE TABLE IF NOT EXISTS "knowledge_artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
  "person_id" uuid REFERENCES "acquisition_persons"("id") ON DELETE SET NULL,
  "initiative_id" uuid REFERENCES "acquisition_initiatives"("id") ON DELETE SET NULL,
  "acquisition_event_id" uuid REFERENCES "acquisition_events"("id") ON DELETE SET NULL,
  "interaction_id" uuid REFERENCES "acquisition_interactions"("id") ON DELETE SET NULL,
  "artifact_type" text NOT NULL,
  "title" text,
  "interpretation" jsonb DEFAULT '{}'::jsonb,
  "signals" jsonb DEFAULT '{}'::jsonb,
  "source_file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL,
  "knowledge_document_id" uuid,
  "media_asset_id" uuid,
  "occurred_at" timestamp,
  "created_at" timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "knowledge_artifacts_owner_user_id_idx"
  ON "knowledge_artifacts" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "knowledge_artifacts_person_id_idx"
  ON "knowledge_artifacts" ("person_id");
CREATE INDEX IF NOT EXISTS "knowledge_artifacts_source_file_id_idx"
  ON "knowledge_artifacts" ("source_file_id");
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_artifacts_owner_file_type_unique"
  ON "knowledge_artifacts" ("owner_user_id", "source_file_id", "artifact_type")
  WHERE "source_file_id" IS NOT NULL;
