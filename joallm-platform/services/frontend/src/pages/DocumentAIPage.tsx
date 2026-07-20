import React, { useMemo, useRef } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { KnowledgeDocumentCard } from '../components/entities/KnowledgeDocumentCard';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById, USE_CASES } from '../constants/useCases';
import { useDocuments } from '../hooks/useDocuments';
import { showError } from '../utils/toast';

const MEDIA_PREFIXES = ['video/', 'audio/'];
const MEDIA_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'aac',
  'flac',
  'ogg',
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'm4v',
]);

const PIPELINE_STEPS = [
  { title: 'Extract Text', description: 'We parse the uploaded files and normalize document text for downstream use.' },
  { title: 'Chunk Knowledge', description: 'Long documents are broken into retrieval-friendly sections with metadata.' },
  { title: 'Index For Search', description: 'Keyword and vector indexes are prepared so grounded chat can use the content.' },
  { title: 'Ask With Sources', description: 'You move into retrieval chat with documents that are ready to support citations.' },
];

function isMediaDocument(document: {
  mimeType?: string;
  type?: string;
  name?: string;
  filename?: string;
  originalName?: string;
}) {
  const mimeType = document.mimeType || document.type || '';
  if (MEDIA_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return true;
  }

  const displayName = document.name || document.filename || document.originalName || '';
  const extension = displayName.split('.').pop()?.toLowerCase();
  return extension ? MEDIA_EXTENSIONS.has(extension) : false;
}

export function DocumentAIPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { documents, isLoading, uploadMultiple, isUploading, refetch } = useDocuments();
  const useCase = getUseCaseById('docs-ai');

  const documentAssets = useMemo(
    () => documents.filter((document) => !isMediaDocument(document)),
    [documents],
  );

  const readyDocuments = useMemo(
    () => documentAssets.filter((document) => document.isReady),
    [documentAssets],
  );

  const activeDocuments = useMemo(
    () =>
      documentAssets.filter(
        (document) => document.isReady || document.isProcessing || document.status === 'uploaded' || document.hasFailed,
      ),
    [documentAssets],
  );

  const handleFiles = async (files: FileList | null) => {
    const fileArray = Array.from(files || []);
    if (fileArray.length === 0) return;

    try {
      await uploadMultiple(fileArray, true);
      await refetch();
    } catch {
      showError('Failed to upload documents');
    }
  };

  const handleOpenGroundedChat = (documentIds?: string[]) => {
    navigate('/rag-search', {
      state: documentIds && documentIds.length > 0 ? { selectedDocumentIds: documentIds } : undefined,
    });
  };

  const studioWorkspaces = useMemo(
    () => USE_CASES.filter((candidate) => candidate.id !== 'docs-ai'),
    [],
  );

  if (!useCase) return null;

  return (
    <UseCaseHomeShell
      useCase={useCase}
      backHref="/studio"
      backLabel="Back to Studio"
      badge={
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
          <FileText className="h-4 w-4" />
          Document AI
        </div>
      }
      title="Turn PDFs, docs, sheets, and notes into retrieval-ready knowledge without detouring through a generic upload flow."
      description="Document AI gives teams a guided front door for document ingestion, readiness tracking, and grounded Q&A. Upload here, watch indexing progress, then move into retrieval chat with the right sources already in focus."
      primaryAction={
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Upload className="h-4 w-4" />
            Upload Documents
          </button>
          <button
            onClick={() => handleOpenGroundedChat(readyDocuments.map((document) => document.id))}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Search className="h-4 w-4" />
            Open Grounded Chat
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.markdown,.rtf,.csv,.tsv,.json,.yaml,.yml,.xml,.html,.htm,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif"
            multiple
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
          />
        </>
      }
      secondaryPanelTitle="Guided for document-heavy teams"
      secondaryPanelBody="Keep ingestion, indexing state, and Knowledge readiness in one focused Studio. The custom canvas stays available for advanced orchestration, but everyday document work starts here."
      secondaryPanelContent={
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Search className="h-4 w-4 text-sky-300" />
              Best for grounded answers
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Push clean, ready documents into retrieval chat instead of relying on broad workspace defaults.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Best for this stage
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Give each Studio workspace its own product-shaped entry point, then reuse Platform infrastructure underneath.
            </p>
          </div>
        </>
      }
    >
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Studio Workspaces</h2>
            <p className="mt-1 text-sm text-slate-600">
              Move between guided Studio workspaces from here instead of treating Document AI like a hidden side route.
            </p>
          </div>
          <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
            Document AI active
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-600 p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-blue-100" />
              Document AI
            </div>
            <p className="mt-3 text-sm leading-6 text-blue-100">
              Ingest files, watch readiness, and move straight into grounded retrieval with the right source set.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-blue-50">
              Current workspace
            </div>
          </div>

          {studioWorkspaces.map((workspace) => (
            <div key={workspace.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{workspace.label}</h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{workspace.status}</p>
                </div>
                <div className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                  {workspace.shortLabel}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{workspace.description}</p>
              <button
                onClick={workspace.status === 'active' ? () => navigate(workspace.homeRoute) : undefined}
                disabled={workspace.status !== 'active'}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {workspace.status === 'active' ? 'Open Workspace' : 'Preview Workspace'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Recent Documents</h2>
              <p className="mt-1 text-sm text-slate-600">
                Start from a document set, then move into retrieval once indexing is ready.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <Clock3 className="h-3.5 w-3.5" />
              {readyDocuments.length} ready document{readyDocuments.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading document library...
              </div>
            ) : activeDocuments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <FileText className="h-6 w-6 text-slate-500" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No documents uploaded yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Upload PDFs, docs, spreadsheets, or notes here. Once indexing finishes, grounded chat will use them with source-aware retrieval.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <Upload className="h-4 w-4" />
                  Upload your first document
                </button>
              </div>
            ) : (
              activeDocuments.map((document) => (
                <KnowledgeDocumentCard
                  key={document.id}
                  document={document}
                  selectable={false}
                  actions={
                    <button
                      onClick={() => handleOpenGroundedChat(document.isReady ? [document.id] : undefined)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {document.isProcessing ? (
                        <Clock3 className="h-4 w-4" />
                      ) : document.isReady ? (
                        <ArrowRight className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {document.isReady ? 'Open In Chat' : document.isProcessing ? 'View Readiness' : 'Review In Workspace'}
                    </button>
                  }
                >
                  <p className="mt-2 text-xs text-slate-500">
                    {document.isReady
                      ? 'Ready for grounded retrieval and source-aware answers.'
                      : document.isProcessing
                        ? 'Indexing is still running. Open the knowledge workspace to monitor readiness.'
                        : document.hasFailed
                          ? 'Processing needs attention. Open the knowledge workspace to retry or remove this file.'
                          : 'Uploaded and waiting for indexing to begin.'}
                  </p>
                </KnowledgeDocumentCard>
              ))
            )}
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">How Document AI Works</h2>
              <p className="mt-1 text-sm text-slate-600">
                The workflow stays focused on retrieval quality, not builder complexity.
              </p>
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              Guided flow
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {PIPELINE_STEPS.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      {isUploading && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading documents...
        </div>
      )}
    </UseCaseHomeShell>
  );
}
