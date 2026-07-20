-- Insert default system user for system messages
INSERT INTO "users" ("id", "email", "name", "role", "subscription_tier") 
VALUES ('00000000-0000-0000-0000-000000000000', 'system@joallm.ai', 'JoaLLM System', 'admin', 'enterprise')
ON CONFLICT ("email") DO NOTHING;

-- Insert sample workflows templates
INSERT INTO "workflows" ("id", "user_id", "name", "description", "nodes", "edges", "is_template", "is_public") 
VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'Document Q&A Workflow',
  'A workflow for answering questions about uploaded documents using RAG',
  '[
    {
      "id": "input-1",
      "type": "text-input",
      "position": {"x": 100, "y": 100},
      "data": {"label": "Question", "placeholder": "Ask a question about your document"}
    },
    {
      "id": "rag-1", 
      "type": "rag-search",
      "position": {"x": 300, "y": 100},
      "data": {"limit": 5, "threshold": 0.7}
    },
    {
      "id": "llm-1",
      "type": "llm-generate", 
      "position": {"x": 500, "y": 100},
      "data": {"model": "gpt-4-turbo", "temperature": 0.7}
    },
    {
      "id": "output-1",
      "type": "text-output",
      "position": {"x": 700, "y": 100},
      "data": {"label": "Answer"}
    }
  ]',
  '[
    {"id": "e1-2", "source": "input-1", "target": "rag-1"},
    {"id": "e2-3", "source": "rag-1", "target": "llm-1"},
    {"id": "e3-4", "source": "llm-1", "target": "output-1"}
  ]',
  true,
  true
),
(
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'Content Summarization Workflow',
  'A workflow for summarizing long documents and articles',
  '[
    {
      "id": "input-1",
      "type": "file-input",
      "position": {"x": 100, "y": 100},
      "data": {"label": "Document", "accept": [".pdf", ".txt", ".docx"]}
    },
    {
      "id": "extract-1",
      "type": "text-extract", 
      "position": {"x": 300, "y": 100},
      "data": {"method": "auto"}
    },
    {
      "id": "chunk-1",
      "type": "text-chunk",
      "position": {"x": 500, "y": 100},
      "data": {"chunkSize": 1000, "overlap": 200}
    },
    {
      "id": "summarize-1",
      "type": "llm-generate",
      "position": {"x": 700, "y": 100}, 
      "data": {"model": "gpt-4-turbo", "prompt": "Summarize the following text in 3-5 bullet points:"}
    },
    {
      "id": "output-1",
      "type": "text-output",
      "position": {"x": 900, "y": 100},
      "data": {"label": "Summary"}
    }
  ]',
  '[
    {"id": "e1-2", "source": "input-1", "target": "extract-1"},
    {"id": "e2-3", "source": "extract-1", "target": "chunk-1"},
    {"id": "e3-4", "source": "chunk-1", "target": "summarize-1"},
    {"id": "e4-5", "source": "summarize-1", "target": "output-1"}
  ]',
  true,
  true
);

-- Create a sample chat session for demonstration
INSERT INTO "chat_sessions" ("id", "user_id", "title", "model", "parameters")
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'Welcome to JoaLLM',
  'gpt-4-turbo',
  '{"temperature": 0.7, "maxTokens": 2048, "topP": 1.0, "frequencyPenalty": 0.0, "presencePenalty": 0.0}'
);

-- Insert welcome messages
INSERT INTO "messages" ("id", "session_id", "role", "content", "model")
VALUES 
(
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'system',
  'Welcome to JoaLLM - your Swiss Army Knife for Large Language Models! I''m here to help you with any questions or tasks. You can chat with me naturally, upload files for analysis, use templates, or build complex AI workflows.',
  null
),
(
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  'assistant',
  'Hello! I''m ready to help you explore the power of AI. You can ask me questions, upload documents for analysis, or try out our workflow templates. What would you like to do today?',
  'gpt-4-turbo'
);


