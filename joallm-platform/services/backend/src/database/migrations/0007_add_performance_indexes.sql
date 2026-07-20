-- Add performance indexes for common queries

-- Files table composite indexes
CREATE INDEX IF NOT EXISTS files_user_id_created_at_idx 
ON files(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS files_user_id_status_idx 
ON files(user_id, status);

-- Messages table composite indexes
CREATE INDEX IF NOT EXISTS messages_session_id_created_at_idx 
ON messages(session_id, created_at DESC);

-- RAG search queries composite indexes
CREATE INDEX IF NOT EXISTS rag_search_queries_session_id_created_at_idx 
ON rag_search_queries(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rag_search_queries_success_created_at_idx 
ON rag_search_queries(success, created_at DESC);

-- Search history indexes for analytics
CREATE INDEX IF NOT EXISTS search_history_created_at_success_idx 
ON search_history(created_at DESC, success);

-- Chat sessions for user dashboard
CREATE INDEX IF NOT EXISTS chat_sessions_user_id_is_active_updated_at_idx 
ON chat_sessions(user_id, is_active, updated_at DESC);

-- API usage for analytics
CREATE INDEX IF NOT EXISTS api_usage_created_at_user_id_idx 
ON api_usage(created_at DESC, user_id);

-- Add comments
COMMENT ON INDEX files_user_id_created_at_idx IS 'Composite index for user file queries ordered by creation date';
COMMENT ON INDEX messages_session_id_created_at_idx IS 'Composite index for fetching messages in a session';
COMMENT ON INDEX rag_search_queries_session_id_created_at_idx IS 'Composite index for RAG search session queries';



