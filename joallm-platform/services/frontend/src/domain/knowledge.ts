import { AttachmentStatus, Document } from '../types';

export type KnowledgeStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface BackendKnowledgeDocument {
  id: string;
  name?: string;
  filename?: string;
  originalName?: string;
  mimetype?: string;
  type?: string;
  size: number;
  status?: string;
  uploadedAt?: Date | string;
  uploadDate?: string;
  createdAt?: Date | string;
  processingDate?: string;
  storageUrl?: string;
  storageKey?: string;
  storageProvider?: 'volume' | 'cloudflare-r2' | 'aws-s3';
  chunks?: number;
  processingError?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeDocument {
  id: string;
  displayName: string;
  name?: string;
  filename?: string;
  originalName?: string;
  mimeType?: string;
  type?: string;
  size: number;
  status: KnowledgeStatus;
  uploadedAt?: string;
  uploadDate?: string;
  processingDate?: string;
  storageUrl?: string;
  storageKey?: string;
  storageProvider?: 'volume' | 'cloudflare-r2' | 'aws-s3';
  chunks?: number;
  processingError?: string;
  isReady: boolean;
  isProcessing: boolean;
  hasFailed: boolean;
  backend: BackendKnowledgeDocument;
}

export interface BackendKnowledgeSearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: {
    fileId?: string;
    filename?: string;
    chunkIndex?: number;
    startChar?: number;
    endChar?: number;
  };
  file?: {
    id?: string;
    filename?: string;
    uploadDate?: string;
    size?: number;
  };
  documentId?: string;
  documentName?: string;
}

export interface KnowledgeSearchResultView {
  id: string;
  content: string;
  score: number;
  scoreLabel: 'high' | 'medium' | 'low';
  fileId?: string;
  filename: string;
  chunkIndex: number | 'N/A';
  startChar: number;
  endChar: number;
  uploadDate?: string;
  size?: number;
  documentId?: string;
}

export interface KnowledgeSourceView {
  id: string;
  filename: string;
  content: string;
  score: number;
  chunkIndex: number;
  scoreLabel: 'high' | 'medium' | 'low';
}

export const normalizeKnowledgeStatus = (status?: string): KnowledgeStatus => {
  if (status === AttachmentStatus.READY || status === 'processed' || status === 'ready') {
    return 'ready';
  }
  if (status === AttachmentStatus.PROCESSING || status === 'processing' || status === 'uploaded') {
    return status === 'uploaded' ? 'uploaded' : 'processing';
  }
  if (status === AttachmentStatus.ERROR || status === 'failed' || status === 'error') {
    return 'failed';
  }
  return 'uploaded';
};

export const getKnowledgeScoreLabel = (score: number): 'high' | 'medium' | 'low' => {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
};

export const mapBackendFileToKnowledgeDocument = (
  document: BackendKnowledgeDocument | Document
): KnowledgeDocument => {
  const status = normalizeKnowledgeStatus(document.status);
  const displayName = document.name || document.filename || document.originalName || 'Untitled document';
  const uploadedAt =
    typeof document.uploadedAt === 'string'
      ? document.uploadedAt
      : document.uploadDate ||
        (document.uploadedAt instanceof Date ? document.uploadedAt.toISOString() : undefined) ||
        (document.createdAt instanceof Date ? document.createdAt.toISOString() : typeof document.createdAt === 'string' ? document.createdAt : undefined);

  return {
    id: document.id,
    displayName,
    name: document.name,
    filename: document.filename,
    originalName: document.originalName,
    mimeType: document.mimetype || document.type,
    type: document.type,
    size: document.size,
    status,
    uploadedAt,
    uploadDate: document.uploadDate,
    processingDate: document.processingDate,
    storageUrl: 'storageUrl' in document ? document.storageUrl : undefined,
    storageKey: 'storageKey' in document ? (document as BackendKnowledgeDocument).storageKey : undefined,
    storageProvider: 'storageProvider' in document ? (document as BackendKnowledgeDocument).storageProvider : undefined,
    chunks: document.chunks,
    processingError: 'processingError' in document ? document.processingError : undefined,
    isReady: status === 'ready',
    isProcessing: status === 'uploaded' || status === 'processing',
    hasFailed: status === 'failed',
    backend: document as BackendKnowledgeDocument,
  };
};

export const mapBackendSearchResultToKnowledgeResult = (
  result: BackendKnowledgeSearchResult
): KnowledgeSearchResultView => {
  const metadata = result.metadata || {};
  const file = result.file || {};

  return {
    id: result.id,
    content: result.content,
    score: result.score,
    scoreLabel: getKnowledgeScoreLabel(result.score),
    fileId: file.id || metadata.fileId,
    filename: file.filename || metadata.filename || result.documentName || 'Unknown document',
    chunkIndex: metadata.chunkIndex !== undefined ? metadata.chunkIndex + 1 : 'N/A',
    startChar: metadata.startChar || 0,
    endChar: metadata.endChar || 0,
    uploadDate: file.uploadDate,
    size: file.size,
    documentId: result.documentId || file.id || metadata.fileId,
  };
};

export const mapBackendSourceToKnowledgeSource = (source: {
  id: string;
  filename: string;
  content: string;
  score: number;
  chunkIndex: number;
}): KnowledgeSourceView => ({
  id: source.id,
  filename: source.filename,
  content: source.content,
  score: source.score,
  chunkIndex: source.chunkIndex,
  scoreLabel: getKnowledgeScoreLabel(source.score),
});
