-- Migration: add user_integrations table for third-party OAuth connections (e.g. Google Workspace)
CREATE TABLE IF NOT EXISTS "user_integrations" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider"      text NOT NULL,
  "scopes"        text[] NOT NULL DEFAULT '{}',
  "access_token"  text NOT NULL,
  "refresh_token" text,
  "expires_at"    timestamp,
  "created_at"    timestamp DEFAULT now() NOT NULL,
  "updated_at"    timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_integrations_user_provider_unique"
  ON "user_integrations" ("user_id", "provider");

CREATE INDEX IF NOT EXISTS "user_integrations_user_id_idx"
  ON "user_integrations" ("user_id");
