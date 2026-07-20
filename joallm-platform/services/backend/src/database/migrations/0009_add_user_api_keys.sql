-- Migration: Add user API keys column
-- Created: 2024-12-19

-- Add api_keys column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{}';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS users_api_keys_idx ON users USING GIN(api_keys);
