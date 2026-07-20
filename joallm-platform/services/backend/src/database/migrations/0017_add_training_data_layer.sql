-- Training data layer: feedback signals, RAG source tracking, consent, implicit signals
-- Migration 0017

-- 1. Implicit signal columns on messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS was_regenerated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS was_copied      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quality_score   REAL;

-- 2. Completion status + turn count on chat_sessions
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS completion_status TEXT
    CHECK (completion_status IN ('completed', 'abandoned', 'error'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS turn_count INTEGER DEFAULT 0;

-- 3. Per-message human feedback
CREATE TABLE IF NOT EXISTS message_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  rating          TEXT CHECK (rating IN ('thumbs_up', 'thumbs_down')) NOT NULL,
  feedback_type   TEXT CHECK (feedback_type IN ('rating', 'correction', 'flag')) DEFAULT 'rating',
  corrected_text  TEXT,
  flag_reason     TEXT CHECK (flag_reason IN ('wrong', 'harmful', 'off_topic', 'incomplete')),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_feedback_message_id_idx ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS message_feedback_user_id_idx    ON message_feedback(user_id);
CREATE INDEX IF NOT EXISTS message_feedback_rating_idx     ON message_feedback(rating);
CREATE INDEX IF NOT EXISTS message_feedback_created_at_idx ON message_feedback(created_at);

-- 4. RAG source tracking — which chunks grounded which assistant message
CREATE TABLE IF NOT EXISTS message_rag_sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  chunk_id         UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  rank_position    INTEGER NOT NULL,
  similarity_score REAL    NOT NULL,
  was_used         BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS message_rag_sources_message_id_idx ON message_rag_sources(message_id);
CREATE INDEX IF NOT EXISTS message_rag_sources_chunk_id_idx   ON message_rag_sources(chunk_id);

-- 5. Training data consent (versioned)
CREATE TABLE IF NOT EXISTS training_consent (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  consent_given    BOOLEAN NOT NULL DEFAULT FALSE,
  consent_version  TEXT NOT NULL DEFAULT 'v1.0',
  given_at         TIMESTAMP,
  revoked_at       TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_consent_user_id_idx      ON training_consent(user_id);
CREATE INDEX IF NOT EXISTS training_consent_consent_given_idx ON training_consent(consent_given);

-- 6. Training dataset registry (for future export pipeline)
CREATE TABLE IF NOT EXISTS training_datasets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  dataset_type     TEXT NOT NULL CHECK (dataset_type IN ('sft', 'rlhf', 'dpo', 'rag')),
  status           TEXT NOT NULL CHECK (status IN ('collecting', 'ready', 'exported', 'training')) DEFAULT 'collecting',
  filter_criteria  JSONB DEFAULT '{}',
  row_count        INTEGER DEFAULT 0,
  export_path      TEXT,
  exported_at      TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_datasets_status_idx       ON training_datasets(status);
CREATE INDEX IF NOT EXISTS training_datasets_dataset_type_idx ON training_datasets(dataset_type);
