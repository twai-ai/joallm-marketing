-- Studio-1: Integration Platform connectors + Marketing Studio channels

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
);

CREATE INDEX IF NOT EXISTS "platform_connectors_owner_user_id_idx"
  ON "platform_connectors" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "platform_connectors_provider_idx"
  ON "platform_connectors" ("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "platform_connectors_owner_provider_account_unique"
  ON "platform_connectors" ("owner_user_id", "provider", "external_account_id");

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
);

CREATE INDEX IF NOT EXISTS "studio_channels_owner_user_id_idx"
  ON "studio_channels" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "studio_channels_kind_idx"
  ON "studio_channels" ("kind");
CREATE UNIQUE INDEX IF NOT EXISTS "studio_channels_owner_kind_unique"
  ON "studio_channels" ("owner_user_id", "kind");

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
);

CREATE INDEX IF NOT EXISTS "publishing_profiles_owner_user_id_idx"
  ON "publishing_profiles" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "publishing_profiles_channel_id_idx"
  ON "publishing_profiles" ("channel_id");

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
);

CREATE INDEX IF NOT EXISTS "publishing_jobs_owner_user_id_idx"
  ON "publishing_jobs" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "publishing_jobs_channel_id_idx"
  ON "publishing_jobs" ("channel_id");
CREATE INDEX IF NOT EXISTS "publishing_jobs_status_idx"
  ON "publishing_jobs" ("status");

-- Link legacy acquisition source rows to Integration Platform connectors
ALTER TABLE "acquisition_source_connections"
  ADD COLUMN IF NOT EXISTS "connector_id" uuid REFERENCES "platform_connectors"("id") ON DELETE SET NULL;
ALTER TABLE "acquisition_source_connections"
  ADD COLUMN IF NOT EXISTS "channel_id" uuid REFERENCES "studio_channels"("id") ON DELETE SET NULL;
