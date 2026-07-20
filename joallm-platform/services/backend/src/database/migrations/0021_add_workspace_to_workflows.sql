-- Add workspace scoping to workflows table.
-- workspaceId is nullable so existing user-owned workflows are unaffected.
ALTER TABLE "workflows"
  ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "workflows_workspace_id_idx" ON "workflows" ("workspace_id");
