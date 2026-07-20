-- Add workspace_mode to user_preferences table
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS workspace_mode TEXT
    CHECK (workspace_mode IN ('personal', 'team', 'enterprise'))
    DEFAULT 'personal';
