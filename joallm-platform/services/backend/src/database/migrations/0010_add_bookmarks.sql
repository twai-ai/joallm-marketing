-- Migration: Add bookmarks table
-- Created: 2025-11-08
-- Purpose: Enable users to bookmark messages, chat sessions, files, workflows, and search results

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('message', 'chat_session', 'file', 'workflow', 'search_result')),
  item_id UUID NOT NULL,
  title TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT bookmarks_user_item_unique UNIQUE(user_id, item_type, item_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS bookmarks_item_type_idx ON bookmarks(item_type);
CREATE INDEX IF NOT EXISTS bookmarks_created_at_idx ON bookmarks(created_at);

-- Add comment for documentation
COMMENT ON TABLE bookmarks IS 'User bookmarks for various items across the platform';
COMMENT ON COLUMN bookmarks.item_type IS 'Type of item being bookmarked: message, chat_session, file, workflow, or search_result';
COMMENT ON COLUMN bookmarks.item_id IS 'UUID of the bookmarked item';

