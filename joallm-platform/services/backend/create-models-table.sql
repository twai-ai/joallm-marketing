-- Create models table directly
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  description TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]',
  max_tokens INTEGER NOT NULL,
  cost TEXT NOT NULL,
  speed TEXT NOT NULL CHECK (speed IN ('fast', 'medium', 'slow')),
  quality TEXT NOT NULL CHECK (quality IN ('high', 'medium', 'low')),
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS models_provider_idx ON models(provider);
CREATE INDEX IF NOT EXISTS models_available_idx ON models(is_available);
CREATE INDEX IF NOT EXISTS models_featured_idx ON models(is_featured);
CREATE INDEX IF NOT EXISTS models_sort_order_idx ON models(sort_order);
CREATE INDEX IF NOT EXISTS models_capabilities_idx ON models USING GIN(capabilities);

-- Insert all models
INSERT INTO models (model_id, name, provider, description, capabilities, max_tokens, cost, speed, quality, is_available, is_featured, sort_order) VALUES

-- === GROQ MODELS (Default) ===
('llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile (Groq)', 'Groq', '⚡ 280 tok/s - Most capable Llama 3.3, 131K context', '["Text", "Code", "Analysis", "Reasoning"]', 32768, '$0.59/1M in + $0.79/1M out', 'fast', 'high', true, true, 1),

-- === OLLAMA MODELS (Local) ===
('llama2:7b', 'Llama 2 7B (Local)', 'Ollama', '🏠 Local - Fast, free, private. No API costs!', '["Text", "Code", "Analysis"]', 4096, 'Free', 'fast', 'medium', true, false, 10),
('llama2:13b', 'Llama 2 13B (Local)', 'Ollama', '🏠 Local - Better quality, still free and private', '["Text", "Code", "Analysis", "Reasoning"]', 4096, 'Free', 'medium', 'high', true, false, 11),
('mistral:7b', 'Mistral 7B (Local)', 'Ollama', '🏠 Local - Excellent instruction following, multilingual', '["Text", "Code", "Analysis", "Multilingual"]', 8192, 'Free', 'fast', 'high', true, false, 12),
('codellama:7b', 'Code Llama 7B (Local)', 'Ollama', '🏠 Local - Specialized for code generation and analysis', '["Code", "Text", "Analysis"]', 16384, 'Free', 'fast', 'high', true, false, 13),
('phi:latest', 'Microsoft Phi-2 (Local)', 'Ollama', '🏠 Local - Small, fast, efficient for most tasks', '["Text", "Code", "Analysis"]', 2048, 'Free', 'fast', 'medium', true, false, 14),

-- === OPENAI MODELS ===
('gpt-4-turbo', 'GPT-4 Turbo', 'OpenAI', 'Latest GPT-4 with 128K context, vision, and JSON mode', '["Text", "Code", "Analysis", "Reasoning", "Vision"]', 128000, '$0.01/1K in + $0.03/1K out', 'fast', 'high', true, true, 2),
('gpt-4', 'GPT-4', 'OpenAI', 'Original GPT-4, most capable reasoning model', '["Text", "Code", "Analysis", "Reasoning"]', 8192, '$0.03/1K in + $0.06/1K out', 'medium', 'high', true, false, 3),
('gpt-3.5-turbo', 'GPT-3.5 Turbo', 'OpenAI', 'Fast and affordable, great for most tasks', '["Text", "Code", "Analysis"]', 16385, '$0.0005/1K in + $0.0015/1K out', 'fast', 'medium', true, false, 4),

-- === ANTHROPIC MODELS ===
('claude-3-sonnet', 'Claude 3 Sonnet', 'Anthropic', 'Balanced performance with strong reasoning capabilities', '["Text", "Analysis", "Code", "Creative Writing"]', 200000, '$0.003/1K tokens', 'medium', 'high', true, true, 5),

-- === GROQ MODELS ===
('meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout 17B (Groq)', 'Groq', '🚀 FASTEST! 750 tok/s - Ideal for summarization, reasoning, code', '["Text", "Code", "Analysis", "Reasoning", "Summarization"]', 8192, '$0.11/1M in + $0.34/1M out', 'fast', 'high', true, true, 6),
('meta-llama/llama-4-maverick-17b-128e-instruct', 'Llama 4 Maverick 17B (Groq)', 'Groq', '🌍 600 tok/s - Multilingual & multimodal, great for assistants', '["Text", "Code", "Multilingual", "Creative Writing", "Chat"]', 8192, '$0.20/1M in + $0.60/1M out', 'fast', 'high', true, false, 7),
('llama-3.1-8b-instant', 'Llama 3.1 8B Instant (Groq)', 'Groq', '⚡⚡ 560 tok/s - Ultra-fast, most cost-effective', '["Text", "Code", "Analysis"]', 131072, '$0.05/1M in + $0.08/1M out', 'fast', 'medium', true, false, 8),
('openai/gpt-oss-120b', 'GPT-OSS 120B (Groq)', 'Groq', '500 tok/s - OpenAI open model, strong general performance', '["Text", "Code", "Analysis", "Reasoning"]', 65536, '$0.15/1M in + $0.60/1M out', 'fast', 'high', true, false, 9),
('openai/gpt-oss-20b', 'GPT-OSS 20B (Groq)', 'Groq', '⚡ 1000 tok/s - Fast OpenAI open model, great value', '["Text", "Code", "Analysis"]', 65536, '$0.075/1M in + $0.30/1M out', 'fast', 'medium', true, false, 15),
('groq/compound', 'Groq Compound (Groq)', 'Groq', '450 tok/s - Advanced reasoning system with compound intelligence', '["Text", "Reasoning", "Analysis", "Problem Solving"]', 8192, 'Contact for pricing', 'fast', 'high', true, false, 16),
('groq/compound-mini', 'Groq Compound Mini (Groq)', 'Groq', '450 tok/s - Lightweight compound reasoning system', '["Text", "Reasoning", "Analysis"]', 8192, 'Contact for pricing', 'fast', 'medium', true, false, 17),
('qwen/qwen3-32b', 'Qwen 3 32B (Groq)', 'Groq', '400 tok/s - Alibaba Qwen 3, excellent for multilingual tasks', '["Text", "Code", "Multilingual", "Analysis"]', 40960, '$0.29/1M in + $0.59/1M out', 'fast', 'high', true, false, 18),
('moonshotai/kimi-k2-instruct-0905', 'Kimi K2 (Groq)', 'Groq', '200 tok/s - 262K context! Moonshot AI model for long documents', '["Text", "Long Context", "Analysis", "Document Processing"]', 16384, '$1.00/1M in + $3.00/1M out', 'medium', 'high', true, false, 19),
('mixtral-8x7b-32768', 'Mixtral 8x7B (Groq)', 'Groq', 'Fast Mixtral mixture-of-experts, 32K context', '["Text", "Code", "Analysis", "Multilingual"]', 32768, '$0.24/1M tokens', 'fast', 'high', true, false, 20),
('gemma2-9b-it', 'Gemma 2 9B (Groq)', 'Groq', 'Google Gemma 2 9B - efficient and fast', '["Text", "Code", "Analysis"]', 8192, '$0.20/1M tokens', 'fast', 'high', true, false, 21),

-- === ADDITIONAL GROQ MODELS ===
('whisper-large-v3', 'Whisper Large V3 (Groq)', 'Groq', '🎤 Speech-to-text model for audio transcription', '["Speech-to-Text", "Audio", "Transcription"]', 448, '$0.006/1K tokens', 'fast', 'high', true, false, 30),
('whisper-large-v3-turbo', 'Whisper Large V3 Turbo (Groq)', 'Groq', '🎤⚡ Fast speech-to-text model for real-time transcription', '["Speech-to-Text", "Audio", "Real-time"]', 448, '$0.006/1K tokens', 'fast', 'high', true, false, 31),
('playai-tts', 'PlayAI TTS (Groq)', 'Groq', '🔊 Text-to-speech model for voice synthesis', '["Text-to-Speech", "Voice", "Audio Generation"]', 8192, 'Contact for pricing', 'medium', 'high', true, false, 32),
('playai-tts-arabic', 'PlayAI TTS Arabic (Groq)', 'Groq', '🔊🇸🇦 Arabic text-to-speech model', '["Text-to-Speech", "Arabic", "Voice"]', 8192, 'Contact for pricing', 'medium', 'high', true, false, 33),
('meta-llama/llama-guard-4-12b', 'Llama Guard 4 12B (Groq)', 'Groq', '🛡️ Safety guard model for content filtering', '["Safety", "Content Filtering", "Moderation"]', 1024, '$0.20/1M tokens', 'fast', 'high', true, false, 34),
('meta-llama/llama-prompt-guard-2-22m', 'Llama Prompt Guard 2 22M (Groq)', 'Groq', '🛡️ Lightweight prompt safety guard', '["Safety", "Prompt Filtering"]', 512, '$0.10/1M tokens', 'fast', 'medium', true, false, 35),
('meta-llama/llama-prompt-guard-2-86m', 'Llama Prompt Guard 2 86M (Groq)', 'Groq', '🛡️ Enhanced prompt safety guard', '["Safety", "Prompt Filtering", "Moderation"]', 512, '$0.15/1M tokens', 'fast', 'high', true, false, 36),
('moonshotai/kimi-k2-instruct', 'Kimi K2 Instruct (Groq)', 'Groq', '🌙 Moonshot AI model with 131K context', '["Text", "Long Context", "Analysis"]', 16384, '$0.80/1M in + $2.40/1M out', 'medium', 'high', true, false, 37),
('allam-2-7b', 'Allam 2 7B (Groq)', 'Groq', '🇸🇦 Saudi AI model for Arabic language tasks', '["Text", "Arabic", "Multilingual"]', 4096, '$0.15/1M tokens', 'fast', 'medium', true, false, 38);

-- Show results
SELECT COUNT(*) as total_models FROM models;
SELECT model_id, name, provider, is_available FROM models ORDER BY sort_order LIMIT 5;
