/**
 * Idempotent bootstrap for core JoaLLM / ATRISI Marketing tables.
 * Used when Drizzle migrate fails partway (or journal is behind schema).
 */
import { sql } from 'drizzle-orm';
import { db } from './connection.js';
import { logger } from '../utils/logger.js';

async function exec(label: string, statement: ReturnType<typeof sql>): Promise<void> {
  try {
    await db.execute(statement);
  } catch (error) {
    logger.warn(`ensureCorePlatformTables: ${label} skipped`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function ensureCorePlatformTables(): Promise<void> {
  logger.info('Ensuring core platform tables (chat, files, workflows, …)…');

  await exec(
    'users',
    sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" text NOT NULL,
        "password" text NOT NULL DEFAULT '',
        "name" text NOT NULL,
        "avatar" text,
        "role" text DEFAULT 'casual',
        "subscription_tier" text DEFAULT 'free',
        "usage_stats" jsonb,
        "api_keys" jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL,
        CONSTRAINT "users_email_unique" UNIQUE ("email")
      )
    `,
  );

  await exec('users.password', sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" text NOT NULL DEFAULT ''`);
  await exec('users.api_keys', sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "api_keys" jsonb`);

  await exec(
    'chat_sessions',
    sql`
      CREATE TABLE IF NOT EXISTS "chat_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "short_id" text NOT NULL,
        "slug" text,
        "title" text,
        "model" text NOT NULL,
        "parameters" jsonb,
        "auto_title" boolean DEFAULT false NOT NULL,
        "is_active" boolean DEFAULT true,
        "completion_status" text,
        "turn_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL,
        CONSTRAINT "chat_sessions_short_id_unique" UNIQUE ("short_id")
      )
    `,
  );
  await exec('chat_sessions.completion_status', sql`ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "completion_status" text`);
  await exec('chat_sessions.turn_count', sql`ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "turn_count" integer DEFAULT 0`);
  await exec('chat_sessions.short_id_idx', sql`CREATE INDEX IF NOT EXISTS "chat_sessions_short_id_idx" ON "chat_sessions" ("short_id")`);
  await exec('chat_sessions.user_id_idx', sql`CREATE INDEX IF NOT EXISTS "chat_sessions_user_id_idx" ON "chat_sessions" ("user_id")`);

  await exec(
    'messages',
    sql`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" uuid REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "model" text,
        "rag_mode" text,
        "attachments" jsonb,
        "usage" jsonb,
        "metadata" jsonb,
        "was_regenerated" boolean DEFAULT false,
        "was_copied" boolean DEFAULT false,
        "quality_score" real,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );
  await exec('messages.rag_mode', sql`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "rag_mode" text`);
  await exec('messages.was_regenerated', sql`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "was_regenerated" boolean DEFAULT false`);
  await exec('messages.was_copied', sql`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "was_copied" boolean DEFAULT false`);
  await exec('messages.quality_score', sql`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "quality_score" real`);
  await exec('messages.session_id_idx', sql`CREATE INDEX IF NOT EXISTS "messages_session_id_idx" ON "messages" ("session_id")`);

  await exec(
    'files',
    sql`
      CREATE TABLE IF NOT EXISTS "files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "filename" text NOT NULL,
        "original_name" text NOT NULL,
        "mimetype" text NOT NULL,
        "size" integer NOT NULL,
        "storage_provider" text DEFAULT 'volume',
        "storage_url" text,
        "storage_key" text,
        "status" text DEFAULT 'uploaded',
        "processing_error" text,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );
  await exec('files.user_id_idx', sql`CREATE INDEX IF NOT EXISTS "files_user_id_idx" ON "files" ("user_id")`);
  await exec('files.status_idx', sql`CREATE INDEX IF NOT EXISTS "files_status_idx" ON "files" ("status")`);

  await exec(
    'document_chunks',
    sql`
      CREATE TABLE IF NOT EXISTS "document_chunks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "file_id" uuid REFERENCES "files"("id") ON DELETE CASCADE,
        "content" text NOT NULL,
        "chunk_index" integer NOT NULL,
        "metadata" jsonb,
        "embedding" text,
        "embedding_model" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );
  await exec(
    'document_chunks.embedding_model',
    sql`ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "embedding_model" text`,
  );
  await exec(
    'document_chunks.embedding_model_idx',
    sql`CREATE INDEX IF NOT EXISTS "document_chunks_embedding_model_idx" ON "document_chunks" ("embedding_model")`,
  );

  // Legacy btree on embedding rows overflows Postgres btree max size when
  // embeddings are stored as text/json. Drop it; ivfflat needs pgvector.
  await exec(
    'document_chunks.drop_btree_embedding_idx',
    sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE indexname = 'document_chunks_embedding_idx'
            AND indexdef ILIKE '% USING btree %'
        ) THEN
          DROP INDEX IF EXISTS "document_chunks_embedding_idx";
        END IF;
      END $$;
    `,
  );

  await exec(
    'search_history',
    sql`
      CREATE TABLE IF NOT EXISTS "search_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "query" text NOT NULL,
        "results_count" integer DEFAULT 0,
        "search_time" integer DEFAULT 0,
        "average_score" real,
        "file_ids" jsonb,
        "success" boolean DEFAULT true,
        "error_message" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );
  await exec(
    'search_history.user_id_idx',
    sql`CREATE INDEX IF NOT EXISTS "search_history_user_id_idx" ON "search_history" ("user_id")`,
  );
  await exec(
    'search_history.created_at_idx',
    sql`CREATE INDEX IF NOT EXISTS "search_history_created_at_idx" ON "search_history" ("created_at")`,
  );
  await exec(
    'search_history.query_idx',
    sql`CREATE INDEX IF NOT EXISTS "search_history_query_idx" ON "search_history" ("query")`,
  );

  await exec(
    'message_feedback',
    sql`
      CREATE TABLE IF NOT EXISTS "message_feedback" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "session_id" uuid REFERENCES "chat_sessions"("id") ON DELETE SET NULL,
        "rating" text NOT NULL,
        "feedback_type" text DEFAULT 'rating',
        "corrected_text" text,
        "flag_reason" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL,
        CONSTRAINT "message_feedback_user_message_unique" UNIQUE ("message_id", "user_id")
      )
    `,
  );
  await exec(
    'message_feedback.message_id_idx',
    sql`CREATE INDEX IF NOT EXISTS "message_feedback_message_id_idx" ON "message_feedback" ("message_id")`,
  );
  await exec(
    'message_feedback.user_id_idx',
    sql`CREATE INDEX IF NOT EXISTS "message_feedback_user_id_idx" ON "message_feedback" ("user_id")`,
  );
  await exec(
    'message_feedback.rating_idx',
    sql`CREATE INDEX IF NOT EXISTS "message_feedback_rating_idx" ON "message_feedback" ("rating")`,
  );
  await exec(
    'message_feedback.created_at_idx',
    sql`CREATE INDEX IF NOT EXISTS "message_feedback_created_at_idx" ON "message_feedback" ("created_at")`,
  );

  await exec(
    'workflows',
    sql`
      CREATE TABLE IF NOT EXISTS "workflows" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "workspace_id" uuid,
        "name" text NOT NULL,
        "description" text,
        "nodes" jsonb NOT NULL,
        "edges" jsonb NOT NULL,
        "is_public" boolean DEFAULT false,
        "is_template" boolean DEFAULT false,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );
  await exec('workflows.workspace_id', sql`ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "workspace_id" uuid`);

  await exec(
    'workflow_executions',
    sql`
      CREATE TABLE IF NOT EXISTS "workflow_executions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workflow_id" uuid REFERENCES "workflows"("id") ON DELETE CASCADE,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "status" text DEFAULT 'running',
        "input" jsonb,
        "output" jsonb,
        "error" text,
        "execution_log" jsonb,
        "checkpoint" jsonb,
        "resume_trigger" jsonb,
        "started_at" timestamp DEFAULT NOW() NOT NULL,
        "completed_at" timestamp
      )
    `,
  );
  await exec('workflow_executions.checkpoint', sql`ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "checkpoint" jsonb`);
  await exec('workflow_executions.resume_trigger', sql`ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "resume_trigger" jsonb`);

  await exec(
    'models',
    sql`
      CREATE TABLE IF NOT EXISTS "models" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "model_id" text NOT NULL,
        "name" text NOT NULL,
        "provider" text NOT NULL,
        "description" text NOT NULL,
        "capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "max_tokens" integer NOT NULL,
        "cost" text NOT NULL,
        "speed" text NOT NULL,
        "quality" text NOT NULL,
        "is_available" boolean DEFAULT true,
        "is_featured" boolean DEFAULT false,
        "sort_order" integer DEFAULT 0,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL,
        CONSTRAINT "models_model_id_unique" UNIQUE ("model_id")
      )
    `,
  );

  await exec(
    'user_preferences',
    sql`
      CREATE TABLE IF NOT EXISTS "user_preferences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE UNIQUE,
        "theme" text DEFAULT 'light',
        "font_size" text DEFAULT 'medium',
        "compact_mode" boolean DEFAULT false,
        "email_notifications" boolean DEFAULT true,
        "push_notifications" boolean DEFAULT false,
        "notification_frequency" text DEFAULT 'immediate',
        "analytics_enabled" boolean DEFAULT true,
        "error_reporting" boolean DEFAULT true,
        "auto_save" boolean DEFAULT true,
        "streaming_enabled" boolean DEFAULT true,
        "keyboard_shortcuts_enabled" boolean DEFAULT true,
        "custom_shortcuts" jsonb DEFAULT '{}'::jsonb,
        "default_model" text,
        "default_temperature" real DEFAULT 0.7,
        "default_max_tokens" integer DEFAULT 2048,
        "workspace_mode" text,
        "multimodal_settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );
  await exec(
    'user_preferences.multimodal',
    sql`ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "multimodal_settings" jsonb NOT NULL DEFAULT '{}'::jsonb`,
  );
  await exec(
    'user_preferences.workspace_mode',
    sql`ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "workspace_mode" text`,
  );

  await exec(
    'user_security',
    sql`
      CREATE TABLE IF NOT EXISTS "user_security" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE UNIQUE,
        "two_factor_enabled" boolean DEFAULT false,
        "two_factor_secret" text,
        "two_factor_backup_codes" jsonb DEFAULT '[]'::jsonb,
        "two_factor_verified_at" timestamp,
        "password_changed_at" timestamp,
        "password_reset_token" text,
        "password_reset_expires" timestamp,
        "failed_login_attempts" integer DEFAULT 0,
        "locked_until" timestamp,
        "active_sessions" jsonb DEFAULT '[]'::jsonb,
        "last_login_at" timestamp,
        "last_login_ip" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'bookmarks',
    sql`
      CREATE TABLE IF NOT EXISTS "bookmarks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "item_type" text NOT NULL,
        "item_id" uuid NOT NULL,
        "title" text,
        "notes" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'notebooks',
    sql`
      CREATE TABLE IF NOT EXISTS "notebooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" text NOT NULL,
        "description" text,
        "is_public" boolean DEFAULT false,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'notebook_cells',
    sql`
      CREATE TABLE IF NOT EXISTS "notebook_cells" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "notebook_id" uuid NOT NULL REFERENCES "notebooks"("id") ON DELETE CASCADE,
        "cell_type" text NOT NULL,
        "content" text NOT NULL DEFAULT '',
        "output" text,
        "execution_count" integer DEFAULT 0,
        "position" integer NOT NULL DEFAULT 0,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "attached_documents" jsonb DEFAULT '[]'::jsonb,
        "rag_config" jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'api_usage',
    sql`
      CREATE TABLE IF NOT EXISTS "api_usage" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "endpoint" text NOT NULL,
        "method" text NOT NULL,
        "model" text,
        "tokens_used" integer,
        "cost" integer,
        "response_time" integer,
        "status_code" integer NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'rag_search_sessions',
    sql`
      CREATE TABLE IF NOT EXISTS "rag_search_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "short_id" text NOT NULL,
        "title" text,
        "query" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL,
        CONSTRAINT "rag_search_sessions_short_id_unique" UNIQUE ("short_id")
      )
    `,
  );

  await exec(
    'revoked_tokens',
    sql`
      CREATE TABLE IF NOT EXISTS "revoked_tokens" (
        "token_hash" text PRIMARY KEY,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'organizations',
    sql`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "code" text,
        "domain" text,
        "plan" text DEFAULT 'starter',
        "settings" jsonb DEFAULT '{}'::jsonb,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL,
        CONSTRAINT "organizations_slug_unique" UNIQUE ("slug")
      )
    `,
  );
  await exec('organizations.code', sql`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "code" text`);
  await exec(
    'organizations.code_idx',
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "organizations_code_unique" ON "organizations" ("code") WHERE "code" IS NOT NULL`,
  );

  await exec(
    'organization_domains',
    sql`
      CREATE TABLE IF NOT EXISTS "organization_domains" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "domain" text NOT NULL,
        "is_verified" boolean NOT NULL DEFAULT false,
        "auto_join_enabled" boolean NOT NULL DEFAULT false,
        "allowed_auth_methods" jsonb DEFAULT '["google","password"]'::jsonb,
        "default_role" text NOT NULL DEFAULT 'member',
        "created_at" timestamp NOT NULL DEFAULT NOW(),
        "updated_at" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "organization_domains_domain_unique" UNIQUE ("domain")
      )
    `,
  );

  await exec(
    'workspaces',
    sql`
      CREATE TABLE IF NOT EXISTS "workspaces" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "is_default" boolean DEFAULT false,
        "settings" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );
  await exec(
    'workspaces.description',
    sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "description" text`,
  );
  await exec(
    'workspaces.is_default',
    sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false`,
  );
  await exec(
    'workspaces.settings',
    sql`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "settings" jsonb DEFAULT '{}'::jsonb`,
  );

  await exec(
    'inference_runs',
    sql`
      CREATE TABLE IF NOT EXISTS "inference_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "provider" text NOT NULL,
        "model" text NOT NULL,
        "status" text NOT NULL DEFAULT 'queued',
        "input" jsonb,
        "output" jsonb,
        "error_message" text,
        "prompt_tokens" integer,
        "completion_tokens" integer,
        "total_tokens" integer,
        "cost" integer,
        "latency_ms" integer,
        "started_at" timestamp,
        "completed_at" timestamp,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );
  await exec(
    'inference_runs.organization_id_idx',
    sql`CREATE INDEX IF NOT EXISTS "inference_runs_organization_id_idx" ON "inference_runs" ("organization_id")`,
  );
  await exec(
    'inference_runs.workspace_id_idx',
    sql`CREATE INDEX IF NOT EXISTS "inference_runs_workspace_id_idx" ON "inference_runs" ("workspace_id")`,
  );
  await exec(
    'inference_runs.user_id_idx',
    sql`CREATE INDEX IF NOT EXISTS "inference_runs_user_id_idx" ON "inference_runs" ("user_id")`,
  );
  await exec(
    'inference_runs.status_idx',
    sql`CREATE INDEX IF NOT EXISTS "inference_runs_status_idx" ON "inference_runs" ("status")`,
  );
  await exec(
    'inference_runs.created_at_idx',
    sql`CREATE INDEX IF NOT EXISTS "inference_runs_created_at_idx" ON "inference_runs" ("created_at")`,
  );

  await exec(
    'memberships',
    sql`
      CREATE TABLE IF NOT EXISTS "memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "role" text NOT NULL DEFAULT 'member',
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamp NOT NULL DEFAULT NOW(),
        "updated_at" timestamp NOT NULL DEFAULT NOW()
      )
    `,
  );
  await exec(
    'memberships.user_id_idx',
    sql`CREATE INDEX IF NOT EXISTS "memberships_user_id_idx" ON "memberships" ("user_id")`,
  );
  await exec(
    'memberships.organization_id_idx',
    sql`CREATE INDEX IF NOT EXISTS "memberships_organization_id_idx" ON "memberships" ("organization_id")`,
  );
  await exec(
    'memberships.org_user_workspace_unique',
    sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "memberships_org_user_workspace_unique"
      ON "memberships" ("organization_id", "user_id", "workspace_id")
    `,
  );

  // Acquisition Intelligence tables (journal may lag behind)
  await exec(
    'acquisition_persons',
    sql`
      CREATE TABLE IF NOT EXISTS "acquisition_persons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "display_name" text,
        "primary_email" text,
        "primary_phone" text,
        "status" text NOT NULL DEFAULT 'identified',
        "relationship_maturity" text NOT NULL DEFAULT 'unknown',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'acquisition_persons.relationship_maturity',
    sql`
      ALTER TABLE "acquisition_persons"
      ADD COLUMN IF NOT EXISTS "relationship_maturity" text NOT NULL DEFAULT 'unknown'
    `,
  );

  await exec(
    'acquisition_source_connections',
    sql`
      CREATE TABLE IF NOT EXISTS "acquisition_source_connections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "provider" text NOT NULL,
        "name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "external_account_id" text,
        "config" jsonb DEFAULT '{}'::jsonb,
        "last_success_at" timestamp,
        "last_error_at" timestamp,
        "last_error_message" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'acquisition_raw_records',
    sql`
      CREATE TABLE IF NOT EXISTS "acquisition_raw_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "source_connection_id" uuid NOT NULL REFERENCES "acquisition_source_connections"("id") ON DELETE CASCADE,
        "external_event_id" text,
        "event_name" text,
        "received_at" timestamp DEFAULT NOW() NOT NULL,
        "occurred_at" timestamp,
        "headers" jsonb,
        "payload" jsonb NOT NULL,
        "payload_hash" text NOT NULL,
        "processing_status" text NOT NULL DEFAULT 'received',
        "error_message" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'acquisition_events',
    sql`
      CREATE TABLE IF NOT EXISTS "acquisition_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "source_connection_id" uuid NOT NULL REFERENCES "acquisition_source_connections"("id") ON DELETE CASCADE,
        "raw_record_id" uuid NOT NULL REFERENCES "acquisition_raw_records"("id") ON DELETE CASCADE,
        "source" text NOT NULL,
        "external_event_id" text,
        "event_type" text NOT NULL,
        "occurred_at" timestamp NOT NULL,
        "received_at" timestamp DEFAULT NOW() NOT NULL,
        "person_id" uuid REFERENCES "acquisition_persons"("id") ON DELETE SET NULL,
        "initiative_id" uuid,
        "campaign_id" uuid,
        "channel" text,
        "object_type" text,
        "object_id" text,
        "attributes" jsonb DEFAULT '{}'::jsonb,
        "schema_version" integer DEFAULT 1 NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'acquisition_interactions',
    sql`
      CREATE TABLE IF NOT EXISTS "acquisition_interactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "person_id" uuid NOT NULL REFERENCES "acquisition_persons"("id") ON DELETE CASCADE,
        "initiative_id" uuid,
        "campaign_id" uuid,
        "source_event_id" uuid NOT NULL REFERENCES "acquisition_events"("id") ON DELETE CASCADE,
        "kind" text NOT NULL,
        "direction" text,
        "summary" text,
        "occurred_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'knowledge_artifacts',
    sql`
      CREATE TABLE IF NOT EXISTS "knowledge_artifacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "person_id" uuid REFERENCES "acquisition_persons"("id") ON DELETE SET NULL,
        "initiative_id" uuid,
        "acquisition_event_id" uuid,
        "interaction_id" uuid,
        "artifact_type" text NOT NULL,
        "title" text,
        "interpretation" jsonb DEFAULT '{}'::jsonb,
        "signals" jsonb DEFAULT '{}'::jsonb,
        "source_file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL,
        "knowledge_document_id" uuid,
        "media_asset_id" uuid,
        "occurred_at" timestamp,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'platform_connectors',
    sql`
      CREATE TABLE IF NOT EXISTS "platform_connectors" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "provider" text NOT NULL,
        "name" text NOT NULL,
        "api_version" text,
        "status" text NOT NULL DEFAULT 'disconnected',
        "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "external_account_id" text,
        "last_validated_at" timestamp,
        "last_error_at" timestamp,
        "last_error_message" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'studio_channels',
    sql`
      CREATE TABLE IF NOT EXISTS "studio_channels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "kind" text NOT NULL,
        "name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "connector_id" uuid REFERENCES "platform_connectors"("id") ON DELETE SET NULL,
        "connector_provider" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'publishing_profiles',
    sql`
      CREATE TABLE IF NOT EXISTS "publishing_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "channel_id" uuid NOT NULL REFERENCES "studio_channels"("id") ON DELETE CASCADE,
        "brand_kit_id" uuid,
        "default_hashtags" text[] DEFAULT '{}',
        "default_utm" jsonb DEFAULT '{}'::jsonb,
        "timezone" text,
        "defaults" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'publishing_jobs',
    sql`
      CREATE TABLE IF NOT EXISTS "publishing_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "initiative_id" uuid,
        "campaign_id" uuid,
        "marketing_asset_id" uuid NOT NULL,
        "publishing_profile_id" uuid REFERENCES "publishing_profiles"("id") ON DELETE SET NULL,
        "channel_id" uuid NOT NULL REFERENCES "studio_channels"("id") ON DELETE CASCADE,
        "connector_id" uuid REFERENCES "platform_connectors"("id") ON DELETE SET NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "scheduled_at" timestamp,
        "published_at" timestamp,
        "external_post_id" text,
        "error_message" text,
        "payload" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'program_interests',
    sql`
      CREATE TABLE IF NOT EXISTS "program_interests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "person_id" uuid NOT NULL REFERENCES "acquisition_persons"("id") ON DELETE CASCADE,
        "program_id" text NOT NULL,
        "program_name" text,
        "confidence" real NOT NULL DEFAULT 0.5,
        "source" text NOT NULL,
        "campaign_id" uuid,
        "campaign_name" text,
        "intent" text,
        "evidence" jsonb DEFAULT '[]'::jsonb,
        "publishing_job_id" uuid,
        "acquisition_event_id" uuid,
        "occurred_at" timestamp DEFAULT NOW() NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'acquisition_source_connections.connector_id',
    sql`
      ALTER TABLE "acquisition_source_connections"
      ADD COLUMN IF NOT EXISTS "connector_id" uuid
    `,
  );

  await exec(
    'acquisition_source_connections.channel_id',
    sql`
      ALTER TABLE "acquisition_source_connections"
      ADD COLUMN IF NOT EXISTS "channel_id" uuid
    `,
  );

  await exec(
    'acquisition_initiatives',
    sql`
      CREATE TABLE IF NOT EXISTS "acquisition_initiatives" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "program_id" text,
        "name" text NOT NULL,
        "description" text,
        "status" text NOT NULL DEFAULT 'active',
        "starts_at" timestamp,
        "ends_at" timestamp,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'acquisition_initiatives.program_id',
    sql`
      ALTER TABLE "acquisition_initiatives"
      ADD COLUMN IF NOT EXISTS "program_id" text
    `,
  );

  await exec(
    'acquisition_campaigns',
    sql`
      CREATE TABLE IF NOT EXISTS "acquisition_campaigns" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "initiative_id" uuid NOT NULL REFERENCES "acquisition_initiatives"("id") ON DELETE CASCADE,
        "program_id" text,
        "name" text NOT NULL,
        "channel" text,
        "status" text NOT NULL DEFAULT 'active',
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'acquisition_campaigns.program_id',
    sql`
      ALTER TABLE "acquisition_campaigns"
      ADD COLUMN IF NOT EXISTS "program_id" text
    `,
  );

  await exec(
    'creative_projects',
    sql`
      CREATE TABLE IF NOT EXISTS "creative_projects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "campaign_id" uuid NOT NULL REFERENCES "acquisition_campaigns"("id") ON DELETE CASCADE,
        "program_id" text,
        "name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'marketing_assets',
    sql`
      CREATE TABLE IF NOT EXISTS "marketing_assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "campaign_id" uuid NOT NULL REFERENCES "acquisition_campaigns"("id") ON DELETE CASCADE,
        "creative_project_id" uuid NOT NULL REFERENCES "creative_projects"("id") ON DELETE CASCADE,
        "program_id" text,
        "kind" text NOT NULL DEFAULT 'other',
        "title" text NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "body" text,
        "file_ids" jsonb DEFAULT '[]'::jsonb,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `,
  );

  await exec(
    'story_sessions',
    sql`
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
      )
    `,
  );

  logger.info('✓ Core platform tables ensured');

  try {
    const { ensureAtrisiInstitution } = await import('../services/organization-admission.js');
    await ensureAtrisiInstitution();
    logger.info('✓ ATRISI institution admission seed ensured');
  } catch (error) {
    logger.warn('ATRISI institution seed skipped', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
