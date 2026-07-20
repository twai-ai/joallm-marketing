-- Migration: Add models table for dynamic model management
-- Created: 2024-12-19

-- Create models table
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL UNIQUE, -- The actual model identifier (e.g., 'llama-3.3-70b-versatile')
  name TEXT NOT NULL, -- Display name (e.g., 'Llama 3.3 70B Versatile (Groq)')
  provider TEXT NOT NULL, -- Provider name (e.g., 'Groq', 'OpenAI', 'Anthropic', 'Ollama')
  description TEXT NOT NULL, -- Model description
  capabilities JSONB NOT NULL DEFAULT '[]', -- Array of capabilities (e.g., ['Text', 'Code', 'Analysis'])
  max_tokens INTEGER NOT NULL, -- Maximum tokens supported
  cost TEXT NOT NULL, -- Cost information (e.g., '$0.59/1M in + $0.79/1M out')
  speed TEXT NOT NULL CHECK (speed IN ('fast', 'medium', 'slow')), -- Speed rating
  quality TEXT NOT NULL CHECK (quality IN ('high', 'medium', 'low')), -- Quality rating
  is_available BOOLEAN DEFAULT true, -- Whether the model is currently available
  is_featured BOOLEAN DEFAULT false, -- Whether to feature this model prominently
  sort_order INTEGER DEFAULT 0, -- Custom sort order
  metadata JSONB DEFAULT '{}', -- Additional metadata (context window, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS models_provider_idx ON models(provider);
CREATE INDEX IF NOT EXISTS models_available_idx ON models(is_available);
CREATE INDEX IF NOT EXISTS models_featured_idx ON models(is_featured);
CREATE INDEX IF NOT EXISTS models_sort_order_idx ON models(sort_order);
CREATE INDEX IF NOT EXISTS models_capabilities_idx ON models USING GIN(capabilities);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER models_updated_at_trigger
  BEFORE UPDATE ON models
  FOR EACH ROW
  EXECUTE FUNCTION update_models_updated_at();
