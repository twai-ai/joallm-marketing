ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS multimodal_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
