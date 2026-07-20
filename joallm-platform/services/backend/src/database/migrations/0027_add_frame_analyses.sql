-- Migration: add frame_analyses table for vision-model analysis of video frames
CREATE TABLE IF NOT EXISTS "frame_analyses" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_id"        uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "timestamp_sec"  real NOT NULL,
  "description"    text NOT NULL,
  "objects"        text[] NOT NULL DEFAULT '{}',
  "detected_text"  text,
  "confidence"     real,
  "metadata"       jsonb NOT NULL DEFAULT '{}',
  "created_at"     timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "frame_analyses_file_id_idx"
  ON "frame_analyses" ("file_id");

CREATE INDEX IF NOT EXISTS "frame_analyses_file_timestamp_idx"
  ON "frame_analyses" ("file_id", "timestamp_sec");
