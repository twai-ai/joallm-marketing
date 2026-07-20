import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Mic, Sparkles, ChevronDown, ChevronRight, Download, Tags, BarChart3, Clapperboard, ExternalLink, Copy } from 'lucide-react';
import { apiClient } from '../../utils/api-client';
import { API_ENDPOINTS } from '../../config/api';
import { cx, workspaceSectionLabel, workspacePanelMuted } from '../workspace/workspaceTheme';
import { DEFAULT_MEDIA_INTELLIGENCE_MODE, getMediaIntelligenceModeLabel, getMediaIntelligenceResultsProfile, type MediaIntelligenceMode } from '../../constants/mediaIntelligenceModes';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
  confidence?: number;
  sequenceIndex: number;
}

interface MediaInsight {
  id: string;
  insightType: 'highlight' | 'summary' | 'key_moment' | 'topic' | 'action_item';
  title: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  score?: number;
  tags: string[];
}

interface MediaStatusPanelProps {
  fileId: string;
  processingStage?: ProcessingStage;
  filename?: string;
  showExtendedResults?: boolean;
}

interface FileStatusResponse {
  id: string;
  filename?: string;
  originalName?: string;
  status: string;
  processingStage?: ProcessingStage;
  error?: string;
}

interface MediaStatusCacheEntry {
  segments: TranscriptSegment[];
  insights: MediaInsight[];
  mediaResults?: MediaResultsResponse;
  resolvedStage?: ProcessingStage;
  resolvedFilename?: string;
  fileStatus?: string;
  transcriptOpen: boolean;
  insightsOpen: boolean;
  createdClips?: Record<string, CreatedClip>;
}

interface MediaChapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  summary: string;
  topics: string[];
  visualHighlights: string[];
  notableQuotes: Array<{
    id: string;
    text: string;
    startTime: number;
    endTime: number;
    speaker?: string;
  }>;
  keyMoment?: {
    title: string;
    description?: string;
    startTime?: number;
    endTime?: number;
    score?: number;
  } | null;
}

interface MediaMoment {
  id: string;
  rank: number;
  type: string;
  title: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  confidence: number;
  whyItMatters: string;
  tags: string[];
}

interface MediaClipSuggestion {
  id: string;
  rank: number;
  title: string;
  hook: string;
  startTime: number;
  endTime: number;
  duration: number;
  whyItWorks: string;
  confidence: number;
  tags: string[];
}

interface MediaResultsResponse {
  overview: {
    mediaType: 'podcast' | 'interview' | 'meeting' | 'video_call' | 'webinar' | 'tutorial' | 'presentation' | 'general_video';
    intelligenceMode?: string;
    summary: {
      title: string;
      description?: string;
      tags: string[];
    } | null;
    durationSec: number;
    chapterCount: number;
    keyMomentCount: number;
    clipSuggestionCount: number;
    topicCount: number;
    actionItemCount: number;
    frameAnalysisCount: number;
  };
  chapters: MediaChapter[];
  moments: MediaMoment[];
  clipSuggestions: MediaClipSuggestion[];
  topics: Array<{ id: string; rank: number; title: string; description?: string; tags: string[]; startTime?: number; endTime?: number }>;
  actionItems: Array<{ id: string; rank: number; title: string; description?: string; tags: string[]; startTime?: number; endTime?: number }>;
  frameAnalyses: Array<{
    id: string;
    timestampSec: number;
    description: string;
    objects: string[];
    detectedText: string | null;
    confidence: number | null;
  }>;
  knowledgeSync?: {
    indexingStatus: string;
    keywordSearchAvailable: boolean;
    vectorSearchAvailable: boolean;
    syncedAt: string | null;
  };
}

interface CreatedClip {
  renderOutputId: string;
  title: string;
  downloadUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatMediaTypeLabel(mediaType: MediaResultsResponse['overview']['mediaType']): string {
  switch (mediaType) {
    case 'video_call':
      return 'Video call';
    case 'general_video':
      return 'General video';
    default:
      return mediaType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function pickByKeywords<T>(
  items: T[],
  extractText: (item: T) => string,
  patterns: RegExp[],
  fallbackCount: number,
): T[] {
  const matched = items.filter((item) => patterns.some((pattern) => pattern.test(extractText(item))));
  return matched.length > 0 ? matched : items.slice(0, fallbackCount);
}

function textFromInsightLike(item: { title?: string; description?: string; tags?: string[] }): string {
  return `${item.title || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string | number | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

const STAGE_ORDER: ProcessingStage[] = [
  'uploaded',
  'metadata_extracted',
  'transcribed',
  'analyzing_frames',
  'building_timeline',
  'generating_insights',
  'synthesizing_results',
  'packaging_insights',
  'syncing_knowledge',
  'generating_embeddings',
  'insights_ready',
];

const STAGE_LABELS: Record<ProcessingStage, string> = {
  uploaded: 'File received',
  metadata_extracted: 'Media prepared',
  transcribed: 'Transcript ready',
  analyzing_frames: 'Analysing frames',
  building_timeline: 'Building timeline',
  generating_insights: 'Generating insights',
  synthesizing_results: 'Synthesizing results',
  packaging_insights: 'Packaging insights',
  insights_ready: 'Insights ready',
  syncing_knowledge: 'Syncing to Knowledge',
  generating_embeddings: 'Generating embeddings',
};

const STAGE_HINTS: Record<ProcessingStage, string> = {
  uploaded: 'We have the file and are starting the ingest and preprocessing steps for media analysis.',
  metadata_extracted: 'Audio, timing metadata, and media preparation steps are being completed before deeper analysis.',
  transcribed: 'Speech-to-text is complete. Frame extraction is next.',
  analyzing_frames: 'Vision model is analysing video frames for on-screen context.',
  building_timeline: 'Merging transcript, frame evidence, and preprocessing signals into a combined timeline for inference.',
  generating_insights: 'Running the intelligence model over timeline batches to extract summaries, moments, and actions.',
  synthesizing_results: 'Consolidating chunk-level outputs into one final mode-aware result for the whole asset.',
  packaging_insights: 'Saving insights, building knowledge chunks, and preparing the final review payload.',
  insights_ready: 'Transcript, visual analysis, and postprocessed AI takeaways are ready to review.',
  syncing_knowledge: 'Preparing timeline-aware knowledge chunks so this media can participate in Knowledge and RAG.',
  generating_embeddings: 'Creating vector embeddings for the Knowledge chunks so retrieval becomes stronger and faster.',
};

const ACTIVE_BACKGROUND_STAGES = new Set<ProcessingStage>([
  'uploaded',
  'metadata_extracted',
  'transcribed',
  'analyzing_frames',
  'building_timeline',
  'generating_insights',
  'synthesizing_results',
  'packaging_insights',
  'syncing_knowledge',
  'generating_embeddings',
]);

const PRE_INSIGHT_STAGES = new Set<ProcessingStage>([
  'uploaded',
  'metadata_extracted',
  'transcribed',
  'analyzing_frames',
  'building_timeline',
  'generating_insights',
  'synthesizing_results',
  'packaging_insights',
]);

function stageIndex(stage?: ProcessingStage): number {
  if (!stage) return 0;
  return STAGE_ORDER.indexOf(stage);
}

function shouldPollFileStatus(status?: string, stage?: ProcessingStage): boolean {
  if (status === 'processing' || status === 'uploaded') {
    return true;
  }

  if (stage === 'syncing_knowledge' || stage === 'generating_embeddings') {
    return true;
  }

  return false;
}

function resolveDisplayStage(status?: string, stage?: ProcessingStage): ProcessingStage | undefined {
  if (!stage) {
    return status === 'processed' ? 'insights_ready' : undefined;
  }

  if (status !== 'processing' && PRE_INSIGHT_STAGES.has(stage)) {
    return 'insights_ready';
  }

  return stage;
}

function shouldRefreshKnowledgeSync(stage?: ProcessingStage, mediaResults?: MediaResultsResponse): boolean {
  if (stage === 'syncing_knowledge' || stage === 'generating_embeddings') {
    return true;
  }

  if (!mediaResults?.knowledgeSync) {
    return false;
  }

  return ['queued', 'running'].includes(mediaResults.knowledgeSync.indexingStatus);
}

function getKnowledgeSyncSummary(stage?: ProcessingStage, knowledgeSync?: MediaResultsResponse['knowledgeSync']) {
  if (!knowledgeSync) {
    return {
      embeddingsLabel: stage === 'insights_ready' ? 'Ready' : stage === 'generating_embeddings' ? 'Generating…' : 'Queued',
      embeddingsTone: stage === 'insights_ready' ? 'text-emerald-600' : 'text-blue-600',
      searchLabel: stage === 'insights_ready' ? 'Available' : 'Pending',
      searchTone: stage === 'insights_ready' ? 'text-emerald-600' : 'text-slate-400',
    };
  }

  if (knowledgeSync.vectorSearchAvailable) {
    return {
      embeddingsLabel: 'Ready',
      embeddingsTone: 'text-emerald-600',
      searchLabel: 'Available',
      searchTone: 'text-emerald-600',
    };
  }

  if (knowledgeSync.indexingStatus === 'failed') {
    return {
      embeddingsLabel: 'Failed',
      embeddingsTone: 'text-rose-600',
      searchLabel: knowledgeSync.keywordSearchAvailable ? 'Keyword only' : 'Unavailable',
      searchTone: knowledgeSync.keywordSearchAvailable ? 'text-amber-600' : 'text-rose-600',
    };
  }

  if (knowledgeSync.keywordSearchAvailable && knowledgeSync.indexingStatus === 'completed') {
    return {
      embeddingsLabel: 'Limited',
      embeddingsTone: 'text-amber-600',
      searchLabel: 'Keyword only',
      searchTone: 'text-amber-600',
    };
  }

  return {
    embeddingsLabel: knowledgeSync.indexingStatus === 'running' ? 'Generating…' : 'Queued',
    embeddingsTone: 'text-blue-600',
    searchLabel: 'Pending',
    searchTone: 'text-slate-400',
  };
}

function getKnowledgeIndexingTone(indexingStatus: string): string {
  switch (indexingStatus) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    case 'running':
      return 'bg-blue-100 text-blue-700';
    case 'queued':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

const INSIGHT_TYPE_LABEL: Record<MediaInsight['insightType'], string> = {
  summary: 'Summary',
  highlight: 'Highlight',
  key_moment: 'Key Moment',
  topic: 'Topic',
  action_item: 'Action Item',
};

const INSIGHT_TYPE_COLOR: Record<MediaInsight['insightType'], string> = {
  summary: 'bg-blue-100 text-blue-700',
  highlight: 'bg-yellow-100 text-yellow-700',
  key_moment: 'bg-violet-100 text-violet-700',
  topic: 'bg-teal-100 text-teal-700',
  action_item: 'bg-orange-100 text-orange-700',
};

const mediaStatusCache = new Map<string, MediaStatusCacheEntry>();

// ── Component ─────────────────────────────────────────────────────────────────

export function MediaStatusPanel({ fileId, processingStage, filename, showExtendedResults = false }: MediaStatusPanelProps) {
  const cachedEntry = mediaStatusCache.get(fileId);
  const [segments, setSegments] = useState<TranscriptSegment[]>(cachedEntry?.segments ?? []);
  const [insights, setInsights] = useState<MediaInsight[]>(cachedEntry?.insights ?? []);
  const [mediaResults, setMediaResults] = useState<MediaResultsResponse | undefined>(cachedEntry?.mediaResults);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingMediaResults, setLoadingMediaResults] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [resolvedStage, setResolvedStage] = useState<ProcessingStage | undefined>(
    cachedEntry?.resolvedStage ?? processingStage,
  );
  const [resolvedFilename, setResolvedFilename] = useState<string | undefined>(
    cachedEntry?.resolvedFilename ?? filename,
  );
  const [fileStatus, setFileStatus] = useState<string | undefined>(cachedEntry?.fileStatus);
  const [transcriptOpen, setTranscriptOpen] = useState(cachedEntry?.transcriptOpen ?? true);
  const [insightsOpen, setInsightsOpen] = useState(cachedEntry?.insightsOpen ?? true);
  const [creatingClipId, setCreatingClipId] = useState<string | null>(null);
  const [createdClips, setCreatedClips] = useState<Record<string, CreatedClip>>(cachedEntry?.createdClips ?? {});

  useEffect(() => {
    mediaStatusCache.set(fileId, {
      segments,
      insights,
      mediaResults,
      resolvedStage,
      resolvedFilename,
      fileStatus,
      transcriptOpen,
      insightsOpen,
      createdClips,
    });
  }, [createdClips, fileId, fileStatus, insights, insightsOpen, mediaResults, resolvedFilename, resolvedStage, segments, transcriptOpen]);

  useEffect(() => {
    setResolvedStage(resolveDisplayStage(fileStatus, processingStage));
  }, [fileStatus, processingStage]);

  useEffect(() => {
    setResolvedFilename(filename);
  }, [filename]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;

    const loadStatus = async () => {
      if (!mediaStatusCache.get(fileId)?.resolvedStage) {
        setLoadingStatus(true);
      }
      try {
        const data = await apiClient.get<FileStatusResponse>(API_ENDPOINTS.files.status(fileId));
        if (cancelled) return;

        setResolvedStage(resolveDisplayStage(data.status, data.processingStage));
        setResolvedFilename(data.originalName || data.filename || filename);
        setFileStatus(data.status);

        if (shouldPollFileStatus(data.status, data.processingStage)) {
          pollTimer = window.setTimeout(loadStatus, 3000);
        }
      } catch {
        if (!cancelled) {
          setFileStatus(undefined);
        }
      } finally {
        if (!cancelled) {
          setLoadingStatus(false);
        }
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [fileId, filename]);

  const currentStageIdx = stageIndex(resolvedStage);
  const hasTranscript = currentStageIdx >= stageIndex('transcribed');
  // Insights are written to DB before knowledge sync starts — fetch them as soon as syncing_knowledge is reached
  const hasInsights = currentStageIdx >= stageIndex('syncing_knowledge');

  useEffect(() => {
    if (!hasTranscript) return;
    if (mediaStatusCache.get(fileId)?.segments.length) return;
    setLoadingTranscript(true);
    apiClient.get<{ segments: TranscriptSegment[] }>(API_ENDPOINTS.files.transcript(fileId))
      .then(data => setSegments(data.segments ?? []))
      .catch(() => setSegments([]))
      .finally(() => setLoadingTranscript(false));
  }, [fileId, hasTranscript]);

  useEffect(() => {
    if (!hasInsights) return;
    if (mediaStatusCache.get(fileId)?.insights.length) return;
    setLoadingInsights(true);
    apiClient.get<{ insights: MediaInsight[] }>(API_ENDPOINTS.files.insights(fileId))
      .then(data => setInsights(data.insights ?? []))
      .catch(() => setInsights([]))
      .finally(() => setLoadingInsights(false));
  }, [fileId, hasInsights]);

  useEffect(() => {
    if (!showExtendedResults || !hasInsights) return;
    let cancelled = false;
    let pollTimer: number | undefined;

    const loadMediaResults = async (showSpinner: boolean) => {
      if (showSpinner) {
        setLoadingMediaResults(true);
      }

      try {
        const data = await apiClient.get<MediaResultsResponse>(API_ENDPOINTS.files.mediaResults(fileId));
        if (cancelled) return;

        setMediaResults(data);

        if (shouldRefreshKnowledgeSync(resolvedStage, data)) {
          pollTimer = window.setTimeout(() => {
            void loadMediaResults(false);
          }, 4000);
        }
      } catch {
        if (!cancelled) {
          setMediaResults(undefined);
        }
      } finally {
        if (!cancelled && showSpinner) {
          setLoadingMediaResults(false);
        }
      }
    };

    const hasCachedResults = Boolean(mediaStatusCache.get(fileId)?.mediaResults);
    void loadMediaResults(!hasCachedResults);

    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [fileId, hasInsights, resolvedStage, showExtendedResults]);

  const exportBaseName = (resolvedFilename || filename || 'media-analysis')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .toLowerCase();

  const handleCreateClip = async (clip: MediaClipSuggestion) => {
    setCreatingClipId(clip.id);
    try {
      const response = await apiClient.post<CreatedClip>(API_ENDPOINTS.files.createClip(fileId), {
        startTime: clip.startTime,
        endTime: clip.endTime,
        title: clip.title,
        sourceInsightId: clip.id.replace(/^clip-/, ''),
      });

      setCreatedClips(current => ({
        ...current,
        [clip.id]: response,
      }));
    } finally {
      setCreatingClipId(null);
    }
  };

  const handleCopyClipTimestamps = async (clip: MediaClipSuggestion) => {
    await navigator.clipboard.writeText(`${formatTime(clip.startTime)}-${formatTime(clip.endTime)}`);
  };

  const exportSummaryAsMarkdown = () => {
    if (!mediaResults) return;
    const lines =
      intelligenceMode === 'conversation'
        ? [
            `# ${mediaResults.overview.summary?.title || resolvedFilename || 'Conversation brief'}`,
            '',
            mediaResults.overview.summary?.description || '',
            '',
            '## Decision And Follow-Up View',
            ...displayedMoments.slice(0, 6).flatMap(moment => [
              `- ${moment.title} (${formatTime(moment.startTime ?? 0)}${moment.endTime !== undefined ? `-${formatTime(moment.endTime)}` : ''})`,
              `  Why it matters: ${moment.whyItMatters}`,
            ]),
            '',
            '## Follow-Ups',
            ...displayedActionItems.map(item => `- ${item.title}${item.description ? `: ${item.description}` : ''}`),
            '',
            '## Discussion Themes',
            ...displayedTopics.map(topic => `- ${topic.title}${topic.description ? `: ${topic.description}` : ''}`),
          ]
        : intelligenceMode === 'sales'
          ? [
              `# ${mediaResults.overview.summary?.title || resolvedFilename || 'Deal brief'}`,
              '',
              mediaResults.overview.summary?.description || '',
              '',
              '## Deal Signals',
              ...displayedMoments.slice(0, 6).flatMap(moment => [
                `- ${moment.title} (${formatTime(moment.startTime ?? 0)}${moment.endTime !== undefined ? `-${formatTime(moment.endTime)}` : ''})`,
                `  Why it matters: ${moment.whyItMatters}`,
              ]),
              '',
              '## Commercial Themes',
              ...displayedTopics.map(topic => `- ${topic.title}${topic.description ? `: ${topic.description}` : ''}`),
              '',
              '## Commitments',
              ...displayedActionItems.map(item => `- ${item.title}${item.description ? `: ${item.description}` : ''}`),
            ]
          : intelligenceMode === 'creator'
            ? [
                `# ${mediaResults.overview.summary?.title || resolvedFilename || 'Creator brief'}`,
                '',
                mediaResults.overview.summary?.description || '',
                '',
                '## Best Clips',
                ...mediaResults.clipSuggestions.map(clip => `- ${clip.title} (${formatTime(clip.startTime)}-${formatTime(clip.endTime)}): ${clip.hook}`),
                '',
                '## Hooks And Quotable Moments',
                ...displayedMoments.slice(0, 6).flatMap(moment => [
                  `- ${moment.title} (${formatTime(moment.startTime ?? 0)}${moment.endTime !== undefined ? `-${formatTime(moment.endTime)}` : ''})`,
                  `  Why it matters: ${moment.whyItMatters}`,
                ]),
              ]
            : [
                `# ${mediaResults.overview.summary?.title || resolvedFilename || 'Media analysis'}`,
                '',
                mediaResults.overview.summary?.description || '',
                '',
                '## Chapters',
                ...mediaResults.chapters.flatMap(chapter => [
                  `### ${chapter.title} (${formatTime(chapter.startTime)}-${formatTime(chapter.endTime)})`,
                  chapter.summary,
                  chapter.topics.length ? `Topics: ${chapter.topics.join(', ')}` : '',
                  '',
                ]),
                '## Key Moments',
                ...displayedMoments.map(moment => `- ${moment.title} (${formatTime(moment.startTime ?? 0)}${moment.endTime !== undefined ? `-${formatTime(moment.endTime)}` : ''})`),
                '',
                '## Action Items',
                ...displayedActionItems.map(item => `- ${item.title}${item.description ? `: ${item.description}` : ''}`),
              ];
    downloadTextFile(lines.join('\n'), `${exportBaseName}-summary.md`, 'text/markdown');
  };

  const exportModeSheetAsCsv = () => {
    if (!mediaResults) return;
    const rows =
      intelligenceMode === 'creator'
        ? [
            ['title', 'hook', 'start_time', 'end_time', 'duration_seconds', 'confidence', 'why_it_works'],
            ...mediaResults.clipSuggestions.map(clip => [
              clip.title,
              clip.hook,
              clip.startTime.toString(),
              clip.endTime.toString(),
              clip.duration.toString(),
              clip.confidence.toString(),
              clip.whyItWorks,
            ]),
          ]
        : intelligenceMode === 'sales'
          ? [
              ['kind', 'title', 'start_time', 'end_time', 'description', 'confidence', 'notes'],
              ...displayedMoments.map(moment => [
                momentTypeLabel(moment.type),
                moment.title,
                moment.startTime?.toString() || '',
                moment.endTime?.toString() || '',
                moment.description || '',
                moment.confidence.toString(),
                moment.whyItMatters,
              ]),
              ...displayedActionItems.map(item => [
                'Commitment',
                item.title,
                item.startTime?.toString() || '',
                item.endTime?.toString() || '',
                item.description || '',
                '',
                '',
              ]),
            ]
          : intelligenceMode === 'conversation'
            ? [
                ['kind', 'title', 'start_time', 'end_time', 'description', 'notes'],
                ...displayedMoments.map(moment => [
                  momentTypeLabel(moment.type),
                  moment.title,
                  moment.startTime?.toString() || '',
                  moment.endTime?.toString() || '',
                  moment.description || '',
                  moment.whyItMatters,
                ]),
                ...displayedActionItems.map(item => [
                  'Follow-up',
                  item.title,
                  item.startTime?.toString() || '',
                  item.endTime?.toString() || '',
                  item.description || '',
                  '',
                ]),
              ]
            : [
                ['kind', 'title', 'start_time', 'end_time', 'description', 'tags'],
                ...displayedMoments.map(moment => [
                  momentTypeLabel(moment.type),
                  moment.title,
                  moment.startTime?.toString() || '',
                  moment.endTime?.toString() || '',
                  moment.description || '',
                  moment.tags.join(' | '),
                ]),
                ...displayedTopics.map(topic => [
                  'Topic',
                  topic.title,
                  topic.startTime?.toString() || '',
                  topic.endTime?.toString() || '',
                  topic.description || '',
                  topic.tags.join(' | '),
                ]),
              ];
    const csv = rows
      .map(row => row.map(value => escapeCsvValue(value)).join(','))
      .join('\n');
    downloadTextFile(csv, `${exportBaseName}-${intelligenceMode}-sheet.csv`, 'text/csv');
  };

  const exportTranscriptAsText = () => {
    if (!segments.length) return;
    const text = segments
      .map(segment => `${formatTime(segment.startTime)}-${formatTime(segment.endTime)} ${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`)
      .join('\n');
    downloadTextFile(text, `${exportBaseName}-transcript.txt`, 'text/plain');
  };

  const timelineMarkers = mediaResults
    ? [
        ...mediaResults.chapters.map(chapter => ({
          id: chapter.id,
          label: chapter.title,
          startTime: chapter.startTime,
          endTime: chapter.endTime,
          tone: 'bg-sky-500',
          kind: 'Chapter',
        })),
        ...mediaResults.moments.slice(0, 6).map(moment => ({
          id: moment.id,
          label: moment.title,
          startTime: moment.startTime ?? 0,
          endTime: moment.endTime ?? moment.startTime ?? 0,
          tone: 'bg-violet-500',
          kind: 'Moment',
        })),
        ...mediaResults.clipSuggestions.slice(0, 6).map(clip => ({
          id: clip.id,
          label: clip.title,
          startTime: clip.startTime,
          endTime: clip.endTime,
          tone: 'bg-amber-500',
          kind: 'Clip',
        })),
      ].sort((a, b) => a.startTime - b.startTime)
    : [];

  const intelligenceMode = (mediaResults?.overview.intelligenceMode as MediaIntelligenceMode | undefined) ?? DEFAULT_MEDIA_INTELLIGENCE_MODE;
  const modeProfile = getMediaIntelligenceResultsProfile(intelligenceMode);
  const knowledgeSyncSummary = getKnowledgeSyncSummary(resolvedStage, mediaResults?.knowledgeSync);

  const conversationDecisionMoments = pickByKeywords(
    mediaResults?.moments ?? [],
    textFromInsightLike,
    modeProfile.conversationMomentPatterns?.decisions ?? [],
    4,
  );
  const conversationSpeakerMoments = pickByKeywords(
    mediaResults?.moments ?? [],
    textFromInsightLike,
    modeProfile.conversationMomentPatterns?.pivots ?? [],
    5,
  );
  const salesBuyingSignals = pickByKeywords(
    mediaResults?.moments ?? [],
    textFromInsightLike,
    modeProfile.salesMomentPatterns?.buyingSignals ?? [],
    4,
  );
  const salesObjections = pickByKeywords(
    mediaResults?.moments ?? [],
    textFromInsightLike,
    modeProfile.salesMomentPatterns?.objections ?? [],
    4,
  );
  const salesPricingTopics = pickByKeywords(
    mediaResults?.topics ?? [],
    textFromInsightLike,
    modeProfile.salesMomentPatterns?.pricing ?? [],
    4,
  );
  const salesCommitments = pickByKeywords(
    mediaResults?.actionItems ?? [],
    textFromInsightLike,
    modeProfile.salesMomentPatterns?.commitments ?? [],
    4,
  );

  const showChapters = modeProfile.showChapters;
  const showMoments = true;
  const showClips = modeProfile.showClips;
  const showTopics = modeProfile.showTopics;
  const showActionItems = modeProfile.showActionItems;

  const overviewTitle = modeProfile.overviewTitle;
  const guidedTitle = modeProfile.guidedTitle;
  const timelineTitle = modeProfile.timelineTitle;
  const chaptersTitle = modeProfile.chaptersTitle;
  const momentsTitle = modeProfile.momentsTitle;
  const clipsTitle = modeProfile.clipsTitle;
  const topicsTitle = modeProfile.topicsTitle;
  const actionsTitle = modeProfile.actionsTitle;
  const summaryDescription = mediaResults?.overview.summary?.description;
  const primaryMoment =
    intelligenceMode === 'conversation'
      ? conversationDecisionMoments[0] ?? conversationSpeakerMoments[0] ?? mediaResults?.moments?.[0]
      : intelligenceMode === 'sales'
        ? salesBuyingSignals[0] ?? salesObjections[0] ?? mediaResults?.moments?.[0]
        : mediaResults?.moments?.[0];
  const primaryClip =
    intelligenceMode === 'creator'
      ? mediaResults?.clipSuggestions?.[0]
      : mediaResults?.clipSuggestions?.[0];
  const primaryAction =
    intelligenceMode === 'conversation'
      ? mediaResults?.actionItems?.[0]
      : intelligenceMode === 'sales'
        ? salesCommitments[0] ?? mediaResults?.actionItems?.[0]
        : mediaResults?.actionItems?.[0];
  const displayedMoments =
    intelligenceMode === 'conversation'
      ? [...conversationDecisionMoments, ...conversationSpeakerMoments.filter(
          moment => !conversationDecisionMoments.some(decision => decision.id === moment.id),
        )]
      : intelligenceMode === 'sales'
        ? [...salesBuyingSignals, ...salesObjections.filter(
            moment => !salesBuyingSignals.some(signal => signal.id === moment.id),
          )]
        : mediaResults?.moments ?? [];
  const displayedTopics =
    intelligenceMode === 'sales'
      ? salesPricingTopics
      : mediaResults?.topics ?? [];
  const displayedActionItems =
    intelligenceMode === 'sales'
      ? salesCommitments
      : mediaResults?.actionItems ?? [];
  const summaryLabel = modeProfile.summaryLabel;
  const topMomentLabel = modeProfile.topMomentLabel;
  const topClipLabel = modeProfile.topClipLabel;
  const nextStepLabel = modeProfile.nextStepLabel;
  const momentTypeLabel = (momentType: string) => {
    if (intelligenceMode === 'sales') {
      return /objection|risk|concern|issue/i.test(momentType) ? 'Objection' : 'Signal';
    }
    if (intelligenceMode === 'conversation') {
      return /highlight/i.test(momentType) ? 'Discussion point' : 'Decision';
    }
    if (intelligenceMode === 'creator') {
      return /highlight/i.test(momentType) ? 'Quote' : 'Hook';
    }
    return momentType === 'key_moment' ? 'Key moment' : 'Highlight';
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Pipeline progress */}
      <div className={cx(workspacePanelMuted, 'p-3')}>
        <p className={cx(workspaceSectionLabel, 'mb-2')}>Processing pipeline</p>
        {resolvedFilename && <p className="text-xs text-slate-500 mb-3 truncate">{resolvedFilename}</p>}
        {resolvedStage && (
          <div className="mb-3 rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2">
            <p className="text-xs font-medium text-slate-700">{STAGE_LABELS[resolvedStage]}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">{STAGE_HINTS[resolvedStage]}</p>
          </div>
        )}
        <ol className="space-y-1.5">
          {STAGE_ORDER.map((stage, idx) => {
            const done = idx <= currentStageIdx;
            const active = idx === currentStageIdx;
            const isTerminal = resolvedStage === 'insights_ready';
            return (
              <li key={stage} className="flex items-center gap-2">
                {done ? (
                  active && !isTerminal ? (
                    <Loader2 className="w-4 h-4 shrink-0 text-blue-500 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
                  )
                ) : (
                  <div className="w-4 h-4 shrink-0 rounded-full border-2 border-slate-200" />
                )}
                <span className={cx(
                  'text-xs',
                  done ? 'text-slate-800 font-medium' : 'text-slate-400',
                  active && !isTerminal ? 'text-blue-600' : '',
                )}>
                  {STAGE_LABELS[stage]}
                </span>
              </li>
            );
          })}
        </ol>

        {loadingStatus && (
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Refreshing file status…
          </p>
        )}

        {!resolvedStage && !loadingStatus && (
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Awaiting pipeline status…
          </p>
        )}

        {/* Inline knowledge sync status — always visible during and after sync */}
        {(resolvedStage === 'syncing_knowledge' || resolvedStage === 'generating_embeddings' || resolvedStage === 'insights_ready') && (
          <div className="mt-3 rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Knowledge sync</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600">Embeddings</span>
              <span className={cx('flex items-center gap-1 text-xs font-medium', knowledgeSyncSummary.embeddingsTone)}>
                {knowledgeSyncSummary.embeddingsLabel === 'Generating…' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : knowledgeSyncSummary.embeddingsLabel === 'Ready' ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : knowledgeSyncSummary.embeddingsLabel === 'Failed' ? (
                  <AlertCircle className="w-3 h-3" />
                ) : null}
                {knowledgeSyncSummary.embeddingsLabel}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600">Search</span>
              <span className={cx('text-xs font-medium', knowledgeSyncSummary.searchTone)}>
                {knowledgeSyncSummary.searchLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {showExtendedResults && hasInsights && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_320px]">
          <div className="space-y-4">
            <div className={workspacePanelMuted}>
              <div className="border-b border-slate-200/60 px-3 py-3">
                <p className={workspaceSectionLabel}>Overview</p>
                <h4 className="text-sm font-semibold text-slate-900">{overviewTitle}</h4>
              </div>
              <div className="p-3">
                {loadingMediaResults ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" /> Building structured results…
                  </div>
                ) : mediaResults?.overview.summary ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{mediaResults.overview.summary.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <div className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          Detected type: {formatMediaTypeLabel(mediaResults.overview.mediaType)}
                        </div>
                        <div className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          Intelligence mode: {getMediaIntelligenceModeLabel(mediaResults.overview.intelligenceMode)}
                        </div>
                      </div>
                      {mediaResults.overview.summary.description && (
                        <p className="mt-1 text-sm leading-6 text-slate-600">{mediaResults.overview.summary.description}</p>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      {[
                        { label: 'Chapters', value: mediaResults.overview.chapterCount },
                        { label: 'Moments', value: mediaResults.overview.keyMomentCount },
                        { label: 'Clips', value: mediaResults.overview.clipSuggestionCount },
                        { label: 'Actions', value: mediaResults.overview.actionItemCount },
                        { label: 'Frames', value: mediaResults.overview.frameAnalysisCount },
                      ].map(item => (
                        <div key={item.label} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Structured media results will appear here once insights are ready.</p>
                )}
              </div>
            </div>

            {mediaResults?.overview.summary ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Guided view</p>
                  <h4 className="text-sm font-semibold text-slate-900">{guidedTitle}</h4>
                </div>
                <div className="space-y-3 p-3">
                  {summaryDescription ? (
                    <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{summaryLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{summaryDescription}</p>
                    </div>
                  ) : null}
                  {showMoments && primaryMoment ? (
                    <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{topMomentLabel}</p>
                        {primaryMoment.startTime !== undefined && (
                          <span className="font-mono text-[11px] text-slate-400">
                            {formatTime(primaryMoment.startTime)}
                            {primaryMoment.endTime !== undefined ? `–${formatTime(primaryMoment.endTime)}` : ''}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{primaryMoment.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{primaryMoment.whyItMatters}</p>
                    </div>
                  ) : null}
                  {showClips && primaryClip ? (
                    <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{topClipLabel}</p>
                        <span className="font-mono text-[11px] text-slate-400">
                          {formatTime(primaryClip.startTime)}–{formatTime(primaryClip.endTime)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{primaryClip.title}</p>
                      <p className="mt-1 text-sm text-slate-600">Hook: {primaryClip.hook}</p>
                    </div>
                  ) : null}
                  {showActionItems && primaryAction ? (
                    <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{nextStepLabel}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{primaryAction.title}</p>
                      {primaryAction.description && (
                        <p className="mt-1 text-sm text-slate-600">{primaryAction.description}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {mediaResults && mediaResults.overview.durationSec > 0 ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Timeline</p>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                    {timelineTitle}
                  </h4>
                </div>
                <div className="space-y-3 p-3">
                  <div className="relative h-3 rounded-full bg-slate-200">
                    {timelineMarkers.map(marker => {
                      const width = Math.max(((marker.endTime - marker.startTime) / mediaResults.overview.durationSec) * 100, 2);
                      const left = (marker.startTime / mediaResults.overview.durationSec) * 100;
                      return (
                        <div
                          key={marker.id}
                          className={cx('absolute top-0 h-3 rounded-full opacity-90', marker.tone)}
                          style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                          title={`${marker.kind}: ${marker.label}`}
                        />
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    {timelineMarkers.slice(0, 8).map(marker => (
                      <div key={marker.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-900">{marker.label}</p>
                          <p className="text-[11px] text-slate-500">{marker.kind}</p>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-slate-400">
                          {formatTime(marker.startTime)}-{formatTime(marker.endTime)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {showChapters && mediaResults?.chapters?.length ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Chapters</p>
                  <h4 className="text-sm font-semibold text-slate-900">{chaptersTitle}</h4>
                </div>
                <div className="space-y-3 p-3">
                  {mediaResults.chapters.map(chapter => (
                    <div key={chapter.id} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{chapter.title}</p>
                          <p className="mt-1 font-mono text-[11px] text-slate-400">
                            {formatTime(chapter.startTime)}–{formatTime(chapter.endTime)}
                          </p>
                        </div>
                        {chapter.topics.length > 0 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                            {chapter.topics.slice(0, 2).join(' · ')}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{chapter.summary}</p>
                      {chapter.visualHighlights.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {chapter.visualHighlights.map((visual, visualIndex) => (
                            <div key={`${chapter.id}-visual-${visualIndex}`} className="rounded-lg border border-sky-200/70 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                              {visual}
                            </div>
                          ))}
                        </div>
                      )}
                      {chapter.notableQuotes.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {chapter.notableQuotes.slice(0, 2).map(quote => (
                            <div key={quote.id} className="rounded-lg border border-slate-200/70 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              <p className="font-mono text-[11px] text-slate-400">
                                {formatTime(quote.startTime)}–{formatTime(quote.endTime)}
                              </p>
                              <p className="mt-1">"{quote.text}"</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {showMoments && mediaResults?.moments?.length ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Moments</p>
                  <h4 className="text-sm font-semibold text-slate-900">{momentsTitle}</h4>
                </div>
                <div className="space-y-3 p-3">
                  {displayedMoments.map(moment => (
                    <div key={moment.id} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                            #{moment.rank}
                          </span>
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                            {momentTypeLabel(moment.type)}
                          </span>
                        </div>
                        {moment.startTime !== undefined && (
                          <span className="font-mono text-[11px] text-slate-400">
                            {formatTime(moment.startTime)}
                            {moment.endTime !== undefined ? `–${formatTime(moment.endTime)}` : ''}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{moment.title}</p>
                      {moment.description && <p className="mt-1 text-sm text-slate-600">{moment.description}</p>}
                      <p className="mt-2 text-xs text-slate-500">{moment.whyItMatters}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {showClips && mediaResults?.clipSuggestions?.length ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Clips</p>
                  <h4 className="text-sm font-semibold text-slate-900">{clipsTitle}</h4>
                </div>
                <div className="space-y-3 p-3">
                  {mediaResults.clipSuggestions.map(clip => (
                    <div key={clip.id} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{clip.title}</p>
                        <span className="font-mono text-[11px] text-slate-400">
                          {formatTime(clip.startTime)}–{formatTime(clip.endTime)}
                        </span>
                      </div>
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Hook: {clip.hook}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{clip.duration}s</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{Math.round(clip.confidence * 100)}% confidence</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{clip.whyItWorks}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => void handleCreateClip(clip)}
                          disabled={creatingClipId === clip.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {creatingClipId === clip.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Clapperboard className="h-3.5 w-3.5" />
                          )}
                          {creatingClipId === clip.id ? 'Creating clip…' : 'Create clip'}
                        </button>
                        <button
                          onClick={() => void handleCopyClipTimestamps(clip)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy timestamps
                        </button>
                        {createdClips[clip.id] && (
                          <a
                            href={createdClips[clip.id].downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open clip
                          </a>
                        )}
                      </div>
                      {createdClips[clip.id] && (
                        <p className="mt-2 text-xs text-emerald-700">
                          Clip created for {formatTime(createdClips[clip.id].startTime)}–{formatTime(createdClips[clip.id].endTime)}.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

          </div>

          <div className="space-y-4">
            {showTopics && mediaResults?.topics?.length ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Topics</p>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Tags className="h-4 w-4 text-slate-500" />
                    {topicsTitle}
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2 p-3">
                  {displayedTopics.map((topic, index) => (
                    <div
                      key={topic.id}
                      className="rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-teal-700"
                      style={{
                        fontSize: `${Math.max(12, 16 - index * 0.6)}px`,
                        fontWeight: index < 3 ? 700 : 600,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{topic.title}</span>
                        {topic.startTime !== undefined && (
                          <span className="rounded-full bg-white/70 px-2 py-0.5 font-mono text-[11px] text-teal-700">
                            {formatTime(topic.startTime)}
                            {topic.endTime !== undefined ? `–${formatTime(topic.endTime)}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {showActionItems && mediaResults?.actionItems?.length ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Follow-up</p>
                  <h4 className="text-sm font-semibold text-slate-900">{actionsTitle}</h4>
                </div>
                <div className="space-y-2 p-3">
                  {displayedActionItems.map(item => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        {item.startTime !== undefined && (
                          <span className="shrink-0 font-mono text-[11px] text-slate-400">
                            {formatTime(item.startTime)}
                            {item.endTime !== undefined ? `–${formatTime(item.endTime)}` : ''}
                          </span>
                        )}
                      </div>
                      {item.description && <p className="mt-1 text-xs text-slate-500">{item.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {modeProfile.showVisionAnalysis && mediaResults?.frameAnalyses?.length ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Vision analysis</p>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {mediaResults.frameAnalyses.length} frame{mediaResults.frameAnalyses.length !== 1 ? 's' : ''} analysed
                  </h4>
                </div>
                <div className="space-y-2 p-3">
                  {mediaResults.frameAnalyses.map(frame => (
                    <div key={frame.id} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-500">{formatTime(frame.timestampSec)}</p>
                        {frame.confidence !== null && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            {formatConfidence(frame.confidence)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-800">{frame.description}</p>
                      {frame.detectedText && (
                        <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                          On-screen: "{frame.detectedText}"
                        </p>
                      )}
                      {frame.objects.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {frame.objects.slice(0, 6).map(obj => (
                            <span key={obj} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                              {obj}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {mediaResults?.knowledgeSync ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Knowledge</p>
                  <h4 className="text-sm font-semibold text-slate-900">RAG sync</h4>
                </div>
                <div className="space-y-2 p-3 text-sm text-slate-600">
                  {(resolvedStage === 'syncing_knowledge' || resolvedStage === 'generating_embeddings') && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
                      Analysis is complete. Knowledge sync is still running in the background, so retrieval readiness may lag behind the Results tab for a few moments.
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
                    <span>Indexing status</span>
                    <span
                      className={cx(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        getKnowledgeIndexingTone(mediaResults.knowledgeSync.indexingStatus),
                      )}
                    >
                      {mediaResults.knowledgeSync.indexingStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
                    <span>Keyword search</span>
                    <span
                      className={cx(
                        'text-xs font-medium',
                        mediaResults.knowledgeSync.keywordSearchAvailable ? 'text-emerald-600' : 'text-slate-500',
                      )}
                    >
                      {mediaResults.knowledgeSync.keywordSearchAvailable ? 'Available' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
                    <span>Vector search</span>
                    <span
                      className={cx(
                        'text-xs font-medium',
                        mediaResults.knowledgeSync.vectorSearchAvailable
                          ? 'text-emerald-600'
                          : mediaResults.knowledgeSync.indexingStatus === 'failed'
                            ? 'text-rose-600'
                            : 'text-slate-500',
                      )}
                    >
                      {mediaResults.knowledgeSync.vectorSearchAvailable
                        ? 'Available'
                        : mediaResults.knowledgeSync.indexingStatus === 'failed'
                          ? 'Unavailable'
                          : 'Pending'}
                    </span>
                  </div>
                  {mediaResults.knowledgeSync.indexingStatus === 'failed' && mediaResults.knowledgeSync.keywordSearchAvailable && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      Media insights are still synced for keyword search, but vector retrieval is unavailable until embeddings succeed.
                    </div>
                  )}
                  {mediaResults.knowledgeSync.syncedAt && (
                    <p className="text-xs text-slate-400">
                      Synced back to Knowledge on {new Date(mediaResults.knowledgeSync.syncedAt).toLocaleString()}.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {mediaResults ? (
              <div className={workspacePanelMuted}>
                <div className="border-b border-slate-200/60 px-3 py-3">
                  <p className={workspaceSectionLabel}>Export</p>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Download className="h-4 w-4 text-slate-500" />
                    Export center
                  </h4>
                </div>
                <div className="space-y-2 p-3">
                  <button
                    onClick={exportSummaryAsMarkdown}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300"
                  >
                    <span>{modeProfile.exportSummaryLabel}</span>
                    <span className="text-xs text-slate-400">Markdown</span>
                  </button>
                  <button
                    onClick={exportModeSheetAsCsv}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300"
                  >
                    <span>{modeProfile.exportSheetLabel}</span>
                    <span className="text-xs text-slate-400">{modeProfile.exportSheetFormat.toUpperCase()}</span>
                  </button>
                  <button
                    onClick={exportTranscriptAsText}
                    disabled={!segments.length}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>Export transcript</span>
                    <span className="text-xs text-slate-400">TXT</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Transcript segments */}
      {hasTranscript && (
        <div className={workspacePanelMuted}>
          <button
            onClick={() => setTranscriptOpen(o => !o)}
            className="flex w-full items-center justify-between p-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <Mic className="w-4 h-4 text-cyan-500" />
              Transcript
              {segments.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  {segments.length}
                </span>
              )}
            </span>
            {transcriptOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>

          {transcriptOpen && (
            <div className="max-h-64 overflow-y-auto border-t border-slate-200/60 px-3 pb-3">
              {loadingTranscript ? (
                <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading transcript…
                </div>
              ) : segments.length === 0 ? (
                <p className="py-4 text-xs text-slate-400">No segments yet.</p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {segments.map(seg => (
                    <li key={seg.id} className="text-xs">
                      <span className="font-mono text-slate-400 mr-2">
                        {formatTime(seg.startTime)}–{formatTime(seg.endTime)}
                      </span>
                      {seg.speaker && (
                        <span className="mr-1 font-semibold text-slate-600">{seg.speaker}:</span>
                      )}
                      <span className="text-slate-800">{seg.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {/* Media insights */}
      {hasInsights && (
        <div className={workspacePanelMuted}>
          <button
            onClick={() => setInsightsOpen(o => !o)}
            className="flex w-full items-center justify-between p-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <Sparkles className="w-4 h-4 text-violet-500" />
              Insights
              {insights.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  {insights.length}
                </span>
              )}
            </span>
            {insightsOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>

          {insightsOpen && (
            <div className="max-h-72 overflow-y-auto border-t border-slate-200/60 px-3 pb-3">
              {loadingInsights ? (
                <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading insights…
                </div>
              ) : insights.length === 0 ? (
                <p className="py-4 text-xs text-slate-400">No insights yet.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {insights.map(insight => (
                    <li key={insight.id} className="text-xs">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-medium', INSIGHT_TYPE_COLOR[insight.insightType])}>
                          {INSIGHT_TYPE_LABEL[insight.insightType]}
                        </span>
                        {insight.startTime !== undefined && (
                          <span className="font-mono text-slate-400">
                            {formatTime(insight.startTime)}
                            {insight.endTime !== undefined ? `–${formatTime(insight.endTime)}` : ''}
                          </span>
                        )}
                        {insight.score !== undefined && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {formatConfidence(insight.score)}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-slate-800">{insight.title}</p>
                      {insight.description && (
                        <p className="text-slate-500 mt-0.5">{insight.description}</p>
                      )}
                      {insight.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {insight.tags.map(tag => (
                            <span key={tag} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Not yet a media file */}
      {!hasTranscript && (resolvedStage === 'uploaded' || fileStatus === 'processing' || fileStatus === 'uploaded') && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          <AlertCircle className="w-4 h-4 shrink-0 text-slate-400" />
          Media processing is underway. Transcript and insights will appear here automatically as each step finishes.
        </div>
      )}
    </div>
  );
}
