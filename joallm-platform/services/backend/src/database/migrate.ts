import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { db, initializeExtensions } from './connection.js';
import { logger } from '../utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

    logger.info('✅ Critical schema compatibility checks completed');
  } catch (error) {
    logger.error('❌ Critical schema compatibility check failed:', error);
  }
}

export async function runMigrations(): Promise<void> {
  try {
    logger.info('Starting database migrations...');
    
    // Initialize pgvector extension first (non-blocking if it fails)
    await initializeExtensions();

    // Ensure migration prerequisites exist before Drizzle processes later files.
    await ensureSchemaCompatibility();
    
    // Use path relative to the compiled file location
    // In development: dist/database/migrate.js -> dist/database/migrations
    // In production: dist/database/migrate.js -> dist/database/migrations
    const migrationsFolder = join(__dirname, 'migrations');
    logger.info(`Using migrations folder: ${migrationsFolder}`);
    
    // Run migrations
    await migrate(db, { migrationsFolder });

    logger.info('✅ Database migrations completed successfully');
  } catch (error) {
    logger.error('❌ Database migration failed:', error);
    logger.warn('⚠️ If pgvector is missing, please install it in Railway Dashboard');
    logger.warn('⚠️ Backend will continue running but RAG features may not work');
    await ensureSchemaCompatibility();
    // Don't throw - allow server to start even if migrations fail
    // This is useful during initial deployment
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}
