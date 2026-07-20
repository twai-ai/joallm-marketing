// Core types for the application

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'developer' | 'analyst' | 'business' | 'casual';
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSession {
  id: string;
  shortId: string;
  title: string;
  model: string;
  userId: string;
  autoTitle: boolean;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: Date;
  attachments?: Attachment[];
  ragSources?: RAGSource[];
  metadata?: Record<string, any>;
}

// Phase 8: RAG-related types
export interface RAGSource {
  documentId: string;
  documentName: string;
  chunkContent: string;
  score: number; // 0-1 relevance score
  chunkIndex: number;
  pageNumber?: number;
  metadata?: Record<string, any>;
}

export interface RAGContextPreview {
  documentId: string;
  documentName: string;
  matchingChunks: {
    content: string;
    score: number;
    chunkIndex: number;
  }[];
  estimatedTokens: number;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'document';
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
}

// Phase 8: Enhanced attachment types
export enum AttachmentStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  EMBEDDING = 'embedding',
  READY = 'ready',
  ERROR = 'error'
}

export enum AttachmentPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low'
}

export interface AttachmentMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  relevanceBoost?: number; // -2 to +2
  activeSections?: number[]; // Chunk indices to include/exclude
  priority?: AttachmentPriority;
}

export interface Document {
  id: string;
  name?: string; // Optional for backward compatibility
  filename?: string; // Backend property
  originalName?: string; // Backend property
  type?: string;
  mimetype?: string; // Backend property
  size: number;
  uploadedAt?: Date;
  uploadDate?: string; // Backend property
  status: AttachmentStatus;
  chunks?: number;
  userId?: string;
  metadata?: AttachmentMetadata;
  // Processing progress info
  progress?: {
    percentage: number;
    stage: 'uploading' | 'parsing' | 'chunking' | 'embedding';
    estimatedTimeRemaining?: number; // seconds
    queuePosition?: number;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  userId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: Date;
  updatedAt: Date;
  status?: 'draft' | 'published' | 'archived';
}

export interface WorkflowNode {
  id: string;
  type: 'input' | 'llm' | 'tool' | 'output' | 'condition' | 'knowledge' | 'agent' | 'debug';
  name: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  connections?: string[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export interface Notebook {
  id: string;
  name: string;
  description?: string;
  userId: string;
  cells: NotebookCell[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotebookCell {
  id: string;
  type: 'markdown' | 'code' | 'ai' | 'chart' | 'knowledge' | 'agent' | 'debug';
  content: string;
  output?: string;
  metadata?: Record<string, any>;
}

export interface APIError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

