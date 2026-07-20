import React, { useMemo, useRef } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Film, Loader2, PlayCircle, Sparkles, Upload, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { KnowledgeDocumentCard } from '../components/entities/KnowledgeDocumentCard';
import { PRODUCT_LABELS } from '../constants/product';
import { getUseCaseById, USE_CASES } from '../constants/useCases';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { useDocuments } from '../hooks/useDocuments';
import { showError } from '../utils/toast';

const SUPPORTED_MEDIA_PREFIXES = ['video/', 'audio/'];

const PIPELINE_STEPS = [
  { title: 'Transcribe', description: 'We turn the source into timestamped transcript segments.' },
  { title: 'Break Into Sections', description: 'Long recordings are processed in timeline windows so analysis stays reliable.' },
  { title: 'Find Key Moments', description: 'The system ranks highlights, topics, and action items from the transcript.' },
  { title: 'Package Insights', description: 'You get chapter-aware summaries, key moments, and structured outputs.' },
];

export function MediaAIPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { documents, isLoading, uploadMultiple, isUploading, refetch } = useDocuments();
  const useCase = getUseCaseById('media');

  const mediaDocuments = useMemo(
    () =>
      documents.filter((document) => {
        const mimeType = document.mimeType || document.type || '';
        return SUPPORTED_MEDIA_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
      }),
    [documents],
  );

  const readyMediaDocuments = useMemo(
    () => mediaDocuments.filter((document) => document.isReady || document.isProcessing || document.status === 'uploaded'),
    [mediaDocuments],
  );

  const handleFiles = async (files: FileList | null) => {
    const fileArray = Array.from(files || []);
    if (fileArray.length === 0) return;

    try {
      await uploadMultiple(fileArray, true);
      await refetch();
    } catch {
      showError('Failed to upload media');
    }
  };

  const handleOpenAnalysis = (documentId: string) => {
    navigate(`/studio/media-ai/${documentId}`);
  };

  const studioWorkspaces = useMemo(
    () => USE_CASES.filter((candidate) => candidate.id !== 'media'),
    [],
  );

  if (!useCase) return null;

  return (
    <UseCaseHomeShell
      useCase={useCase}
      backHref="/studio"
      backLabel="Back to Studio"
      badge={
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
          <Film className="h-4 w-4" />
          {PRODUCT_LABELS.media}
        </div>
      }
      title="Analyze media in a guided flow, then move into Studio only when you need custom control."
      description="Media AI is now the front door for uploads, progress tracking, and insight review. The workspace stays focused on outcomes, so you no longer need to think in nodes just to get transcript-driven results."
      primaryAction={
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Upload className="h-4 w-4" />
            Upload Media
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*"
            multiple
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
          />
        </>
      }
      secondaryPanelTitle="Product-first for everyday use"
      secondaryPanelBody="Use Media AI for upload, progress, structured results, and export-ready outputs. The experience stays guided while we mature the reusable workflow layer behind the scenes."
      secondaryPanelContent={
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <PlayCircle className="h-4 w-4 text-emerald-300" />
              Best for Free / Pro
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Guided uploads, stage-based processing, and ready-to-review insights without canvas complexity.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Wand2 className="h-4 w-4 text-amber-300" />
              Best for this stage
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Keep the workflow vertical-specific for now, then generalize templates only once several AI workflow families are mature.
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
              Studio now includes more than Media AI. Jump between guided workspaces without leaving the Studio surface.
            </p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Media active
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-900 bg-slate-900 p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Film className="h-4 w-4 text-amber-300" />
              Media AI
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Upload recordings, follow media processing, and review structured intelligence outputs.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
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

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Recent Media</h2>
              <p className="mt-1 text-sm text-slate-600">
                Start from an uploaded file, then we create the media workflow for you behind the scenes.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <Clock3 className="h-3.5 w-3.5" />
              {readyMediaDocuments.length} media file{readyMediaDocuments.length === 1 ? '' : 's'} available
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading media library…
              </div>
            ) : readyMediaDocuments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Film className="h-6 w-6 text-slate-500" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No media uploaded yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Upload a video or audio file here. Media AI will handle the guided journey, and Studio stays available for custom flows.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <Upload className="h-4 w-4" />
                  Upload your first media file
                </button>
              </div>
            ) : (
              readyMediaDocuments.map((document) => (
                <KnowledgeDocumentCard
                  key={document.id}
                      document={document}
                      selectable={false}
                      actions={
                        <button
                          onClick={() => handleOpenAnalysis(document.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {document.isProcessing ? (
                            <Clock3 className="h-4 w-4" />
                          ) : document.isReady ? (
                            <ArrowRight className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {document.isReady ? 'Open Analysis' : document.isProcessing ? 'View Progress' : 'Prepare Analysis'}
                    </button>
                  }
                >
                  <p className="mt-2 text-xs text-slate-500">
                    {document.isReady
                      ? 'Ready for insight generation.'
                      : document.isProcessing
                      ? 'Processing in the background. Open the guided analysis view to track progress.'
                      : 'Uploaded and waiting for the analysis workflow to begin.'}
                  </p>
                </KnowledgeDocumentCard>
              ))
            )}
          </div>
      </section>
      {isUploading && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading media…
        </div>
      )}
    </UseCaseHomeShell>
  );
}
