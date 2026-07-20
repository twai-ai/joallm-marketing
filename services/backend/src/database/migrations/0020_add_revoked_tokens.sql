-- Token blacklist table: DB fallback for token revocation when Redis is unavailable.
-- Entries are cleaned up opportunistically on insert and can be pruned by a cron job.
CREATE TABLE IF NOT EXISTS "revoked_tokens" (
  "token_hash" text PRIMARY KEY,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "revoked_tokens_expires_at_idx" ON "revoked_tokens" ("expires_at");
