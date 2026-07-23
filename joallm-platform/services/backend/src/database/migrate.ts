import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { db, initializeExtensions, repairEmbeddingIndexes } from './connection.js';
import { logger } from '../utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ensureCorePlatformTables } from './ensure-core-tables.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function ensureSchemaCompatibility(): Promise<void> {
  try {
    logger.info('Checking critical schema compatibility...');

    // Ensure the shared updated_at trigger function exists before any later
    // migrations try to attach table-specific triggers to it.
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Some production environments may have started with an incomplete
    // migration history. Create the minimum additive objects the runtime
    // expects so auth and preferences stay available.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "revoked_tokens" (
        "token_hash" text PRIMARY KEY,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "revoked_tokens_expires_at_idx"
      ON "revoked_tokens" ("expires_at")
    `);

    await db.execute(sql`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "multimodal_settings" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    // Some environments can come up with an older schema if Drizzle migrations
    // fail partway through or the journal gets out of sync. Keep additive fixes
    // here so core runtime paths like chat remain available.
    await db.execute(sql`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "rag_mode" text
      CHECK ("rag_mode" IN ('standard', 'research', 'compliance', 'decision'))
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "messages_rag_mode_idx"
      ON "messages" ("rag_mode")
    `);

    // Workflow execution suspension support was added later. Keep these
    // columns additive so media workflows can suspend/resume on older
    // production databases.
    await db.execute(sql`
      ALTER TABLE "workflow_executions"
      ADD COLUMN IF NOT EXISTS "checkpoint" jsonb
    `);

    await db.execute(sql`
      ALTER TABLE "workflow_executions"
      ADD COLUMN IF NOT EXISTS "resume_trigger" jsonb
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "workflow_executions_resume_trigger_idx"
      ON "workflow_executions" ("status", ((resume_trigger->>'fileId')), ((resume_trigger->>'jobType')))
    `);

    // Media AI persistence tables were added after some production environments
    // were already live. Keep them additive here so transcription/insight flows
    // don't fail after provider work has already completed successfully.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "transcript_segments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "file_id" uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
        "speaker" text,
        "start_time" real NOT NULL,
        "end_time" real NOT NULL,
        "text" text NOT NULL,
        "confidence" real,
        "sequence_index" integer NOT NULL,
        "language" text,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "transcript_segments_file_id_idx"
      ON "transcript_segments" ("file_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "transcript_segments_start_time_idx"
      ON "transcript_segments" ("file_id", "start_time")
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "media_insights" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "file_id" uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
        "insight_type" text NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "start_time" real,
        "end_time" real,
        "score" real,
        "tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "media_insights_file_id_idx"
      ON "media_insights" ("file_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "media_insights_type_idx"
      ON "media_insights" ("file_id", "insight_type")
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "frame_analyses" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "file_id"       uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
        "timestamp_sec" real NOT NULL,
        "description"   text NOT NULL,
        "objects"       text[] DEFAULT ARRAY[]::text[] NOT NULL,
        "detected_text" text,
        "confidence"    real,
        "metadata"      jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at"    timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "frame_analyses_file_id_idx"
      ON "frame_analyses" ("file_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "frame_analyses_file_timestamp_idx"
      ON "frame_analyses" ("file_id", "timestamp_sec")
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "edit_plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL,
        "workflow_id" uuid REFERENCES "workflows"("id") ON DELETE SET NULL,
        "title" text NOT NULL,
        "description" text,
        "version" integer DEFAULT 1 NOT NULL,
        "status" text DEFAULT 'draft' NOT NULL,
        "steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "edit_plans_user_id_idx"
      ON "edit_plans" ("user_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "edit_plans_file_id_idx"
      ON "edit_plans" ("file_id")
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "render_outputs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "edit_plan_id" uuid NOT NULL REFERENCES "edit_plans"("id") ON DELETE CASCADE,
        "file_id" uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
        "storage_key" text NOT NULL,
        "storage_provider" text DEFAULT 'volume' NOT NULL,
        "format" text NOT NULL,
        "duration" real,
        "size_bytes" integer,
        "status" text DEFAULT 'pending' NOT NULL,
        "error" text,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "completed_at" timestamp
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "render_outputs_edit_plan_id_idx"
      ON "render_outputs" ("edit_plan_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "render_outputs_file_id_idx"
      ON "render_outputs" ("file_id")
    `);

    // Acquisition Intelligence tables — additive bootstrap for environments
    // that may not have picked up migration 0028 yet.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "acquisition_persons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "display_name" text,
        "primary_email" text,
        "primary_phone" text,
        "status" text DEFAULT 'identified' NOT NULL,
        "relationship_maturity" text DEFAULT 'unknown' NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      ALTER TABLE "acquisition_persons"
      ADD COLUMN IF NOT EXISTS "relationship_maturity" text NOT NULL DEFAULT 'unknown'
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "acquisition_persons_owner_user_id_idx"
      ON "acquisition_persons" ("owner_user_id")
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "acquisition_person_identities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "person_id" uuid NOT NULL REFERENCES "acquisition_persons"("id") ON DELETE CASCADE,
        "provider" text NOT NULL,
        "external_id" text NOT NULL,
        "confidence" real DEFAULT 1 NOT NULL,
        "is_verified" boolean DEFAULT FALSE NOT NULL,
        "verified_at" timestamp,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        CONSTRAINT "acquisition_person_identities_owner_provider_external_unique"
          UNIQUE ("owner_user_id", "provider", "external_id")
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "acquisition_initiatives" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "description" text,
        "status" text DEFAULT 'active' NOT NULL,
        "starts_at" timestamp,
        "ends_at" timestamp,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "acquisition_campaigns" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "initiative_id" uuid NOT NULL REFERENCES "acquisition_initiatives"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "channel" text,
        "status" text DEFAULT 'active' NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "acquisition_source_connections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "provider" text NOT NULL,
        "name" text NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "external_account_id" text,
        "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "last_success_at" timestamp,
        "last_error_at" timestamp,
        "last_error_message" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "acquisition_source_connections_external_account_idx"
      ON "acquisition_source_connections" ("provider", "external_account_id")
    `);

    await db.execute(sql`
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
        "processing_status" text DEFAULT 'received' NOT NULL,
        "error_message" text,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
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
        "initiative_id" uuid REFERENCES "acquisition_initiatives"("id") ON DELETE SET NULL,
        "campaign_id" uuid REFERENCES "acquisition_campaigns"("id") ON DELETE SET NULL,
        "channel" text,
        "object_type" text,
        "object_id" text,
        "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "schema_version" integer DEFAULT 1 NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "acquisition_interactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "person_id" uuid NOT NULL REFERENCES "acquisition_persons"("id") ON DELETE CASCADE,
        "initiative_id" uuid REFERENCES "acquisition_initiatives"("id") ON DELETE SET NULL,
        "campaign_id" uuid REFERENCES "acquisition_campaigns"("id") ON DELETE SET NULL,
        "source_event_id" uuid NOT NULL REFERENCES "acquisition_events"("id") ON DELETE CASCADE,
        "kind" text NOT NULL,
        "direction" text,
        "summary" text,
        "occurred_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "acquisition_interactions_person_occurred_idx"
      ON "acquisition_interactions" ("person_id", "occurred_at")
    `);

    await db.execute(sql`
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
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "knowledge_artifacts_person_id_idx"
      ON "knowledge_artifacts" ("person_id")
    `);

    await db.execute(sql`
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
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "studio_channels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "kind" text NOT NULL,
        "name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "connector_id" uuid,
        "connector_provider" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT NOW() NOT NULL,
        "updated_at" timestamp DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      ALTER TABLE "acquisition_source_connections"
      ADD COLUMN IF NOT EXISTS "connector_id" uuid
    `);
    await db.execute(sql`
      ALTER TABLE "acquisition_source_connections"
      ADD COLUMN IF NOT EXISTS "channel_id" uuid
    `);

    logger.info('✅ Critical schema compatibility checks completed');
  } catch (error) {
    logger.error('❌ Critical schema compatibility check failed:', error);
  }
}

export async function resetDatabase(): Promise<void> {
  logger.warn('⚠️ RESET_DATABASE=true — dropping public schema and recreating from migrations');
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await db.execute(sql`GRANT ALL ON SCHEMA public TO public`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  logger.warn('⚠️ Public schema wiped. Running fresh migrations…');
}

export async function runMigrations(): Promise<void> {
  try {
    logger.info('Starting database migrations...');
    
    // One-shot wipe for Marketing bootstrap / broken legacy schemas.
    // Set RESET_DATABASE=true in Railway, redeploy once, then REMOVE the variable.
    if (process.env.RESET_DATABASE === 'true') {
      await resetDatabase();
    }

    // Initialize pgvector extension first (non-blocking if it fails)
    await initializeExtensions();
    await repairEmbeddingIndexes();

    // Use path relative to the compiled file location
    const migrationsFolder = join(__dirname, 'migrations');
    logger.info(`Using migrations folder: ${migrationsFolder}`);
    
    // Run Drizzle migrations first so base tables exist.
    // (Previously ensureSchemaCompatibility ran first and failed on empty DBs
    //  because it FKs to "users" before migrations create that table.)
    await migrate(db, { migrationsFolder });

    // Additive fixes for older / partial schemas (safe after migrate)
    await ensureSchemaCompatibility();
    await ensureUsersTable();
    await ensureApiUsageTable();
    await ensureCorePlatformTables();

    logger.info('✅ Database migrations completed successfully');
  } catch (error) {
    logger.error('❌ Database migration failed:', error);
    logger.warn('⚠️ If pgvector is missing, please install it in Railway Dashboard');
    logger.warn('⚠️ Attempting core-table bootstrap so chat/auth can still work…');
    try {
      await initializeExtensions();
      await repairEmbeddingIndexes();
      await ensureUsersTable();
      await ensureApiUsageTable();
      await ensureCorePlatformTables();
      await ensureSchemaCompatibility();
    } catch (bootstrapError) {
      logger.error('❌ Auth/core bootstrap also failed:', bootstrapError);
    }
    // Don't throw - allow server to start even if migrations fail
    // This is useful during initial deployment
  }
}

async function ensureUsersTable(): Promise<void> {
  // Minimal users table matching runtime schema expectations (Google OAuth / password login).
  await db.execute(sql`
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
  `);

  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" text NOT NULL DEFAULT ''
  `);
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "api_keys" jsonb
  `);
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar" text
  `);
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'casual'
  `);
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_tier" text DEFAULT 'free'
  `);
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "usage_stats" jsonb
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email")
  `);

  logger.info('✓ users table ensured');
}

async function ensureApiUsageTable(): Promise<void> {
  await db.execute(sql`
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
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "api_usage_user_id_idx" ON "api_usage" ("user_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "api_usage_created_at_idx" ON "api_usage" ("created_at")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "api_usage_endpoint_idx" ON "api_usage" ("endpoint")
  `);
  logger.info('✓ api_usage table ensured');
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  const shouldReset = process.env.RESET_DATABASE === 'true' || process.argv.includes('--reset');
  (async () => {
    if (shouldReset) {
      process.env.RESET_DATABASE = 'true';
    }
    await runMigrations();
    logger.info('Migration script completed');
    process.exit(0);
  })().catch((error) => {
    logger.error('Migration script failed:', error);
    process.exit(1);
  });
}
