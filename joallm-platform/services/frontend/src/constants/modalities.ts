import { AudioLines, BrainCircuit, Eye, FileSearch, type LucideIcon } from 'lucide-react';

export type ModalityCapabilityId = 'vision' | 'speech' | 'document_intelligence' | 'multimodal_reasoning';
export type MultimodalProcessingMode = 'analyze_directly' | 'extract_first' | 'add_to_knowledge' | 'route_to_workflow';
export type ProviderKey = 'openai' | 'anthropic' | 'groq' | 'cohere' | 'ollama';
export type ProviderPreference = ProviderKey | 'platform_default';
export type ProviderSupportLevel = 'native' | 'assisted' | 'planned' | 'none';

export interface ModalityCapability {
  id: ModalityCapabilityId;
  label: string;
  shortLabel: string;
  description: string;
  examples: string[];
  icon: LucideIcon;
  accentClass: string;
  route: string;
}

export interface ProviderCapabilityProfile {
  key: ProviderKey;
  label: string;
  description: string;
  strengths: string[];
  supportsByok: boolean;
  modalitySupport: Record<ModalityCapabilityId, ProviderSupportLevel>;
}

export interface ModalityRoutingPreference {
  primaryProvider: ProviderPreference;
  fallbackProviders: ProviderKey[];
  processingMode: MultimodalProcessingMode;
}

export interface MultimodalSettings {
  enabledCapabilities: ModalityCapabilityId[];
  routing: Record<ModalityCapabilityId, ModalityRoutingPreference>;
}

export const MODALITY_CAPABILITIES: ModalityCapability[] = [
  {
    id: 'vision',
    label: 'Vision',
    shortLabel: 'Vision',
    description: 'Understand screenshots, product images, charts, and video frames.',
    examples: ['screen review', 'visual QA', 'chart explanation'],
    icon: Eye,
    accentClass: 'text-blue-700 bg-blue-50 border-blue-200',
    route: '/chat',
  },
  {
    id: 'speech',
    label: 'Speech',
    shortLabel: 'Speech',
    description: 'Transcribe audio, summarize calls, and generate spoken responses.',
    examples: ['meeting transcript', 'voice note summary', 'TTS reply'],
    icon: AudioLines,
    accentClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    route: '/chat',
  },
  {
    id: 'document_intelligence',
    label: 'Document Intelligence',
    shortLabel: 'Docs',
    description: 'Extract layout, fields, tables, and structure from PDFs and forms.',
    examples: ['invoice fields', 'contract sections', 'table extraction'],
    icon: FileSearch,
    accentClass: 'text-amber-800 bg-amber-50 border-amber-200',
    route: '/rag-search',
  },
  {
    id: 'multimodal_reasoning',
    label: 'Multimodal Reasoning',
    shortLabel: 'Reasoning',
    description: 'Combine images, speech, and documents in one reasoning flow.',
    examples: ['PDF + screenshot', 'call + policy', 'video + notes'],
    icon: BrainCircuit,
    accentClass: 'text-violet-700 bg-violet-50 border-violet-200',
    route: '/notebook',
  },
];

export const MULTIMODAL_PROCESSING_MODES: Array<{
  id: MultimodalProcessingMode;
  label: string;
  description: string;
}> = [
  {
    id: 'analyze_directly',
    label: 'Answer now',
    description: 'Use the attached asset in the current reply.',
  },
  {
    id: 'extract_first',
    label: 'Extract first',
    description: 'Prefer OCR, transcript, field, or layout extraction before reasoning.',
  },
  {
    id: 'add_to_knowledge',
    label: 'Save for reuse',
    description: 'Treat this as something you may want to keep searchable for future grounded work.',
  },
  {
    id: 'route_to_workflow',
    label: 'Open in Studio',
    description: 'Treat this as the starting point for a Studio workspace or custom canvas.',
  },
];

export const PROVIDER_DISPLAY_NAMES: Record<ProviderPreference, string> = {
  platform_default: 'Platform Default',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  groq: 'Groq',
  cohere: 'Cohere',
  ollama: 'Ollama',
};

export const PROVIDER_SUPPORT_LABELS: Record<ProviderSupportLevel, string> = {
  native: 'Native',
  assisted: 'Assist',
  planned: 'Planned',
  none: 'Not used',
};

export const MULTIMODAL_PROVIDER_PROFILES: ProviderCapabilityProfile[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    description: 'Strong cross-modal APIs for vision, audio, structured extraction, and reasoning-heavy copilots.',
    strengths: ['vision analysis', 'speech in/out', 'structured outputs'],
    supportsByok: true,
    modalitySupport: {
      vision: 'native',
      speech: 'native',
      document_intelligence: 'native',
      multimodal_reasoning: 'native',
    },
  },
  {
    key: 'anthropic',
    label: 'Anthropic',
    description: 'Best fit when long-context reasoning and careful document synthesis matter most.',
    strengths: ['long-context reasoning', 'document synthesis', 'agentic analysis'],
    supportsByok: true,
    modalitySupport: {
      vision: 'native',
      speech: 'planned',
      document_intelligence: 'assisted',
      multimodal_reasoning: 'native',
    },
  },
  {
    key: 'groq',
    label: 'Groq',
    description: 'Fastest lane for low-latency assistants, transcription, and operational workflows.',
    strengths: ['fast inference', 'speech transcription', 'workflow latency'],
    supportsByok: true,
    modalitySupport: {
      vision: 'assisted',
      speech: 'native',
      document_intelligence: 'assisted',
      multimodal_reasoning: 'native',
    },
  },
  {
    key: 'cohere',
    label: 'Cohere',
    description: 'Useful as the retrieval and grounding layer around multimodal extractions and document search.',
    strengths: ['embeddings', 'reranking', 'retrieval grounding'],
    supportsByok: true,
    modalitySupport: {
      vision: 'none',
      speech: 'none',
      document_intelligence: 'assisted',
      multimodal_reasoning: 'assisted',
    },
  },
  {
    key: 'ollama',
    label: 'Ollama',
    description: 'Private-hosted path for enterprise deployments when local control matters more than convenience.',
    strengths: ['private deployment', 'local inference', 'enterprise control'],
    supportsByok: false,
    modalitySupport: {
      vision: 'planned',
      speech: 'planned',
      document_intelligence: 'planned',
      multimodal_reasoning: 'assisted',
    },
  },
];

export const DEFAULT_MULTIMODAL_SETTINGS: MultimodalSettings = {
  enabledCapabilities: ['vision', 'speech', 'document_intelligence', 'multimodal_reasoning'],
  routing: {
    vision: {
      primaryProvider: 'openai',
      fallbackProviders: ['anthropic', 'groq'],
      processingMode: 'analyze_directly',
    },
    speech: {
      primaryProvider: 'groq',
      fallbackProviders: ['openai'],
      processingMode: 'extract_first',
    },
    document_intelligence: {
      primaryProvider: 'openai',
      fallbackProviders: ['cohere', 'anthropic'],
      processingMode: 'extract_first',
    },
    multimodal_reasoning: {
      primaryProvider: 'anthropic',
      fallbackProviders: ['openai', 'groq'],
      processingMode: 'analyze_directly',
    },
  },
};

export function getProviderDisplayName(provider: ProviderPreference): string {
  return PROVIDER_DISPLAY_NAMES[provider];
}

export function normalizeMultimodalSettings(
  settings?: Partial<MultimodalSettings> | null,
): MultimodalSettings {
  const incomingRouting = settings?.routing ?? {};

  return {
    enabledCapabilities:
      settings?.enabledCapabilities?.filter((capability): capability is ModalityCapabilityId =>
        MODALITY_CAPABILITIES.some((candidate) => candidate.id === capability),
      ) ?? DEFAULT_MULTIMODAL_SETTINGS.enabledCapabilities,
    routing: {
      vision: {
        ...DEFAULT_MULTIMODAL_SETTINGS.routing.vision,
        ...incomingRouting.vision,
      },
      speech: {
        ...DEFAULT_MULTIMODAL_SETTINGS.routing.speech,
        ...incomingRouting.speech,
      },
      document_intelligence: {
        ...DEFAULT_MULTIMODAL_SETTINGS.routing.document_intelligence,
        ...incomingRouting.document_intelligence,
      },
      multimodal_reasoning: {
        ...DEFAULT_MULTIMODAL_SETTINGS.routing.multimodal_reasoning,
        ...incomingRouting.multimodal_reasoning,
      },
    },
  };
}
