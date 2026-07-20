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

/** Acquisition Intelligence — canonical event / person contracts */
export type AcquisitionPersonStatus =
  | 'anonymous'
  | 'identified'
  | 'verified'
  | 'merged'
  | 'archived';

export type AcquisitionIdentityProvider =
  | 'email'
  | 'phone'
  | 'linkedin'
  | 'meta'
  | 'google'
  | 'whatsapp'
  | 'education_platform'
  | 'builder_challenge'
  | 'anonymous_cookie'
  | 'custom';

export interface AcquisitionPerson {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  displayName?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  status: AcquisitionPersonStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcquisitionEvent {
  id: string;
  ownerUserId: string;
  sourceConnectionId: string;
  rawRecordId: string;
  source: string;
  eventType: string;
  occurredAt: string;
  receivedAt: string;
  personId?: string | null;
  channel?: string | null;
  attributes: Record<string, unknown>;
  schemaVersion: number;
}
