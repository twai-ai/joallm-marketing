import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, ExternalLink, FileAudio, FileVideo, Loader2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { UseCaseAssetShell } from '../components/use-cases/UseCaseAssetShell';
import { MediaStatusPanel } from '../components/workflow/MediaStatusPanel';
import { getUseCaseById } from '../constants/useCases';
import { DEFAULT_MEDIA_INTELLIGENCE_MODE, getMediaIntelligenceModeLabel, getSuggestedMediaIntelligenceMode, MEDIA_INTELLIGENCE_MODES, type MediaIntelligenceMode } from '../constants/mediaIntelligenceModes';
import { useDocuments } from '../hooks/useDocuments';
import { API_ENDPOINTS } from '../config/api';
import { apiClient } from '../utils/api-client';
import { showError } from '../utils/toast';
import { showSuccess } from '../utils/toast';

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const order = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** order;
  return `${value.toFixed(value >= 10 || order === 0 ? 0 : 1)} ${units[order]}`;
}

function formatDuration(seconds?: number): string {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) return 'Unknown duration';

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatMediaTypeLabel(mediaType?: string): string {
  if (!mediaType) return 'Media file';
  return mediaType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

type ProcessingStage =
  | 'uploaded'
  | 'metadata_extracted'
  | 'transcribed'
  | 'analyzing_frames'
  | 'building_timeline'
  | 'generating_insights'
  | 'synthesizing_results'
  | 'packaging_insights'
  | 'syncing_knowledge'
  | 'generating_embeddings'
  | 'insights_ready';

interface FileStatusResponse {
  id: string;
  filename?: string;
  originalName?: string;
  status: string;
  processingStage?: ProcessingStage;
  error?: string;
}

export function MediaAssetPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { documents, isLoading, refetch } = useDocuments();
  const [isLaunchingAnalysis, setIsLaunchingAnalysis] = useState(false);
  const [liveFileStatus, setLiveFileStatus] = useState<string | undefined>(undefined);
  const [liveProcessingStage, setLiveProcessingStage] = useState<ProcessingStage | undefined>(undefined);
  const useCase = getUseCaseById('media');

  const document = useMemo(
    () => documents.find((item) => item.id === fileId) ?? null,
    [documents, fileId],
  );

  const metadata = document?.backend?.metadata as Record<string, unknown> | undefined;
  const mediaType = typeof metadata?.mediaType === 'string' ? metadata.mediaType : document?.mimeType;
  const durationSeconds = typeof metadata?.duration === 'number' ? metadata.duration : undefined;
  const processingStage = typeof metadata?.processingStage === 'string' ? metadata.processingStage : undefined;
  const metadataMode = typeof metadata?.intelligenceMode === 'string' ? metadata.intelligenceMode : undefined;
  const searchMode = searchParams.get('intelligenceMode');
  const selectedMode = (searchMode || metadataMode || DEFAULT_MEDIA_INTELLIGENCE_MODE) as MediaIntelligenceMode;
  const suggestedMode = getSuggestedMediaIntelligenceMode(typeof metadata?.mediaType === 'string' ? metadata.mediaType : undefined);
  const suggestedModeIsDifferent = Boolean(suggestedMode && suggestedMode.mode !== selectedMode);
  const uploadedAt = document?.uploadedAt ? new Date(document.uploadedAt) : null;
  const MediaIcon = document?.mimeType?.startsWith('audio/') ? FileAudio : FileVideo;
  const effectiveFileStatus = liveFileStatus || document?.backend?.status;
  const effectiveProcessingStage = liveProcessingStage || (processingStage as ProcessingStage | undefined);
  const isAnalysisRunning = isLaunchingAnalysis || effectiveFileStatus === 'processing';

  useEffect(() => {
    setLiveFileStatus(document?.backend?.status);
  }, [document?.backend?.status]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;

    const loadStatus = async () => {
      if (!document) return;

      try {
        const data = await apiClient.get<FileStatusResponse>(API_ENDPOINTS.files.status(document.id));
        if (cancelled) return;

        setLiveFileStatus(data.status);
        setLiveProcessingStage(data.processingStage);

        if (data.status === 'processing') {
          pollTimer = window.setTimeout(loadStatus, 3000);
        }
      } catch {
        if (!cancelled) {
          setLiveFileStatus(document?.backend?.status);
          setLiveProcessingStage(processingStage as ProcessingStage | undefined);
        }
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [document, processingStage]);

  const handleRunSelectedMode = async () => {
    if (!document || isAnalysisRunning) return;

    try {
      setIsLaunchingAnalysis(true);
      await apiClient.post(API_ENDPOINTS.files.analyzeMedia(document.id), {
        intelligenceMode: selectedMode,
      });
      setLiveFileStatus('processing');
      await refetch();
      showSuccess(`Started ${getMediaIntelligenceModeLabel(selectedMode)} analysis for "${document.displayName}".`);
    } catch (error: any) {
      showError(error?.message || error?.error || 'Failed to start the selected media analysis');
    } finally {
      setIsLaunchingAnalysis(false);
    }
  };

  if (!fileId || !useCase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-white">
        <div className="workspace-shell px-0 py-6">
          <div className="rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Media file not found</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The link is missing a file identifier. Return to the Media AI library and open a file from there.
            </p>
            <button
              onClick={() => navigate('/studio/media-ai')}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to Media AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-white">
        <div className="workspace-shell px-0 py-6">
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 shadow-sm">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading media details…
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-white">
        <div className="workspace-shell px-0 py-6">
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">This media file is not in your library</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              It may have been removed, or the page loaded before your library refreshed. Return to Media AI and choose a file from the library.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <UseCaseAssetShell
      useCase={useCase}
      onBack={() => navigate(useCase.homeRoute)}
      badge={
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
          <MediaIcon className="h-4 w-4" />
          {formatMediaTypeLabel(mediaType)}
        </div>
      }
      title={document.displayName}
      description="Review processing progress, transcript coverage, and structured insights for this media file from one place. Choose the intelligence lens you want and run analysis directly on this asset."
      primaryAction={
        <button
          onClick={() => void handleRunSelectedMode()}
          disabled={isAnalysisRunning}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isAnalysisRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          {isLaunchingAnalysis
            ? 'Starting analysis…'
            : isAnalysisRunning
              ? 'Analysis in progress'
              : 'Run Selected Mode'}
        </button>
      }
      summaryCards={
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {effectiveFileStatus === 'completed' || document.isReady
                ? 'Ready'
                : effectiveFileStatus === 'processing' || isAnalysisRunning
                  ? 'Processing'
                  : document.hasFailed
                    ? 'Needs attention'
                    : 'Uploaded'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {effectiveProcessingStage ? effectiveProcessingStage.replace(/_/g, ' ') : 'Media analysis state'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatDuration(durationSeconds)}</p>
            <p className="mt-1 text-sm text-slate-500">Based on extracted media metadata</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">File size</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatBytes(document.size)}</p>
            <p className="mt-1 text-sm text-slate-500">Original uploaded asset</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Intelligence mode</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{getMediaIntelligenceModeLabel(selectedMode)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {suggestedModeIsDifferent
                ? `${getMediaIntelligenceModeLabel(suggestedMode?.mode)} is recommended for this asset type.`
                : isAnalysisRunning
                  ? 'Current run is using the active mode until processing completes.'
                  : 'Used for the next analysis run you launch from this asset.'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {uploadedAt ? uploadedAt.toLocaleDateString() : 'Unknown'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {uploadedAt ? uploadedAt.toLocaleTimeString() : 'Upload time unavailable'}
            </p>
          </div>
        </>
      }
      sidePanelTitle="Media-first by default"
      sidePanelBody="This page keeps the experience focused on progress and results. Choose the intelligence lens you want, then run analysis directly on this asset without consuming a workflow slot."
      sidePanelContent={
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Clock3 className="h-4 w-4 text-emerald-300" />
              Intelligence mode
            </div>
            {suggestedModeIsDifferent && (
              <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Suggested mode</p>
                <p className="mt-1 text-sm font-semibold text-white">{getMediaIntelligenceModeLabel(suggestedMode?.mode)}</p>
                <p className="mt-1 text-xs leading-5 text-emerald-100">{suggestedMode?.reason}</p>
                <button
                  onClick={() => {
                    if (!suggestedMode) return;
                    const next = new URLSearchParams(searchParams);
                    next.set('intelligenceMode', suggestedMode.mode);
                    setSearchParams(next, { replace: true });
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-300/20"
                >
                  Use Suggested Mode
                </button>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {MEDIA_INTELLIGENCE_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('intelligenceMode', mode.id);
                    setSearchParams(next, { replace: true });
                  }}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selectedMode === mode.id
                      ? 'border-emerald-300 bg-emerald-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-semibold">{mode.label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-300">{mode.description}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Clock3 className="h-4 w-4 text-emerald-300" />
              Best next step
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {isAnalysisRunning
                ? 'Analysis is already running for this asset. The selected mode will stay locked until processing completes.'
                : 'Stay here to monitor current results, or open a new run with the selected intelligence mode when you want a different lens on the same asset.'}
            </p>
          </div>
        </div>
      }
    >
      <section className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm overflow-hidden">
        <MediaStatusPanel
          fileId={document.id}
          processingStage={effectiveProcessingStage as any}
          filename={document.displayName}
          showExtendedResults
        />
      </section>
    </UseCaseAssetShell>
  );
}
