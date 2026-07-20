-- Migration 0019: Add enterprise scaffolding and inference run audit log

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  domain      TEXT,
  plan        TEXT CHECK (plan IN ('starter', 'team', 'enterprise')) DEFAULT 'starter',
  settings    JSONB DEFAULT '{}'::jsonb,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organizations_created_by_idx ON organizations(created_by);

DO $$ BEGIN
  CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  is_default      BOOLEAN DEFAULT FALSE,
  settings        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT workspaces_organization_slug_unique UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS workspaces_organization_id_idx ON workspaces(organization_id);

DO $$ BEGIN
  CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Memberships
CREATE TABLE IF NOT EXISTS memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  role            TEXT CHECK (role IN ('owner', 'admin', 'member', 'viewer')) NOT NULL DEFAULT 'member',
  status          TEXT CHECK (status IN ('active', 'invited', 'suspended')) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT memberships_org_user_workspace_unique UNIQUE (organization_id, user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS memberships_organization_id_idx ON memberships(organization_id);
CREATE INDEX IF NOT EXISTS memberships_workspace_id_idx ON memberships(workspace_id);
CREATE INDEX IF NOT EXISTS memberships_user_id_idx ON memberships(user_id);

DO $$ BEGIN
  CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Inference runs
CREATE TABLE IF NOT EXISTS inference_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  workspace_id     UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  provider         TEXT NOT NULL,
  model            TEXT NOT NULL,
  status           TEXT CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')) NOT NULL DEFAULT 'queued',
  input            JSONB,
  output           JSONB,
  error_message    TEXT,
  prompt_tokens    INTEGER,
  completion_tokens INTEGER,
  total_tokens     INTEGER,
  cost             INTEGER,
  latency_ms       INTEGER,
  started_at       TIMESTAMP,
  completed_at     TIMESTAMP,
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inference_runs_organization_id_idx ON inference_runs(organization_id);
CREATE INDEX IF NOT EXISTS inference_runs_workspace_id_idx ON inference_runs(workspace_id);
CREATE INDEX IF NOT EXISTS inference_runs_user_id_idx ON inference_runs(user_id);
CREATE INDEX IF NOT EXISTS inference_runs_status_idx ON inference_runs(status);
CREATE INDEX IF NOT EXISTS inference_runs_created_at_idx ON inference_runs(created_at);

DO $$ BEGIN
  CREATE TRIGGER update_inference_runs_updated_at
  BEFORE UPDATE ON inference_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
