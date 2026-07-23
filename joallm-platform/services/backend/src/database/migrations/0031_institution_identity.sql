-- Institution Identity: org code, organization admission domains, membership revoked
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "code" text;
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_code_unique" ON "organizations" ("code") WHERE "code" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "organizations_code_idx" ON "organizations" ("code");

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
);
CREATE INDEX IF NOT EXISTS "organization_domains_organization_id_idx" ON "organization_domains" ("organization_id");

-- membership status may already be free text; revoked is newly allowed
-- no CHECK constraint in base schema
