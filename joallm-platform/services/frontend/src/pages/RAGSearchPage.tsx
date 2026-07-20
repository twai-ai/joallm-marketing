import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCheck,
  Clock3,
  CreditCard,
  Film,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDocuments } from '../hooks/useDocuments';
import { RAGChatInterface } from '../components/rag/RAGChatInterface';
import { KnowledgeDocumentCard } from '../components/entities/KnowledgeDocumentCard';
import { PRODUCT_LABELS } from '../constants/product';
import { showError, showSuccess } from '../utils/toast';
import { useUserRole } from '../contexts/EnhancedUserRoleContext';
import { apiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../config/api';
import type { RAGSearchLocationState } from '../types/navigation';

interface RAGSearchPageProps {
  className?: string;
  onUpgrade?: () => void;
}

type DocumentFilter = 'all' | 'ready' | 'processing' | 'failed' | 'selected';

function getKnowledgeReadiness(document: any) {
  const metadata = document?.backend?.metadata || {};
  const indexingStatus = String(metadata.indexingStatus || '');
  const keywordReady = Boolean(metadata.keywordSearchAvailable);
  const vectorReady = Boolean(metadata.vectorSearchAvailable);
  const isMediaAsset = Boolean(metadata.mediaType);
  const processingStage = String(metadata.processingStage || '');

  if (document.isReady) {
    return {
      state: 'ready' as const,
      phase: 'ready' as const,
      helper: 'Ready for grounded chat and retrieval.',
    };
  }

  if (processingStage === 'syncing_knowledge') {
    return {
      state: 'syncing' as const,
      phase: 'syncing_knowledge' as const,
      helper: 'Media insights are ready. ATRISI is packaging timeline-aware Knowledge Artifacts for retrieval.',
    };
  }

  if (processingStage === 'generating_embeddings') {
    return {
      state: 'syncing' as const,
      phase: 'generating_embeddings' as const,
      helper: 'Knowledge Artifacts are ready. ATRISI is generating embeddings so vector retrieval becomes available.',
    };
  }

  if ((keywordReady && !vectorReady) || indexingStatus === 'queued' || indexingStatus === 'running') {
    return {
      state: 'syncing' as const,
      phase: 'syncing_vector' as const,
      helper: isMediaAsset
        ? 'Media insights are ready. Knowledge is still finishing vector sync for stronger retrieval.'
        : 'Keyword access may be available, but vector retrieval is still syncing.',
    };
  }

  if (document.isProcessing) {
    return {
      state: 'processing' as const,
      phase: 'processing' as const,
      helper: 'Still processing. This asset becomes selectable once retrieval is ready.',
    };
  }

  return {
    state: 'unready' as const,
    phase: 'unready' as const,
    helper: 'This document is not currently usable for grounded chat.',
  };
}

export function RAGSearchPage({ className = '', onUpgrade }: RAGSearchPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const [dragOver, setDragOver] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DocumentFilter>('all');
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const { workspaceMode, getRoleConfig, limits, backendRole, subscriptionTier } = useUserRole();
  const navigate = useNavigate();
  const locationState = (location.state || {}) as RAGSearchLocationState;

  const handleMigrateToStorage = async (documentId: string) => {
    try {
      await apiClient.post(API_ENDPOINTS.files.migrateStorage(documentId), {});
      showSuccess('File moved to object storage');
      await refetch();
    } catch {
      showError('Failed to migrate file to object storage');
    }
  };

  const handleViewMediaAnalysis = (doc: { id: string }) => {
    navigate(`/studio/media-ai/${doc.id}`);
  };

  const {
    documents,
    isLoading,
    error,
    refetch,
    uploadMultiple,
    deleteDocument,
    reindex,
    isUploading,
    isDeleting,
  } = useDocuments();

  const workspaceConfig = getRoleConfig();

  const processedDocuments = useMemo(() => documents.filter((doc) => doc.isReady), [documents]);
  const processingDocuments = useMemo(
    () => documents.filter((doc) => {
      const readiness = getKnowledgeReadiness(doc);
      return readiness.state === 'processing' || readiness.state === 'syncing';
    }),
    [documents],
  );
  const failedDocuments = useMemo(() => documents.filter((doc) => doc.hasFailed), [documents]);
  const syncingDocuments = useMemo(
    () => documents.filter((doc) => getKnowledgeReadiness(doc).state === 'syncing'),
    [documents],
  );
  const syncingKnowledgeDocuments = useMemo(
    () => documents.filter((doc) => getKnowledgeReadiness(doc).phase === 'syncing_knowledge'),
    [documents],
  );
  const embeddingDocuments = useMemo(
    () => documents.filter((doc) => getKnowledgeReadiness(doc).phase === 'generating_embeddings'),
    [documents],
  );
  const activeProcessingDocuments = useMemo(
    () => documents.filter((doc) => getKnowledgeReadiness(doc).state === 'processing'),
    [documents],
  );
  const remainingFileCapacity =
    typeof limits?.maxFiles === 'number' && limits.maxFiles > 0
      ? Math.max(limits.maxFiles - documents.length, 0)
      : null;

  useEffect(() => {
    if (processedDocuments.length > 0 && selectedDocumentIds.length === 0) {
      setSelectedDocumentIds(processedDocuments.map((doc) => doc.id));
    }
  }, [processedDocuments, selectedDocumentIds.length]);

  useEffect(() => {
    const requestedIds = locationState.selectedDocumentIds;
    if (!requestedIds || requestedIds.length === 0 || documents.length === 0) {
      return;
    }

    const readyDocumentIds = new Set(processedDocuments.map((document) => document.id));
    const matchingIds = requestedIds.filter((documentId) => readyDocumentIds.has(documentId));

    if (matchingIds.length > 0) {
      setSelectedDocumentIds(matchingIds);
    }
  }, [documents.length, locationState.selectedDocumentIds, processedDocuments]);

  useEffect(() => {
    if (processingDocuments.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      refetch();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [processingDocuments.length, refetch]);

  const filteredDocuments = useMemo(() => {
    switch (activeFilter) {
      case 'ready':
        return processedDocuments;
      case 'processing':
        return processingDocuments;
      case 'failed':
        return failedDocuments;
      case 'selected':
        return documents.filter((document) => selectedDocumentIds.includes(document.id));
      case 'all':
      default:
        return documents;
    }
  }, [activeFilter, documents, failedDocuments, processedDocuments, processingDocuments, selectedDocumentIds]);

  const effectiveDocumentIds =
    selectedDocumentIds.length > 0 ? selectedDocumentIds : processedDocuments.map((doc) => doc.id);
  const effectiveDocuments =
    selectedDocumentIds.length > 0
      ? documents.filter((doc) => selectedDocumentIds.includes(doc.id))
      : processedDocuments;

  const handleFiles = async (files: FileList | null) => {
    const fileArray = Array.from(files || []);
    if (fileArray.length === 0) {
      return;
    }

    await uploadMultiple(fileArray);
    await refetch();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectAllReady = () => {
    setSelectedDocumentIds(processedDocuments.map((document) => document.id));
    showSuccess('Selected all ready documents');
  };

  const handleClearSelection = () => {
    setSelectedDocumentIds([]);
  };

  const handleReindexDocument = async (documentId: string) => {
    try {
      setBusyDocumentId(documentId);
      reindex(documentId);
      showSuccess('Reprocessing requested. Refresh shortly to see updated status.');
      await refetch();
    } catch {
      showError('Failed to reprocess document');
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleDeleteDocument = async (documentId: string, displayName: string) => {
    if (!confirm(`Delete "${displayName}" from the knowledge base?`)) {
      return;
    }

    try {
      setBusyDocumentId(documentId);
      deleteDocument(documentId);
      setSelectedDocumentIds((current) => current.filter((id) => id !== documentId));
      await refetch();
    } catch {
      showError('Failed to delete document');
    } finally {
      setBusyDocumentId(null);
    }
  };

  const filterChips = [
    { id: 'all' as const, label: `All (${documents.length})` },
    { id: 'ready' as const, label: `Ready (${processedDocuments.length})` },
    { id: 'processing' as const, label: `Indexing (${processingDocuments.length})` },
    { id: 'failed' as const, label: `Failed (${failedDocuments.length})` },
    { id: 'selected' as const, label: `Selected (${selectedDocumentIds.length})` },
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white ${className}`}>
      <div className="workspace-shell flex flex-col gap-4 px-0 py-4 sm:gap-6 sm:py-6">
        <section className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-lg shadow-blue-100 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-joa-primary sm:text-sm">
                <Search className="h-4 w-4" />
                {PRODUCT_LABELS.knowledge}
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
                Upload documents, control what retrieval sees, and recover from failures clearly.
              </h1>
              <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base sm:leading-7 lg:text-lg">
                This page now gives you better document control before chat begins: filter by readiness,
                choose exactly which files power retrieval, and act on indexing failures without leaving the flow.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${workspaceConfig.bgColor} ${workspaceConfig.textColor}`}>
                  {workspaceConfig.icon} {workspaceConfig.name}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                  Role: {backendRole}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                  Plan: {subscriptionTier}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm min-[420px]:grid-cols-3">
              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
                <div className="text-xl font-semibold sm:text-2xl">{documents.length}</div>
                <div className="text-slate-300">Total</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
                <div className="text-xl font-semibold sm:text-2xl">{processedDocuments.length}</div>
                <div className="text-emerald-700">Ready</div>
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-900">
                <div className="text-xl font-semibold sm:text-2xl">{processingDocuments.length}</div>
                <div className="text-amber-700">Indexing</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr] workspace-split-balanced">
          <div className="space-y-6">
            {error ? (
              <div className="rounded-3xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 text-red-600" />
                  <div>
                    <h2 className="text-base font-semibold text-red-900">Knowledge load failed</h2>
                    <p className="mt-1 text-sm leading-6 text-red-800">
                      We could not load your documents. Refresh this page or reopen the workspace after the API recovers.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {subscriptionTier === 'free' && (
              <div className="rounded-3xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold text-amber-900">Uploaded files are not persisted on the free plan</p>
                      <p className="mt-0.5 text-sm text-amber-800">
                        Documents are processed for search during this session but the originals are not stored. They will need to be re-uploaded next time. Upgrade to Pro to retain files permanently in the cloud.
                      </p>
                    </div>
                  </div>
                  {onUpgrade && (
                    <button
                      onClick={onUpgrade}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                    >
                      <CreditCard className="h-4 w-4" />
                      Upgrade to Pro
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Step 1: Add knowledge</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Upload one or more files. We will keep polling until indexing completes.
                  </p>
                </div>
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <span className="font-medium">Workspace guidance:</span>
                <span>{workspaceConfig.description}</span>
                {limits ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-blue-800">
                    File capacity: {documents.length}/{limits.maxFiles}
                  </span>
                ) : null}
                {remainingFileCapacity !== null ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-blue-800">
                    {remainingFileCapacity} slot{remainingFileCapacity === 1 ? '' : 's'} remaining
                  </span>
                ) : null}
                {limits?.maxStorageMB ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-blue-800">
                    Storage limit: {limits.maxStorageMB} MB
                  </span>
                ) : null}
              </div>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  void handleFiles(event.dataTransfer.files);
                }}
                className={`rounded-2xl border-2 border-dashed p-5 text-center transition sm:p-8 ${
                  dragOver
                    ? 'border-joa-primary bg-teal-50'
                    : 'border-gray-300 bg-gradient-to-br from-gray-50 to-white'
                }`}
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-joa-primary">
                  {isUploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isUploading ? 'Uploading documents...' : 'Drop files here or browse'}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  PDF, DOCX, text, markdown, CSV, code, JSON, YAML, and common image formats are supported. Backend processing warnings will appear automatically when a format is limited.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-joa-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-800"
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4" />
                  Choose Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(event) => void handleFiles(event.target.files)}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Step 2: Control document readiness</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Filter, select, retry, or remove documents before they shape retrieval.
                  </p>
                </div>
                {processingDocuments.length > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                    <Clock3 className="h-4 w-4" />
                    Indexing in progress
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {filterChips.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      activeFilter === filter.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  onClick={handleSelectAllReady}
                  disabled={processedDocuments.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <CheckCheck className="h-4 w-4" />
                  Select all ready
                </button>
                <button
                  onClick={handleClearSelection}
                  disabled={selectedDocumentIds.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <X className="h-4 w-4" />
                  Clear selection
                </button>
                <div className="text-sm text-gray-600 sm:ml-auto">
                  {selectedDocumentIds.length > 0
                    ? `${selectedDocumentIds.length} selected for chat context`
                    : `${processedDocuments.length} ready document${processedDocuments.length === 1 ? '' : 's'} available`}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {isLoading ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    Loading documents...
                  </div>
                ) : documents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No documents yet. Upload one to begin.
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No documents match this filter yet.
                  </div>
                ) : (
                  filteredDocuments.map((document) => (
                    <KnowledgeDocumentCard
                      key={document.id}
                      document={document}
                      selected={selectedDocumentIds.includes(document.id)}
                      selectable={document.isReady}
                      onToggleSelected={(documentId) =>
                        setSelectedDocumentIds((current) =>
                          current.includes(documentId)
                            ? current.filter((id) => id !== documentId)
                            : [...current, documentId]
                        )
                      }
                      actions={
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          {document.storageProvider === 'volume' && (
                            <button
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleMigrateToStorage(document.id);
                              }}
                              disabled={busyDocumentId === document.id}
                              title="Move to object storage"
                              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 sm:w-auto"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Move to Storage
                            </button>
                          )}
                          {(document.mimeType?.startsWith('video/') || document.mimeType?.startsWith('audio/')) && (
                            <button
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleViewMediaAnalysis(document);
                              }}
                              disabled={busyDocumentId === document.id}
                              title="View analysis"
                              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2 text-xs font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50 sm:w-auto"
                            >
                              <Film className="h-3.5 w-3.5" />
                              View analysis
                            </button>
                          )}
                          {!document.isReady && !document.isProcessing ? (
                            <button
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleReindexDocument(document.id);
                              }}
                              disabled={busyDocumentId === document.id}
                              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
                            >
                              <Wand2 className="h-3.5 w-3.5" />
                              Retry
                            </button>
                          ) : null}
                          <button
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void handleDeleteDocument(document.id, document.displayName);
                            }}
                            disabled={busyDocumentId === document.id || isDeleting}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-2 text-xs font-medium text-red-700 transition hover:bg-teal-100 disabled:opacity-50 sm:w-auto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      }
                    >
                      {!document.isReady ? (
                        <p className="mt-2 text-xs text-gray-500">
                          {getKnowledgeReadiness(document).helper}
                        </p>
                      ) : null}
                    </KnowledgeDocumentCard>
                  ))
                )}
              </div>

              {selectedDocumentIds.length === 0 && processedDocuments.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  No documents are selected right now, so chat will use all ready documents by default.
                </div>
              ) : null}

              {failedDocuments.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-red-900">
                        {failedDocuments.length} document{failedDocuments.length === 1 ? '' : 's'} need attention
                      </p>
                      <div className="mt-2 space-y-2">
                        {failedDocuments.slice(0, 3).map((document) => (
                          <div key={document.id} className="rounded-xl bg-white/70 px-3 py-2 text-sm text-red-800">
                            <span className="font-medium">{document.displayName}</span>
                            {document.processingError ? ` — ${document.processingError}` : ' — Processing failed'}
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-sm text-red-700">
                        Retry indexing for individual documents or remove files that are no longer relevant.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {processingDocuments.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {activeProcessingDocuments.length > 0 ? (
                    <p>
                      {activeProcessingDocuments.length} document{activeProcessingDocuments.length === 1 ? '' : 's'} are still processing.
                      Staying on this page will keep refreshing readiness automatically every 5 seconds.
                    </p>
                  ) : null}
                  {syncingDocuments.length > 0 ? (
                    <p className={activeProcessingDocuments.length > 0 ? 'mt-2' : ''}>
                      {syncingKnowledgeDocuments.length > 0
                        ? `${syncingKnowledgeDocuments.length} asset${syncingKnowledgeDocuments.length === 1 ? '' : 's'} are syncing media results back into Knowledge.`
                        : ''}
                      {syncingKnowledgeDocuments.length > 0 && embeddingDocuments.length > 0 ? ' ' : ''}
                      {embeddingDocuments.length > 0
                        ? `${embeddingDocuments.length} asset${embeddingDocuments.length === 1 ? '' : 's'} are generating embeddings for vector retrieval.`
                        : syncingDocuments.length > syncingKnowledgeDocuments.length
                          ? `${syncingDocuments.length - syncingKnowledgeDocuments.length} asset${syncingDocuments.length - syncingKnowledgeDocuments.length === 1 ? '' : 's'} are finishing vector sync.`
                          : ''}
                      {' '}Keyword access may already be available.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm sm:p-6">
              <h2 className="text-xl font-semibold text-gray-900">Step 3: Ask and verify</h2>
              <p className="mt-1 text-sm text-gray-600">
                Use selected ready documents in chat. If nothing is ready yet, stay on this page and
                wait for indexing to complete.
              </p>
            </div>

            {processedDocuments.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center shadow-sm">
                <Clock3 className="mx-auto h-12 w-12 text-amber-600" />
                <h3 className="mt-4 text-xl font-semibold text-amber-900">Chat unlocks when indexing finishes</h3>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  Upload a document or wait for at least one current document to reach the ready
                  state. Asking too early leads to weak retrieval and confusing answers.
                </p>
              </div>
            ) : effectiveDocumentIds.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-blue-300 bg-blue-50 p-8 text-center shadow-sm">
                <Search className="mx-auto h-12 w-12 text-blue-600" />
                <h3 className="mt-4 text-xl font-semibold text-blue-900">Choose the documents to use</h3>
                <p className="mt-2 text-sm leading-6 text-blue-800">
                  Select one or more ready documents on the left. That gives you tighter control over retrieval quality and source relevance.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-gray-700">Chat will use:</div>
                    {effectiveDocumentIds.slice(0, 4).map((documentId) => {
                      const document = documents.find((item) => item.id === documentId);
                      return (
                        <span
                          key={documentId}
                          className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                        >
                          {document?.displayName || 'Document'}
                        </span>
                      );
                    })}
                    {effectiveDocumentIds.length > 4 ? (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                        +{effectiveDocumentIds.length - 4} more
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-[460px] rounded-3xl border border-gray-200 bg-white/80 shadow-lg sm:min-h-[520px] lg:h-[calc(100vh-260px)] lg:min-h-[560px]">
                  <RAGChatInterface className="h-full rounded-3xl" documentIds={effectiveDocumentIds} documents={effectiveDocuments} />
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
