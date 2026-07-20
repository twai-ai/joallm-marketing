/**
 * Shared types across JoaLLM platform services
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'casual' | 'admin' | 'premium' | 'superuser';
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sessionId?: string;
}

export interface Document {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'groq' | 'cohere';
  modelId: string;
  enabled: boolean;
  maxTokens: number;
  contextWindow: number;
}

/**
 * Knowledge Acquisition / Acquisition Intelligence — canonical platform contracts.
 * @see ./knowledge-acquisition.ts
 * @see ../../docs/04-architecture/KNOWLEDGE_ACQUISITION_DIRECTION.md
 */
export * from './knowledge-acquisition';

/**
 * Integration Platform — Connectors (Platform-owned execution).
 * @see ./integration-platform.ts
 * @see ../../docs/04-architecture/PLATFORM_CONSTITUTION.md
 */
export * from './integration-platform';

/**
 * Marketing Studio — Channels, Profiles, Publishing Jobs (Studio-owned intent).
 * @see ./studio-publishing.ts
 * @see ../../docs/04-architecture/MARKETING_STUDIO_DIRECTION.md
 */
export * from './studio-publishing';

/**
 * Creative AI Platform — Generation Profiles + image/video providers (Platform-owned).
 * @see ./creative-ai.ts
 * @see ../../docs/04-architecture/CREATIVE_AI_DIRECTION.md
 */
export * from './creative-ai';

/**
 * Program aggregate — Core vs attached Capabilities (Institution OS).
 * @see ./program-aggregate.ts
 * @see ../../docs/04-architecture/PROGRAM_AGGREGATE_DIRECTION.md
 * @see ../../docs/04-architecture/INSTITUTION_CAPABILITY_PATTERN.md
 */
export * from './program-aggregate';
