-- Fix database schema constraints and add proper validation

-- Add proper constraints to users table
ALTER TABLE users ADD CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE users ADD CONSTRAINT users_name_length CHECK (length(name) >= 2 AND length(name) <= 100);
ALTER TABLE users ADD CONSTRAINT users_password_length CHECK (length(password) >= 8);

-- Add proper constraints to chat_sessions table
ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_title_length CHECK (title IS NULL OR (length(title) >= 1 AND length(title) <= 200));
ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_model_not_empty CHECK (length(model) > 0);

-- Add proper constraints to messages table
ALTER TABLE messages ADD CONSTRAINT messages_content_not_empty CHECK (length(content) > 0);
ALTER TABLE messages ADD CONSTRAINT messages_role_valid CHECK (role IN ('user', 'assistant', 'system'));

-- Add proper constraints to files table
ALTER TABLE files ADD CONSTRAINT files_filename_not_empty CHECK (length(filename) > 0);
ALTER TABLE files ADD CONSTRAINT files_original_name_not_empty CHECK (length(original_name) > 0);
ALTER TABLE files ADD CONSTRAINT files_size_positive CHECK (size > 0);
ALTER TABLE files ADD CONSTRAINT files_status_valid CHECK (status IN ('uploaded', 'processing', 'processed', 'failed'));

-- Add proper constraints to document_chunks table
ALTER TABLE document_chunks ADD CONSTRAINT document_chunks_content_not_empty CHECK (length(content) > 0);
ALTER TABLE document_chunks ADD CONSTRAINT document_chunks_index_positive CHECK (chunk_index >= 0);

-- Add proper constraints to workflows table
ALTER TABLE workflows ADD CONSTRAINT workflows_name_not_empty CHECK (length(name) > 0);
ALTER TABLE workflows ADD CONSTRAINT workflows_name_length CHECK (length(name) <= 100);

-- Add proper constraints to workflow_executions table
ALTER TABLE workflow_executions ADD CONSTRAINT workflow_executions_status_valid CHECK (status IN ('running', 'completed', 'failed', 'cancelled'));

-- Add proper constraints to api_usage table
ALTER TABLE api_usage ADD CONSTRAINT api_usage_endpoint_not_empty CHECK (length(endpoint) > 0);
ALTER TABLE api_usage ADD CONSTRAINT api_usage_method_valid CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'));
ALTER TABLE api_usage ADD CONSTRAINT api_usage_tokens_positive CHECK (tokens_used IS NULL OR tokens_used >= 0);
ALTER TABLE api_usage ADD CONSTRAINT api_usage_cost_positive CHECK (cost IS NULL OR cost >= 0);
ALTER TABLE api_usage ADD CONSTRAINT api_usage_response_time_positive CHECK (response_time IS NULL OR response_time >= 0);
ALTER TABLE api_usage ADD CONSTRAINT api_usage_status_code_valid CHECK (status_code >= 100 AND status_code < 600);

-- Add proper constraints to search_history table
ALTER TABLE search_history ADD CONSTRAINT search_history_query_not_empty CHECK (length(query) > 0);
ALTER TABLE search_history ADD CONSTRAINT search_history_results_count_positive CHECK (results_count >= 0);
ALTER TABLE search_history ADD CONSTRAINT search_history_search_time_positive CHECK (search_time >= 0);

-- Add proper constraints to survey_responses table
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_user_type_valid CHECK (user_type IN ('developer', 'business', 'analyst', 'casual'));
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_company_size_valid CHECK (company_size IS NULL OR company_size IN ('1-10', '11-50', '51-200', '201-1000', '1000+'));
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_budget_valid CHECK (budget IS NULL OR budget IN ('free', 'under-100', '100-500', '500-2000', '2000+'));
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_source_valid CHECK (source IN ('landing-page', 'demo', 'referral', 'social-media', 'other'));

-- Add proper constraints to models table
ALTER TABLE models ADD CONSTRAINT models_model_id_not_empty CHECK (length(model_id) > 0);
ALTER TABLE models ADD CONSTRAINT models_name_not_empty CHECK (length(name) > 0);
ALTER TABLE models ADD CONSTRAINT models_provider_not_empty CHECK (length(provider) > 0);
ALTER TABLE models ADD CONSTRAINT models_description_not_empty CHECK (length(description) > 0);
ALTER TABLE models ADD CONSTRAINT models_max_tokens_positive CHECK (max_tokens > 0);
ALTER TABLE models ADD CONSTRAINT models_cost_not_empty CHECK (length(cost) > 0);
ALTER TABLE models ADD CONSTRAINT models_speed_valid CHECK (speed IN ('fast', 'medium', 'slow'));
ALTER TABLE models ADD CONSTRAINT models_quality_valid CHECK (quality IN ('high', 'medium', 'low'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_created ON chat_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_user_status ON files(user_id, status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_file_index ON document_chunks(file_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_workflows_user_public ON workflows(user_id, is_public);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_status ON workflow_executions(workflow_id, status);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_user_date ON search_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_date ON survey_responses(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_models_provider_available ON models(provider, is_available);

-- Add foreign key constraints with proper cascade behavior
ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey;
ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_session_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_session_id_fkey 
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;

ALTER TABLE files DROP CONSTRAINT IF EXISTS files_user_id_fkey;
ALTER TABLE files ADD CONSTRAINT files_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE document_chunks DROP CONSTRAINT IF EXISTS document_chunks_file_id_fkey;
ALTER TABLE document_chunks ADD CONSTRAINT document_chunks_file_id_fkey 
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE;

ALTER TABLE workflows DROP CONSTRAINT IF EXISTS workflows_user_id_fkey;
ALTER TABLE workflows ADD CONSTRAINT workflows_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_workflow_id_fkey;
ALTER TABLE workflow_executions ADD CONSTRAINT workflow_executions_workflow_id_fkey 
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE;

ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_user_id_fkey;
ALTER TABLE workflow_executions ADD CONSTRAINT workflow_executions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE api_usage DROP CONSTRAINT IF EXISTS api_usage_user_id_fkey;
ALTER TABLE api_usage ADD CONSTRAINT api_usage_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE search_history DROP CONSTRAINT IF EXISTS search_history_user_id_fkey;
ALTER TABLE search_history ADD CONSTRAINT search_history_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
