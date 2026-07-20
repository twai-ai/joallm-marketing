-- Migration: Add user preferences table
-- Created: 2025-11-08
-- Purpose: Store user preferences for appearance, notifications, and app behavior

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Appearance settings
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  compact_mode BOOLEAN DEFAULT FALSE,
  
  -- Notification settings
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT FALSE,
  notification_frequency TEXT DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
  
  -- Privacy settings
  analytics_enabled BOOLEAN DEFAULT TRUE,
  error_reporting BOOLEAN DEFAULT TRUE,
  
  -- Behavior settings
  auto_save BOOLEAN DEFAULT TRUE,
  streaming_enabled BOOLEAN DEFAULT TRUE,
  keyboard_shortcuts_enabled BOOLEAN DEFAULT TRUE,
  
  -- Custom keyboard shortcuts (JSON)
  custom_shortcuts JSONB DEFAULT '{}',
  
  -- LLM defaults
  default_model TEXT,
  default_temperature REAL DEFAULT 0.7,
  default_max_tokens INTEGER DEFAULT 2048,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences(user_id);

-- Add updated_at trigger
CREATE TRIGGER update_user_preferences_updated_at 
  BEFORE UPDATE ON user_preferences 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE user_preferences IS 'User preferences for appearance, notifications, and behavior';
COMMENT ON COLUMN user_preferences.theme IS 'Theme preference: light, dark, or auto (follow system)';
COMMENT ON COLUMN user_preferences.custom_shortcuts IS 'JSON object storing custom keyboard shortcut mappings';
COMMENT ON COLUMN user_preferences.default_model IS 'Default LLM model ID for new conversations';

