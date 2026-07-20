-- Media Lab: transcript segments
CREATE TABLE IF NOT EXISTS transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  speaker TEXT,
  start_time REAL NOT NULL,     -- seconds from start
  end_time REAL NOT NULL,       -- seconds from start
  text TEXT NOT NULL,
  confidence REAL,              -- 0–1, from transcription provider
  sequence_index INTEGER NOT NULL,
  language TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS transcript_segments_file_id_idx ON transcript_segments(file_id);
CREATE INDEX IF NOT EXISTS transcript_segments_start_time_idx ON transcript_segments(file_id, start_time);

-- Media Lab: insight segments (highlights, key moments, summaries)
CREATE TABLE IF NOT EXISTS media_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('highlight', 'summary', 'key_moment', 'topic', 'action_item')),
  title TEXT NOT NULL,
  description TEXT,
  start_time REAL,              -- null for file-level insights (summary, topic list)
  end_time REAL,
  score REAL,                   -- 0–1 relevance/importance score
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS media_insights_file_id_idx ON media_insights(file_id);
CREATE INDEX IF NOT EXISTS media_insights_type_idx ON media_insights(file_id, insight_type);

-- Media Lab: edit plans (versioned workflow variant for media)
CREATE TABLE IF NOT EXISTS edit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'rendering', 'done', 'failed')),
  steps JSONB NOT NULL DEFAULT '[]',   -- ordered edit operations
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS edit_plans_user_id_idx ON edit_plans(user_id);
CREATE INDEX IF NOT EXISTS edit_plans_file_id_idx ON edit_plans(file_id);

-- Media Lab: render outputs (clips, exports produced by edit plans)
CREATE TABLE IF NOT EXISTS render_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edit_plan_id UUID NOT NULL REFERENCES edit_plans(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'volume',
  format TEXT NOT NULL,         -- mp4, mp3, srt, txt
  duration REAL,
  size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'done', 'failed')),
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS render_outputs_edit_plan_id_idx ON render_outputs(edit_plan_id);
CREATE INDEX IF NOT EXISTS render_outputs_file_id_idx ON render_outputs(file_id);
