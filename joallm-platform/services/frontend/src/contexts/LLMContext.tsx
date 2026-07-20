import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { modelsApiService } from '../services/modelsApi';
import { LLMModel, resolveSelectedModel } from '../domain/model';

export type { LLMModel } from '../domain/model';

export type ModelParameters = {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
};

interface LLMContextType {
  availableModels: LLMModel[];
  selectedModel: LLMModel;
  setSelectedModel: (model: LLMModel) => void;
  parameters: ModelParameters;
  setParameters: (params: Partial<ModelParameters>) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  isLoadingModels: boolean;
}

const defaultModels: LLMModel[] = [
  // === GROQ MODELS (Default) ===
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile (Groq)',
    provider: 'Groq',
    description: '⚡ 280 tok/s - Most capable Llama 3.3, 131K context',
    capabilities: ['Text', 'Code', 'Analysis', 'Reasoning'],
    maxTokens: 32768,
    cost: '$0.59/1M in + $0.79/1M out',
    speed: 'fast',
    quality: 'high',
  },
  // === OLLAMA MODELS (Local) ===
  {
    id: 'llama2:7b',
    name: 'Llama 2 7B (Local)',
    provider: 'Ollama',
    description: '🏠 Local - Fast, free, private. No API costs!',
    capabilities: ['Text', 'Code', 'Analysis'],
    maxTokens: 4096,
    cost: 'Free',
    speed: 'fast',
    quality: 'medium',
  },
  {
    id: 'llama2:13b',
    name: 'Llama 2 13B (Local)',
    provider: 'Ollama',
    description: '🏠 Local - Better quality, still free and private',
    capabilities: ['Text', 'Code', 'Analysis', 'Reasoning'],
    maxTokens: 4096,
    cost: 'Free',
    speed: 'medium',
    quality: 'high',
  },
  {
    id: 'mistral:7b',
    name: 'Mistral 7B (Local)',
    provider: 'Ollama',
    description: '🏠 Local - Excellent instruction following, multilingual',
    capabilities: ['Text', 'Code', 'Analysis', 'Multilingual'],
    maxTokens: 8192,
    cost: 'Free',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'codellama:7b',
    name: 'Code Llama 7B (Local)',
    provider: 'Ollama',
    description: '🏠 Local - Specialized for code generation and analysis',
    capabilities: ['Code', 'Text', 'Analysis'],
    maxTokens: 16384,
    cost: 'Free',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'phi:latest',
    name: 'Microsoft Phi-2 (Local)',
    provider: 'Ollama',
    description: '🏠 Local - Small, fast, efficient for most tasks',
    capabilities: ['Text', 'Code', 'Analysis'],
    maxTokens: 2048,
    cost: 'Free',
    speed: 'fast',
    quality: 'medium',
  },
  // === OPENAI MODELS ===
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Latest GPT-4 with 128K context, vision, and JSON mode',
    capabilities: ['Text', 'Code', 'Analysis', 'Reasoning', 'Vision'],
    maxTokens: 128000,
    cost: '$0.01/1K in + $0.03/1K out',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    description: 'Original GPT-4, most capable reasoning model',
    capabilities: ['Text', 'Code', 'Analysis', 'Reasoning'],
    maxTokens: 8192,
    cost: '$0.03/1K in + $0.06/1K out',
    speed: 'medium',
    quality: 'high',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    description: 'Fast and affordable, great for most tasks',
    capabilities: ['Text', 'Code', 'Analysis'],
    maxTokens: 16385,
    cost: '$0.0005/1K in + $0.0015/1K out',
    speed: 'fast',
    quality: 'medium',
  },
  // Anthropic Models
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    description: 'Balanced performance with strong reasoning capabilities',
    capabilities: ['Text', 'Analysis', 'Code', 'Creative Writing'],
    maxTokens: 200000,
    cost: '$0.003/1K tokens',
    speed: 'medium',
    quality: 'high',
  },
  // === GROQ MODELS ===
  // Llama 4 Series (Preview - Latest & Fastest)
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B (Groq)',
    provider: 'Groq',
    description: '🚀 FASTEST! 750 tok/s - Ideal for summarization, reasoning, code',
    capabilities: ['Text', 'Code', 'Analysis', 'Reasoning', 'Summarization'],
    maxTokens: 8192,
    cost: '$0.11/1M in + $0.34/1M out',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    name: 'Llama 4 Maverick 17B (Groq)',
    provider: 'Groq',
    description: '🌍 600 tok/s - Multilingual & multimodal, great for assistants',
    capabilities: ['Text', 'Code', 'Multilingual', 'Creative Writing', 'Chat'],
    maxTokens: 8192,
    cost: '$0.20/1M in + $0.60/1M out',
    speed: 'fast',
    quality: 'high',
  },
  // Llama 3.1 Series (Production)
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant (Groq)',
    provider: 'Groq',
    description: '⚡⚡ 560 tok/s - Ultra-fast, most cost-effective',
    capabilities: ['Text', 'Code', 'Analysis'],
    maxTokens: 131072,
    cost: '$0.05/1M in + $0.08/1M out',
    speed: 'fast',
    quality: 'medium',
  },
  // OpenAI Open Models on Groq
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B (Groq)',
    provider: 'Groq',
    description: '500 tok/s - OpenAI open model, strong general performance',
    capabilities: ['Text', 'Code', 'Analysis', 'Reasoning'],
    maxTokens: 65536,
    cost: '$0.15/1M in + $0.60/1M out',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B (Groq)',
    provider: 'Groq',
    description: '⚡ 1000 tok/s - Fast OpenAI open model, great value',
    capabilities: ['Text', 'Code', 'Analysis'],
    maxTokens: 65536,
    cost: '$0.075/1M in + $0.30/1M out',
    speed: 'fast',
    quality: 'medium',
  },
  // Groq Compound Systems (Production)
  {
    id: 'groq/compound',
    name: 'Groq Compound (Groq)',
    provider: 'Groq',
    description: '450 tok/s - Advanced reasoning system with compound intelligence',
    capabilities: ['Text', 'Reasoning', 'Analysis', 'Problem Solving'],
    maxTokens: 8192,
    cost: 'Contact for pricing',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'groq/compound-mini',
    name: 'Groq Compound Mini (Groq)',
    provider: 'Groq',
    description: '450 tok/s - Lightweight compound reasoning system',
    capabilities: ['Text', 'Reasoning', 'Analysis'],
    maxTokens: 8192,
    cost: 'Contact for pricing',
    speed: 'fast',
    quality: 'medium',
  },
  // Other Open Models on Groq
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen 3 32B (Groq)',
    provider: 'Groq',
    description: '400 tok/s - Alibaba Qwen 3, excellent for multilingual tasks',
    capabilities: ['Text', 'Code', 'Multilingual', 'Analysis'],
    maxTokens: 40960,
    cost: '$0.29/1M in + $0.59/1M out',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'moonshotai/kimi-k2-instruct-0905',
    name: 'Kimi K2 (Groq)',
    provider: 'Groq',
    description: '200 tok/s - 262K context! Moonshot AI model for long documents',
    capabilities: ['Text', 'Long Context', 'Analysis', 'Document Processing'],
    maxTokens: 16384,
    cost: '$1.00/1M in + $3.00/1M out',
    speed: 'medium',
    quality: 'high',
  },
  // Legacy Groq Models (still available)
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B (Groq)',
    provider: 'Groq',
    description: 'Fast Mixtral mixture-of-experts, 32K context',
    capabilities: ['Text', 'Code', 'Analysis', 'Multilingual'],
    maxTokens: 32768,
    cost: '$0.24/1M tokens',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B (Groq)',
    provider: 'Groq',
    description: 'Google Gemma 2 9B - efficient and fast',
    capabilities: ['Text', 'Code', 'Analysis'],
    maxTokens: 8192,
    cost: '$0.20/1M tokens',
    speed: 'fast',
    quality: 'high',
  },
  // === ADDITIONAL GROQ MODELS ===
  // Whisper Models (Speech-to-Text)
  {
    id: 'whisper-large-v3',
    name: 'Whisper Large V3 (Groq)',
    provider: 'Groq',
    description: '🎤 Speech-to-text model for audio transcription',
    capabilities: ['Speech-to-Text', 'Audio', 'Transcription'],
    maxTokens: 448,
    cost: '$0.006/1K tokens',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large V3 Turbo (Groq)',
    provider: 'Groq',
    description: '🎤⚡ Fast speech-to-text model for real-time transcription',
    capabilities: ['Speech-to-Text', 'Audio', 'Real-time'],
    maxTokens: 448,
    cost: '$0.006/1K tokens',
    speed: 'fast',
    quality: 'high',
  },
  // PlayAI TTS Models
  {
    id: 'playai-tts',
    name: 'PlayAI TTS (Groq)',
    provider: 'Groq',
    description: '🔊 Text-to-speech model for voice synthesis',
    capabilities: ['Text-to-Speech', 'Voice', 'Audio Generation'],
    maxTokens: 8192,
    cost: 'Contact for pricing',
    speed: 'medium',
    quality: 'high',
  },
  {
    id: 'playai-tts-arabic',
    name: 'PlayAI TTS Arabic (Groq)',
    provider: 'Groq',
    description: '🔊🇸🇦 Arabic text-to-speech model',
    capabilities: ['Text-to-Speech', 'Arabic', 'Voice'],
    maxTokens: 8192,
    cost: 'Contact for pricing',
    speed: 'medium',
    quality: 'high',
  },
  // Meta Llama Guard Models
  {
    id: 'meta-llama/llama-guard-4-12b',
    name: 'Llama Guard 4 12B (Groq)',
    provider: 'Groq',
    description: '🛡️ Safety guard model for content filtering',
    capabilities: ['Safety', 'Content Filtering', 'Moderation'],
    maxTokens: 1024,
    cost: '$0.20/1M tokens',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'meta-llama/llama-prompt-guard-2-22m',
    name: 'Llama Prompt Guard 2 22M (Groq)',
    provider: 'Groq',
    description: '🛡️ Lightweight prompt safety guard',
    capabilities: ['Safety', 'Prompt Filtering'],
    maxTokens: 512,
    cost: '$0.10/1M tokens',
    speed: 'fast',
    quality: 'medium',
  },
  {
    id: 'meta-llama/llama-prompt-guard-2-86m',
    name: 'Llama Prompt Guard 2 86M (Groq)',
    provider: 'Groq',
    description: '🛡️ Enhanced prompt safety guard',
    capabilities: ['Safety', 'Prompt Filtering', 'Moderation'],
    maxTokens: 512,
    cost: '$0.15/1M tokens',
    speed: 'fast',
    quality: 'high',
  },
  // Additional Moonshot Models
  {
    id: 'moonshotai/kimi-k2-instruct',
    name: 'Kimi K2 Instruct (Groq)',
    provider: 'Groq',
    description: '🌙 Moonshot AI model with 131K context',
    capabilities: ['Text', 'Long Context', 'Analysis'],
    maxTokens: 16384,
    cost: '$0.80/1M in + $2.40/1M out',
    speed: 'medium',
    quality: 'high',
  },
  // SDAIA Models
  {
    id: 'allam-2-7b',
    name: 'Allam 2 7B (Groq)',
    provider: 'Groq',
    description: '🇸🇦 Saudi AI model for Arabic language tasks',
    capabilities: ['Text', 'Arabic', 'Multilingual'],
    maxTokens: 4096,
    cost: '$0.15/1M tokens',
    speed: 'fast',
    quality: 'medium',
  },
];

const defaultParameters: ModelParameters = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
};

const LLMContext = createContext<LLMContextType | undefined>(undefined);

export function LLMProvider({ children }: { children: ReactNode }) {
  const [availableModels, setAvailableModels] = useState<LLMModel[]>(defaultModels);
  const [selectedModelId, setSelectedModelId] = useState(defaultModels[0].id);
  const [parameters, setParametersState] = useState<ModelParameters>(defaultParameters);
  const [isStreaming, setIsStreaming] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const selectedModel = useMemo(
    () => resolveSelectedModel(availableModels, selectedModelId, defaultModels[0]),
    [availableModels, selectedModelId]
  );

  const setParameters = (newParams: Partial<ModelParameters>) => {
    setParametersState(prev => ({ ...prev, ...newParams }));
  };

  const setSelectedModel = (model: LLMModel) => {
    setSelectedModelId(model.id);
  };

  // Fetch models from API on component mount
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        const models = await modelsApiService.getModels();
        if (models.length > 0) {
          setAvailableModels(models);
        }
      } catch (error) {
        // Only log in development
        if (import.meta.env.DEV) {
          console.error('Failed to fetch models from API, using default models:', error);
        }
        // Keep using default models if API fails
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, []);

  // Update selected model when available models change
  useEffect(() => {
    if (availableModels.length === 0) {
      return;
    }

    setSelectedModelId(currentModelId => {
      const modelExists = availableModels.some(model => model.id === currentModelId);
      return modelExists ? currentModelId : availableModels[0].id;
    });
  }, [availableModels]);

  return (
    <LLMContext.Provider value={{
      availableModels,
      selectedModel,
      setSelectedModel,
      parameters,
      setParameters,
      isStreaming,
      setIsStreaming,
      isLoadingModels,
    }}>
      {children}
    </LLMContext.Provider>
  );
}

export function useLLM() {
  const context = useContext(LLMContext);
  if (context === undefined) {
    throw new Error('useLLM must be used within an LLMProvider');
  }
  return context;
}
