import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import type { TranscriptSegment } from './transcription-service.js';
import type { FrameAnalysis } from './vision-analysis-service.js';
import { getMediaIntelligenceProfile, resolveMediaIntelligenceMode, type MediaChunkingPolicy, type MediaIntelligenceMode } from './media-intelligence-profiles.js';

export type InsightType = 'highlight' | 'summary' | 'key_moment' | 'topic' | 'action_item';
export type { MediaIntelligenceMode } from './media-intelligence-profiles.js';

export interface MediaInsight {
  insightType: InsightType;
  title: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  score?: number;
  tags: string[];
  metadata: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    intelligenceMode?: MediaIntelligenceMode;
  };
}

export interface InsightGenerationResult {
  insights: MediaInsight[];
  provider: 'groq' | 'openai' | 'anthropic';
  model: string;
}

export interface MediaInsightGenerationOptions {
  preferredModel?: string;
  frameAnalyses?: FrameAnalysis[];  // optional visual context from vision model
  speakerAttributionStrategy?: 'provided' | 'heuristic_dialogue' | 'single_speaker_default' | 'none';
  intelligenceMode?: MediaIntelligenceMode;
  onProgress?: (stage: 'building_timeline' | 'generating_insights' | 'synthesizing_results') => Promise<void> | void;
}

type MediaContentType = 'podcast' | 'interview' | 'meeting' | 'video_call' | 'webinar' | 'tutorial' | 'presentation' | 'general_video';

interface PromptCandidateMoment {
  type: 'spoken_action' | 'spoken_highlight' | 'visual_change';
  timestampSec: number;
  endTimeSec?: number;
  evidence: string;
  rationale: string;
}

interface PromptPayload {
  objective: string;
  media_type: MediaContentType;
  analysis_mode: string;
  speaker_context: {
    speakers_detected: number;
    speaker_labels_mode: 'provided' | 'heuristic_dialogue' | 'single_speaker_default' | 'none';
    visible_name_labels: string[];
    active_speaker_hints: string[];
    meeting_layout_hints: string[];
  };
  batch_context: {
    batch_index: number;
    total_batches: number;
    duration_hint_sec: number;
    transcript_segments: number;
    visual_events: number;
    speakers_detected: number;
    has_visual_context: boolean;
  };
  evidence_rules: string[];
  candidate_moments: PromptCandidateMoment[];
  timeline_entries: string[];
}

const MAX_TRANSCRIPT_CHARS_PER_REQUEST = 8000;
const MAX_SEGMENTS_PER_REQUEST = 120;
const MAX_TIMELINE_ENTRIES_PER_REQUEST = 150;
const MAX_HIGHLIGHTS = 5;
const MAX_KEY_MOMENTS = 5;
const MAX_TOPICS = 8;
const MAX_ACTION_ITEMS = 8;
const GROQ_BATCH_DELAY_MS = 150;
const GROQ_MAX_RETRIES = 4;

const MEDIA_INSIGHT_MODELS = {
  groq: ['llama-3.1-8b-instant', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'],
  openai: ['gpt-4o-mini'],
  anthropic: ['claude-haiku-4-5-20251001'],
} as const;

const INSIGHT_SYSTEM_PROMPT = `You are a media intelligence assistant. Analyse the provided media timeline and extract structured insights for long-form audio/video.

The timeline may contain AUDIO entries (spoken transcript with timestamps) and VISUAL entries (what was shown on screen at that moment). Use both together to form a complete understanding of the content.

Return a JSON object with this exact shape:
{
  "summary": { "title": string, "description": string, "tags": string[] },
  "highlights": [{ "title": string, "description": string, "startTime": number, "endTime": number, "score": number, "tags": string[] }],
  "key_moments": [{ "title": string, "description": string, "startTime": number, "endTime": number, "score": number, "tags": string[] }],
  "topics": [{ "title": string, "description": string, "tags": string[] }],
  "action_items": [{ "title": string, "description": string, "tags": string[] }]
}

Rules:
- highlights: 3–5 strongest viewer-facing moments that would still make sense when quoted or clipped out of context
- key_moments: structural turning points, topic shifts, decisions, reveals, conclusions, or meaningful slide/demo changes
- topics: 3–8 main themes — include visual topics (charts, slides, demos) only when supported by evidence in the timeline
- action_items: only include tasks or next steps that are explicitly stated or very strongly implied by concrete language in the timeline
- All times are in seconds from the start of the media
- If a field has no data, return an empty array / null
- When VISUAL context is present, use it to enrich insights (e.g. "speaker discussed revenue growth while showing a bar chart comparing 2024 vs 2025")
- Ground every claim in the provided evidence. Do not infer hidden intent, future plans, or action items that are not supported by the timeline.
- Avoid duplicates across highlights and key_moments unless the same moment genuinely serves both roles.
- Prefer precise timestamps and concise descriptions over broad generic summaries.
- Treat the candidate_moments list as hints, not truth. You must still verify against the timeline entries.`;

const INSIGHT_SYNTHESIS_SYSTEM_PROMPT = `You are a media intelligence assistant performing a second-pass synthesis across multiple chunk-level analyses of the same media file.

You will receive mode-aware chunk summaries and chunk-level highlights, key moments, topics, and action items. Consolidate them into one final grounded JSON response for the whole asset.

Return a JSON object with this exact shape:
{
  "summary": { "title": string, "description": string, "tags": string[] },
  "highlights": [{ "title": string, "description": string, "startTime": number, "endTime": number, "score": number, "tags": string[] }],
  "key_moments": [{ "title": string, "description": string, "startTime": number, "endTime": number, "score": number, "tags": string[] }],
  "topics": [{ "title": string, "description": string, "tags": string[] }],
  "action_items": [{ "title": string, "description": string, "tags": string[] }]
}

Rules:
- Only use evidence contained in the provided chunk analyses.
- Deduplicate aggressively across overlapping chunks.
- Prefer the most representative and highest-signal moments for the whole asset.
- Preserve timestamps only for highlights and key_moments.
- If chunks disagree slightly, choose the most grounded synthesis instead of repeating both.
- Keep the final output mode-aware and retrieval-friendly.
- Return only valid JSON.`;

function buildSpeakerContext(
  segments: TranscriptSegment[],
  frameAnalyses: FrameAnalysis[],
  speakerAttributionStrategy: 'provided' | 'heuristic_dialogue' | 'single_speaker_default' | 'none',
) {
  const visibleNameLabels = [
    ...new Set(
      frameAnalyses.flatMap(frame => frame.metadata.visibleNameLabels ?? [])
        .map(label => label.trim())
        .filter(Boolean),
    ),
  ].slice(0, 8);

  const activeSpeakerHints = [
    ...new Set(
      frameAnalyses.map(frame => frame.metadata.activeSpeakerHint?.trim())
        .filter(Boolean) as string[],
    ),
  ].slice(0, 6);

  const meetingLayoutHints = [
    ...new Set(
      frameAnalyses.flatMap(frame => {
        const layout = frame.metadata.meetingLayout;
        return layout && layout !== 'unknown' ? [layout] : [];
      }),
    ),
  ].slice(0, 4);

  return {
    speakers_detected: uniqueSpeakers(segments).length,
    speaker_labels_mode: speakerAttributionStrategy,
    visible_name_labels: visibleNameLabels,
    active_speaker_hints: activeSpeakerHints,
    meeting_layout_hints: meetingLayoutHints,
  };
}

function buildTranscriptText(segments: TranscriptSegment[]): string {
  return segments
    .map(s => `[${s.startTime.toFixed(1)}s–${s.endTime.toFixed(1)}s] AUDIO${s.speaker ? ` | ${s.speaker}` : ''}: ${s.text}`)
    .join('\n');
}

function normalizeTextForMatch(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type TimelineEntry =
  | { kind: 'audio'; t: number; text: string; endTime: number; speaker?: string }
  | { kind: 'visual'; t: number; description: string; detectedText: string | null };

function buildTimelineEntries(
  segments: TranscriptSegment[],
  frameAnalyses: FrameAnalysis[],
): TimelineEntry[] {
  return [
    ...segments.map(s => ({
      kind: 'audio' as const,
      t: s.startTime,
      text: s.text,
      endTime: s.endTime,
      speaker: s.speaker,
    })),
    ...frameAnalyses.map(f => ({
      kind: 'visual' as const,
      t: f.timestampSec,
      description: f.description,
      detectedText: f.detectedText,
    })),
  ].sort((a, b) => a.t - b.t);
}

function timelineEntryToText(entry: TimelineEntry): string {
  if (entry.kind === 'audio') {
    return `[${entry.t.toFixed(1)}s–${entry.endTime.toFixed(1)}s] AUDIO${entry.speaker ? ` | ${entry.speaker}` : ''}: ${entry.text}`;
  }
  const visual = entry.detectedText
    ? `${entry.description} | On-screen text: "${entry.detectedText}"`
    : entry.description;
  return `[${entry.t.toFixed(1)}s] VISUAL: ${visual}`;
}

/**
 * Build a unified timeline string that interleaves audio transcript segments
 * and visual frame analyses ordered by timestamp.
 * When no frame analyses are available, falls back to transcript-only format.
 */
function buildTimelineText(
  segments: TranscriptSegment[],
  frameAnalyses: FrameAnalysis[],
): string {
  if (frameAnalyses.length === 0) {
    return buildTranscriptText(segments);
  }
  return buildTimelineEntries(segments, frameAnalyses).map(timelineEntryToText).join('\n');
}

function uniqueSpeakers(segments: TranscriptSegment[]): string[] {
  return [...new Set(segments.map(segment => segment.speaker?.trim()).filter(Boolean) as string[])];
}

function detectMediaContentType(
  segments: TranscriptSegment[],
  frameAnalyses: FrameAnalysis[],
): MediaContentType {
  const transcriptText = normalizeTextForMatch(segments.map(segment => segment.text).join(' '));
  const visualText = normalizeTextForMatch(
    frameAnalyses.map(frame => [frame.description, frame.detectedText || ''].join(' ')).join(' '),
  );
  const speakers = uniqueSpeakers(segments);
  const zoomLikeVisual = /\b(zoom|google meet|meet|microsoft teams|teams|participant|gallery view|speaker view|waiting room|screen share|shared screen|mute|unmute|recording in progress)\b/.test(visualText);
  const zoomLikeTranscript = /\b(can you hear me|you re on mute|you are on mute|screen share|sharing my screen|joining from|recording in progress|drop in the chat|put it in the chat|let s get started|thanks everyone for joining)\b/.test(transcriptText);

  if (/\bsubscribe\b|\bepisode\b|\bpodcast\b|\bhost\b/.test(transcriptText)) {
    return 'podcast';
  }
  if (zoomLikeVisual || (zoomLikeTranscript && speakers.length >= 2)) {
    return 'video_call';
  }
  if ((/\binterview\b|\bguest\b|\bquestion\b/.test(transcriptText) && speakers.length >= 2) || /\bq and a\b/.test(transcriptText)) {
    return 'interview';
  }
  if (/\baction item\b|\bnext step\b|\bowner\b|\bfollow up\b|\bdeadline\b/.test(transcriptText)) {
    return 'meeting';
  }
  if (/\bwebinar\b|\battendees\b|\bthank you for joining\b/.test(transcriptText)) {
    return 'webinar';
  }
  if (/\bhow to\b|\btutorial\b|\bstep by step\b|\bwalkthrough\b/.test(transcriptText)) {
    return 'tutorial';
  }
  if (/\bslide\b|\bchart\b|\bdashboard\b|\broadmap\b/.test(visualText) || /\bpresentation\b|\bdeck\b/.test(transcriptText)) {
    return 'presentation';
  }
  return 'general_video';
}

function buildCandidateMoments(
  segments: TranscriptSegment[],
  frameAnalyses: FrameAnalysis[],
): PromptCandidateMoment[] {
  const candidates: PromptCandidateMoment[] = [];
  const actionPattern = /\b(action item|next step|follow up|owner|deadline|ship|review|send|schedule|prepare|publish|edit|approve|finalize)\b/i;
  const strongMomentPattern = /\b(important|key|biggest|main|turning point|decision|conclusion|reveal|launch|problem|risk)\b/i;
  const visualPattern = /\b(chart|graph|slide|demo|ui|dashboard|screen|table|comparison)\b/i;

  for (const segment of segments) {
    if (actionPattern.test(segment.text)) {
      candidates.push({
        type: 'spoken_action',
        timestampSec: segment.startTime,
        endTimeSec: segment.endTime,
        evidence: limitText(segment.text, 180),
        rationale: 'Contains explicit action-oriented language.',
      });
      continue;
    }

    if (strongMomentPattern.test(segment.text)) {
      candidates.push({
        type: 'spoken_highlight',
        timestampSec: segment.startTime,
        endTimeSec: segment.endTime,
        evidence: limitText(segment.text, 180),
        rationale: 'Contains high-signal language that often marks a highlight or decision point.',
      });
    }
  }

  for (const frame of frameAnalyses) {
    const visualEvidence = [frame.description, frame.detectedText || ''].filter(Boolean).join(' | ');
    if (!visualPattern.test(visualEvidence)) continue;

    candidates.push({
      type: 'visual_change',
      timestampSec: frame.timestampSec,
      evidence: limitText(visualEvidence, 180),
      rationale: 'Visual context suggests a meaningful chart, slide, demo, or UI transition.',
    });
  }

  return candidates
    .sort((a, b) => a.timestampSec - b.timestampSec)
    .slice(0, 12);
}

function buildPromptPayload(
  timelineEntries: string[],
  segments: TranscriptSegment[],
  frameAnalyses: FrameAnalysis[],
  batchIndex: number,
  totalBatches: number,
  speakerAttributionStrategy: 'provided' | 'heuristic_dialogue' | 'single_speaker_default' | 'none' = 'none',
  intelligenceMode: MediaIntelligenceMode = 'balanced',
): PromptPayload {
  const durationHintSec = Math.max(
    segments[segments.length - 1]?.endTime ?? 0,
    frameAnalyses[frameAnalyses.length - 1]?.timestampSec ?? 0,
  );
  const profile = getMediaIntelligenceProfile(intelligenceMode);

  return {
    objective: profile.objective,
    media_type: detectMediaContentType(segments, frameAnalyses),
    analysis_mode: profile.analysisMode,
    speaker_context: buildSpeakerContext(segments, frameAnalyses, speakerAttributionStrategy),
    batch_context: {
      batch_index: batchIndex,
      total_batches: totalBatches,
      duration_hint_sec: durationHintSec,
      transcript_segments: segments.length,
      visual_events: frameAnalyses.length,
      speakers_detected: uniqueSpeakers(segments).length,
      has_visual_context: frameAnalyses.length > 0,
    },
    evidence_rules: [
      'Only produce insights grounded in the provided timeline entries.',
      'Prefer exact timestamps over broad approximations.',
      'Only create action_items when the evidence supports a real task or next step.',
      'Use visual evidence only when it materially changes understanding of the moment.',
      'Avoid redundant highlights and repetitive topics.',
      ...profile.evidenceRules,
      'Visible name labels and active speaker hints from video frames are supporting evidence only. Use them to improve attribution, but do not invent identities that are not visually supported.',
      speakerAttributionStrategy === 'heuristic_dialogue'
        ? 'Speaker labels are inferred dialogue turns. Use them to separate viewpoints, but do not invent names or claim exact identities.'
        : speakerAttributionStrategy === 'single_speaker_default'
        ? 'A single speaker label was applied to preserve attribution structure. Do not assume there are multiple speakers unless the evidence shows it.'
        : 'When speaker labels are present, preserve attribution of quotes, decisions, and action items.',
      ...profile.outputInstructions,
    ],
    candidate_moments: buildCandidateMoments(segments, frameAnalyses),
    timeline_entries: timelineEntries,
  };
}

function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(value));
}

function chunkTranscriptSegments(
  segments: TranscriptSegment[],
  policy: MediaChunkingPolicy,
): TranscriptSegment[][] {
  const chunks: TranscriptSegment[][] = [];
  let currentChunk: TranscriptSegment[] = [];
  let currentChars = 0;

  for (const segment of segments) {
    const segmentLine = `[${segment.startTime.toFixed(1)}s–${segment.endTime.toFixed(1)}s] ${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`;
    const nextChars = currentChars + segmentLine.length + 1;
    const currentDuration =
      currentChunk.length > 0
        ? (currentChunk[currentChunk.length - 1].endTime - currentChunk[0].startTime)
        : 0;
    const previousSegment = currentChunk[currentChunk.length - 1];
    const gapSincePrevious = previousSegment ? Math.max(0, segment.startTime - previousSegment.endTime) : 0;
    const speakerChanged = Boolean(previousSegment?.speaker && segment.speaker && previousSegment.speaker !== segment.speaker);
    const startsNewThought = policy.favorTopicShiftPhrases && matchesAnyPattern(segment.text, policy.topicShiftPatterns);
    const shouldFlush =
      currentChunk.length > 0 &&
      (
        currentChunk.length >= MAX_SEGMENTS_PER_REQUEST
        || nextChars > MAX_TRANSCRIPT_CHARS_PER_REQUEST
        || currentDuration >= policy.maxDurationSec
        || (
          currentDuration >= policy.targetDurationSec
          && (startsNewThought || (policy.favorSpeakerTransitions && speakerChanged) || gapSincePrevious >= policy.transcriptBreakGapSec)
        )
        || (
          currentDuration >= policy.minNaturalChunkDurationSec
          && gapSincePrevious >= policy.transcriptBreakGapSec
        )
      );

    if (shouldFlush) {
      chunks.push(currentChunk);
      const overlap = currentChunk
        .filter(item => item.speaker || item.text.length > 0)
        .slice(-policy.overlapAudioSegments);
      currentChunk = [...overlap];
      currentChars = currentChunk.reduce((total, item) => {
        const line = `[${item.startTime.toFixed(1)}s–${item.endTime.toFixed(1)}s] ${item.speaker ? `${item.speaker}: ` : ''}${item.text}`;
        return total + line.length + 1;
      }, 0);
    }

    currentChunk.push(segment);
    currentChars += segmentLine.length + 1;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function chunkTimelineEntries(entries: TimelineEntry[], policy: MediaChunkingPolicy): TimelineEntry[][] {
  const chunks: TimelineEntry[][] = [];
  let currentChunk: TimelineEntry[] = [];
  let currentChars = 0;

  for (const entry of entries) {
    const line = timelineEntryToText(entry);
    const nextChars = currentChars + line.length + 1;
    const previousEntry = currentChunk[currentChunk.length - 1];
    const currentDuration =
      currentChunk.length > 0
        ? entryTimeEnd(currentChunk[currentChunk.length - 1]) - currentChunk[0].t
        : 0;
    const gapSincePrevious = previousEntry ? Math.max(0, entry.t - entryTimeEnd(previousEntry)) : 0;
    const shouldFlush =
      currentChunk.length > 0 &&
      (
        currentChunk.length >= MAX_TIMELINE_ENTRIES_PER_REQUEST
        || nextChars > MAX_TRANSCRIPT_CHARS_PER_REQUEST
        || currentDuration >= policy.maxDurationSec
        || (
          currentDuration >= policy.targetDurationSec
          && isNaturalTimelineBoundary(previousEntry, entry, policy)
        )
        || (
          currentDuration >= policy.minNaturalChunkDurationSec
          && gapSincePrevious >= policy.naturalBreakGapSec
        )
      );

    if (shouldFlush) {
      chunks.push(currentChunk);
      const overlap = currentChunk.filter(item => item.kind === 'audio').slice(-policy.overlapAudioSegments);
      currentChunk = [...overlap];
      currentChars = currentChunk.reduce((total, item) => total + timelineEntryToText(item).length + 1, 0);
    }

    currentChunk.push(entry);
    currentChars += line.length + 1;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function entryTimeEnd(entry: TimelineEntry): number {
  return entry.kind === 'audio' ? entry.endTime : entry.t;
}

function isMeaningfulVisualBoundary(
  entry: Extract<TimelineEntry, { kind: 'visual' }>,
  policy: MediaChunkingPolicy,
): boolean {
  const visualText = `${entry.description} ${entry.detectedText || ''}`.toLowerCase();
  return policy.favorVisualTransitions && matchesAnyPattern(visualText, policy.visualBoundaryPatterns);
}

function isAudioShiftBoundary(
  entry: Extract<TimelineEntry, { kind: 'audio' }>,
  policy: MediaChunkingPolicy,
): boolean {
  return policy.favorTopicShiftPhrases && matchesAnyPattern(entry.text, policy.topicShiftPatterns);
}

function isNaturalTimelineBoundary(
  previousEntry: TimelineEntry | undefined,
  currentEntry: TimelineEntry,
  policy: MediaChunkingPolicy,
): boolean {
  if (!previousEntry) return false;

  const gapSincePrevious = Math.max(0, currentEntry.t - entryTimeEnd(previousEntry));
  if (gapSincePrevious >= policy.naturalBreakGapSec) {
    return true;
  }

  if (currentEntry.kind === 'visual' && isMeaningfulVisualBoundary(currentEntry, policy)) {
    return true;
  }

  if (currentEntry.kind === 'audio' && isAudioShiftBoundary(currentEntry, policy)) {
    return true;
  }

  if (
    previousEntry.kind === 'audio'
    && currentEntry.kind === 'audio'
    && policy.favorSpeakerTransitions
    && previousEntry.speaker
    && currentEntry.speaker
    && previousEntry.speaker !== currentEntry.speaker
    && gapSincePrevious >= 4
  ) {
    return true;
  }

  return false;
}

function isUsableKey(value?: string | null): value is string {
  return Boolean(value && value.trim().length > 0 && !value.includes('PLACEHOLDER'));
}

function isRetryableGroqRateLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('rate_limit_exceeded') || message.includes('Rate limit reached');
}

function parseRetryAfterMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/try again in\s+(\d+)ms/i);
  if (!match) return null;
  return Number(match[1]);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function resolveProvider(
  userApiKeys?: Record<string, string>,
  preferredModel?: string,
): {
  provider: 'groq' | 'openai' | 'anthropic';
  apiKey: string;
  model: string;
} | null {
  const openaiKey = userApiKeys?.openai || config.openaiApiKey;
  const groqKey = userApiKeys?.groq || config.groqApiKey;
  const anthropicKey = userApiKeys?.anthropic || config.anthropicApiKey;

  if (isUsableKey(groqKey)) {
    const model =
      preferredModel && (MEDIA_INSIGHT_MODELS.groq as readonly string[]).includes(preferredModel)
        ? preferredModel
        : 'llama-3.1-8b-instant';
    return { provider: 'groq', apiKey: groqKey, model };
  }
  if (isUsableKey(openaiKey)) {
    const model =
      preferredModel && (MEDIA_INSIGHT_MODELS.openai as readonly string[]).includes(preferredModel)
        ? preferredModel
        : 'gpt-4o-mini';
    return { provider: 'openai', apiKey: openaiKey, model };
  }
  if (isUsableKey(anthropicKey)) {
    const model =
      preferredModel && (MEDIA_INSIGHT_MODELS.anthropic as readonly string[]).includes(preferredModel)
        ? preferredModel
        : 'claude-haiku-4-5-20251001';
    return { provider: 'anthropic', apiKey: anthropicKey, model };
  }
  return null;
}

async function generateWithGroq(
  systemPrompt: string,
  userContent: string,
  apiKey: string,
  model: string,
): Promise<{ raw: string; usage: { prompt: number; completion: number } }> {
  const client = new Groq({ apiKey });
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  return {
    raw: response.choices[0]?.message?.content ?? '{}',
    usage: {
      prompt: response.usage?.prompt_tokens ?? 0,
      completion: response.usage?.completion_tokens ?? 0,
    },
  };
}

async function generateWithOpenAI(
  systemPrompt: string,
  userContent: string,
  apiKey: string,
  model: string,
): Promise<{ raw: string; usage: { prompt: number; completion: number } }> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });
  return {
    raw: response.choices[0].message.content ?? '{}',
    usage: {
      prompt: response.usage?.prompt_tokens ?? 0,
      completion: response.usage?.completion_tokens ?? 0,
    },
  };
}

async function generateWithAnthropic(
  systemPrompt: string,
  userContent: string,
  apiKey: string,
  model: string,
): Promise<{ raw: string; usage: { prompt: number; completion: number } }> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });
  const text = response.content.find(b => b.type === 'text')?.text ?? '{}';
  // Strip markdown code fences if present
  const raw = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return {
    raw,
    usage: {
      prompt: response.usage.input_tokens,
      completion: response.usage.output_tokens,
    },
  };
}

async function generateRawInsights(
  systemPrompt: string,
  userContent: string,
  provider: 'groq' | 'openai' | 'anthropic',
  apiKey: string,
  model: string,
): Promise<{ raw: string; usage: { prompt: number; completion: number } }> {
  for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt += 1) {
    try {
      return provider === 'groq'
        ? await generateWithGroq(systemPrompt, userContent, apiKey, model)
        : provider === 'openai'
        ? await generateWithOpenAI(systemPrompt, userContent, apiKey, model)
        : await generateWithAnthropic(systemPrompt, userContent, apiKey, model);
    } catch (error) {
      if (provider !== 'groq' || !isRetryableGroqRateLimit(error) || attempt === GROQ_MAX_RETRIES) {
        throw error;
      }

      const retryAfterMs = parseRetryAfterMs(error) ?? 250 * (attempt + 1);
      logger.warn(`Groq rate limit hit for ${model}; retrying in ${retryAfterMs}ms (attempt ${attempt + 1}/${GROQ_MAX_RETRIES + 1})`);
      await delay(retryAfterMs);
    }
  }

  throw new Error(`Failed to generate media insights for ${provider}/${model}`);
}

function parseInsights(
  raw: string,
  model: string,
  usage: { prompt: number; completion: number },
): MediaInsight[] {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn('Insight generation returned non-JSON, skipping parse');
    return [];
  }

  const insights: MediaInsight[] = [];
  const meta = { model, promptTokens: usage.prompt, completionTokens: usage.completion };

  function safeTitle(value: unknown): string | null {
    const s = typeof value === 'string' ? value.trim() : null;
    return s && s.length > 0 ? s : null;
  }

  function safeDescription(value: unknown): string | undefined {
    const s = typeof value === 'string' ? value.trim() : undefined;
    return s && s.length > 0 ? s : undefined;
  }

  function safeTags(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map(t => t.trim());
  }

  function safeTime(value: unknown): number | undefined {
    if (value == null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  function safeScore(value: unknown): number | undefined {
    if (value == null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : undefined;
  }

  const summaryTitle = safeTitle(parsed.summary?.title);
  if (summaryTitle) {
    insights.push({
      insightType: 'summary',
      title: summaryTitle,
      description: safeDescription(parsed.summary.description),
      tags: safeTags(parsed.summary.tags),
      metadata: meta,
    });
  }

  for (const h of Array.isArray(parsed.highlights) ? parsed.highlights : []) {
    const title = safeTitle(h?.title);
    if (!title) continue;
    insights.push({
      insightType: 'highlight',
      title,
      description: safeDescription(h.description),
      startTime: safeTime(h.startTime),
      endTime: safeTime(h.endTime),
      score: safeScore(h.score),
      tags: safeTags(h.tags),
      metadata: meta,
    });
  }

  for (const k of Array.isArray(parsed.key_moments) ? parsed.key_moments : []) {
    const title = safeTitle(k?.title);
    if (!title) continue;
    insights.push({
      insightType: 'key_moment',
      title,
      description: safeDescription(k.description),
      startTime: safeTime(k.startTime),
      endTime: safeTime(k.endTime),
      score: safeScore(k.score),
      tags: safeTags(k.tags),
      metadata: meta,
    });
  }

  for (const t of Array.isArray(parsed.topics) ? parsed.topics : []) {
    const title = safeTitle(t?.title);
    if (!title) continue;
    insights.push({
      insightType: 'topic',
      title,
      description: safeDescription(t.description),
      tags: safeTags(t.tags),
      metadata: meta,
    });
  }

  for (const a of Array.isArray(parsed.action_items) ? parsed.action_items : []) {
    const title = safeTitle(a?.title);
    if (!title) continue;
    insights.push({
      insightType: 'action_item',
      title,
      description: safeDescription(a.description),
      tags: safeTags(a.tags),
      metadata: meta,
    });
  }

  return insights;
}

function normalizeText(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function limitText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function dedupeInsights(insights: MediaInsight[]): MediaInsight[] {
  const seen = new Set<string>();
  const deduped: MediaInsight[] = [];

  for (const insight of insights) {
    const key = [
      insight.insightType,
      normalizeText(insight.title),
      normalizeText(insight.description),
      insight.startTime?.toFixed(1) ?? '',
      insight.endTime?.toFixed(1) ?? '',
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(insight);
  }

  return deduped;
}

function clampTime(value: number | undefined, min: number, max: number): number | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return Math.min(Math.max(value, min), max);
}

function findNearestSegmentBoundary(
  seconds: number | undefined,
  segments: TranscriptSegment[],
  boundary: 'start' | 'end',
): number | undefined {
  if (seconds === undefined || segments.length === 0) return seconds;

  let nearest = boundary === 'start' ? segments[0].startTime : segments[0].endTime;
  let minDelta = Math.abs(seconds - nearest);

  for (const segment of segments) {
    const candidate = boundary === 'start' ? segment.startTime : segment.endTime;
    const delta = Math.abs(seconds - candidate);
    const isBetterTieBreak =
      delta === minDelta
      && (
        (boundary === 'start' && candidate <= seconds && candidate > nearest)
        || (boundary === 'end' && candidate >= seconds && candidate > nearest)
      );
    if (delta < minDelta || isBetterTieBreak) {
      minDelta = delta;
      nearest = candidate;
    }
  }

  return nearest;
}

function calculateLexicalOverlap(needle: string, haystack: string): number {
  const needleTerms = new Set(normalizeTextForMatch(needle).split(' ').filter(term => term.length > 2));
  const haystackTerms = new Set(normalizeTextForMatch(haystack).split(' ').filter(term => term.length > 2));

  if (needleTerms.size === 0 || haystackTerms.size === 0) {
    return 0;
  }

  let matches = 0;
  needleTerms.forEach(term => {
    if (haystackTerms.has(term)) matches += 1;
  });
  return matches / needleTerms.size;
}

function normalizeInsightAgainstEvidence(
  insight: MediaInsight,
  segments: TranscriptSegment[],
  frameAnalyses: FrameAnalysis[],
  intelligenceMode: MediaIntelligenceMode,
): MediaInsight | null {
  const minTime = Math.min(
    segments[0]?.startTime ?? 0,
    frameAnalyses[0]?.timestampSec ?? Number.POSITIVE_INFINITY,
  );
  const maxTime = Math.max(
    segments[segments.length - 1]?.endTime ?? 0,
    frameAnalyses[frameAnalyses.length - 1]?.timestampSec ?? 0,
  );
  const evidenceText = [
    ...segments.map(segment => segment.text),
    ...frameAnalyses.map(frame => [frame.description, frame.detectedText || ''].filter(Boolean).join(' ')),
  ].join(' ');

  let startTime = clampTime(insight.startTime, Number.isFinite(minTime) ? minTime : 0, maxTime);
  let endTime = clampTime(insight.endTime, Number.isFinite(minTime) ? minTime : 0, maxTime);

  if (insight.insightType === 'highlight' || insight.insightType === 'key_moment') {
    startTime = findNearestSegmentBoundary(startTime, segments, 'start');
    endTime = findNearestSegmentBoundary(endTime, segments, 'end');
    if (startTime === undefined || endTime === undefined) {
      return null;
    }
    if (endTime < startTime) {
      // swap inverted times rather than collapsing to a point
      [startTime, endTime] = [endTime, startTime];
    }
    // Reject zero-length clips — they represent no clippable content
    if (endTime === startTime) {
      return null;
    }
  } else {
    startTime = undefined;
    endTime = undefined;
  }

  const score = insight.score === undefined ? undefined : Math.min(Math.max(insight.score, 0), 1);
  const normalizedTitle = insight.title.trim();
  const normalizedDescription = insight.description?.trim();

  if (!normalizedTitle) {
    return null;
  }

  if (insight.insightType === 'action_item') {
    const overlap = calculateLexicalOverlap(`${normalizedTitle} ${normalizedDescription || ''}`, evidenceText);
    const actionPattern = /\b(review|send|share|schedule|prepare|publish|edit|approve|finali[sz]e|follow up|assign|ship|update)\b/i;
    if (overlap < 0.2 && !actionPattern.test(`${normalizedTitle} ${normalizedDescription || ''}`)) {
      return null;
    }
  }

  return {
    ...insight,
    title: normalizedTitle,
    description: normalizedDescription,
    startTime,
    endTime,
    score,
    tags: [...new Set(insight.tags.map(tag => tag.trim()).filter(Boolean))].slice(0, 8),
    metadata: {
      ...insight.metadata,
      intelligenceMode,
    },
  };
}

function postprocessInsights(
  insights: MediaInsight[],
  segments: TranscriptSegment[],
  frameAnalyses: FrameAnalysis[],
  intelligenceMode: MediaIntelligenceMode,
): MediaInsight[] {
  const normalized = dedupeInsights(
    insights
      .map(insight => normalizeInsightAgainstEvidence(insight, segments, frameAnalyses, intelligenceMode))
      .filter((insight): insight is MediaInsight => Boolean(insight)),
  );

  return rankInsightsForMode(normalized, intelligenceMode);
}

function topTags(insights: MediaInsight[], limit: number): string[] {
  const counts = new Map<string, number>();

  for (const insight of insights) {
    for (const tag of insight.tags) {
      const normalized = tag.trim();
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function buildMergedSummary(
  summaries: MediaInsight[],
  allInsights: MediaInsight[],
  model: string,
  usage: { prompt: number; completion: number },
): MediaInsight | null {
  if (summaries.length === 0) return null;

  const summaryDescriptions = summaries
    .map(summary => summary.description || summary.title)
    .filter(Boolean)
    .slice(0, 3);

  const description = limitText(summaryDescriptions.join(' '), 420);
  const tags = topTags(allInsights, 6);

  return {
    insightType: 'summary',
    title: summaries[0].title || 'Media Overview',
    description,
    tags,
    metadata: {
      model,
      promptTokens: usage.prompt,
      completionTokens: usage.completion,
    },
  };
}

function modeTextWeight(insight: MediaInsight, mode: MediaIntelligenceMode): number {
  const text = `${insight.title} ${insight.description || ''} ${insight.tags.join(' ')}`.toLowerCase();

  switch (mode) {
    case 'conversation':
      if (insight.insightType === 'action_item' && /\b(follow up|owner|deadline|review|share|schedule|send|assign|next step)\b/.test(text)) return 0.2;
      if ((insight.insightType === 'highlight' || insight.insightType === 'key_moment') && /\b(decision|decide|agreed|agreement|resolved|question|clarif|pivot|issue|risk|follow up|owner)\b/.test(text)) return 0.2;
      if (insight.insightType === 'topic' && /\b(discussion|decision|timeline|risk|question|clarification|follow up)\b/.test(text)) return 0.15;
      return 0;
    case 'sales':
      if ((insight.insightType === 'highlight' || insight.insightType === 'key_moment') && /\b(price|pricing|budget|cost|discount|procurement|security|pilot|proposal|timeline|buy|purchase|interested|objection|concern|hesitant)\b/.test(text)) return 0.22;
      if (insight.insightType === 'action_item' && /\b(proposal|follow up|schedule|send|share|next step|pilot|security|pricing|contract)\b/.test(text)) return 0.2;
      if (insight.insightType === 'topic' && /\b(pricing|budget|security|pilot|adoption|procurement|roi|timeline)\b/.test(text)) return 0.15;
      return 0;
    case 'creator':
      if ((insight.insightType === 'highlight' || insight.insightType === 'key_moment') && /\b(hook|surpris|story|clip|quote|quotable|reveal|viral|audience|lesson|takeaway)\b/.test(text)) return 0.22;
      if (insight.insightType === 'topic' && /\b(audience|story|lesson|trend|framework|hook|creator|clip)\b/.test(text)) return 0.15;
      return 0;
    default:
      return 0;
  }
}

function sortInsightsByMode(insights: MediaInsight[], mode: MediaIntelligenceMode): MediaInsight[] {
  return [...insights].sort((a, b) => {
    const aScore = (a.score ?? 0) + modeTextWeight(a, mode);
    const bScore = (b.score ?? 0) + modeTextWeight(b, mode);
    const scoreDelta = bScore - aScore;
    if (scoreDelta !== 0) return scoreDelta;
    return (a.startTime ?? Number.MAX_SAFE_INTEGER) - (b.startTime ?? Number.MAX_SAFE_INTEGER);
  });
}

function rankInsightsForMode(insights: MediaInsight[], intelligenceMode: MediaIntelligenceMode): MediaInsight[] {
  const summaries = insights.filter(insight => insight.insightType === 'summary');
  const highlights = sortInsightsByMode(insights.filter(insight => insight.insightType === 'highlight'), intelligenceMode);
  const keyMoments = sortInsightsByMode(insights.filter(insight => insight.insightType === 'key_moment'), intelligenceMode);
  const topics = sortInsightsByMode(insights.filter(insight => insight.insightType === 'topic'), intelligenceMode);
  const actionItems = sortInsightsByMode(insights.filter(insight => insight.insightType === 'action_item'), intelligenceMode);

  return [
    ...summaries,
    ...highlights,
    ...keyMoments,
    ...topics,
    ...actionItems,
  ];
}

function mergeChunkInsights(
  chunkInsights: MediaInsight[],
  model: string,
  usage: { prompt: number; completion: number },
  intelligenceMode: MediaIntelligenceMode,
): MediaInsight[] {
  const deduped = dedupeInsights(chunkInsights);
  const summaries = deduped.filter(insight => insight.insightType === 'summary');
  const highlights = sortInsightsByMode(deduped.filter(insight => insight.insightType === 'highlight'), intelligenceMode).slice(0, MAX_HIGHLIGHTS);
  const keyMoments = sortInsightsByMode(deduped.filter(insight => insight.insightType === 'key_moment'), intelligenceMode).slice(0, MAX_KEY_MOMENTS);
  const topics = sortInsightsByMode(deduped.filter(insight => insight.insightType === 'topic'), intelligenceMode).slice(0, MAX_TOPICS);
  const actionItems = sortInsightsByMode(deduped.filter(insight => insight.insightType === 'action_item'), intelligenceMode).slice(0, MAX_ACTION_ITEMS);
  const summary = buildMergedSummary(summaries, deduped, model, usage);

  return [
    ...(summary ? [summary] : []),
    ...highlights,
    ...keyMoments,
    ...topics,
    ...actionItems,
  ];
}

interface ChunkSynthesisPayload {
  objective: string;
  analysis_mode: string;
  evidence_rules: string[];
  chunk_summaries: Array<{
    summary?: string;
    highlights: Array<{
      title: string;
      description?: string;
      startTime?: number;
      endTime?: number;
      score?: number;
      tags: string[];
    }>;
    key_moments: Array<{
      title: string;
      description?: string;
      startTime?: number;
      endTime?: number;
      score?: number;
      tags: string[];
    }>;
    topics: Array<{
      title: string;
      description?: string;
      tags: string[];
    }>;
    action_items: Array<{
      title: string;
      description?: string;
      tags: string[];
    }>;
  }>;
}

function buildSynthesisPayload(
  chunkedInsights: MediaInsight[][],
  intelligenceMode: MediaIntelligenceMode,
): ChunkSynthesisPayload {
  const profile = getMediaIntelligenceProfile(intelligenceMode);

  return {
    objective: profile.objective,
    analysis_mode: profile.analysisMode,
    evidence_rules: [
      ...profile.evidenceRules,
      ...profile.outputInstructions,
      'Choose the strongest whole-asset view instead of repeating every chunk-level finding.',
      'Preserve timestamped moments only when they remain important after cross-chunk consolidation.',
    ],
    chunk_summaries: chunkedInsights.map((insights) => ({
      summary: insights.find((insight) => insight.insightType === 'summary')?.description
        || insights.find((insight) => insight.insightType === 'summary')?.title,
      highlights: insights
        .filter((insight) => insight.insightType === 'highlight')
        .slice(0, 4)
        .map((insight) => ({
          title: insight.title,
          description: insight.description,
          startTime: insight.startTime,
          endTime: insight.endTime,
          score: insight.score,
          tags: insight.tags,
        })),
      key_moments: insights
        .filter((insight) => insight.insightType === 'key_moment')
        .slice(0, 4)
        .map((insight) => ({
          title: insight.title,
          description: insight.description,
          startTime: insight.startTime,
          endTime: insight.endTime,
          score: insight.score,
          tags: insight.tags,
        })),
      topics: insights
        .filter((insight) => insight.insightType === 'topic')
        .slice(0, 4)
        .map((insight) => ({
          title: insight.title,
          description: insight.description,
          tags: insight.tags,
        })),
      action_items: insights
        .filter((insight) => insight.insightType === 'action_item')
        .slice(0, 4)
        .map((insight) => ({
          title: insight.title,
          description: insight.description,
          tags: insight.tags,
        })),
    })),
  };
}

async function synthesizeChunkInsights(
  chunkedInsights: MediaInsight[][],
  provider: 'groq' | 'openai' | 'anthropic',
  apiKey: string,
  model: string,
  intelligenceMode: MediaIntelligenceMode,
  segments: TranscriptSegment[],
  frameAnalyses: FrameAnalysis[],
): Promise<MediaInsight[] | null> {
  if (chunkedInsights.length <= 1) {
    return null;
  }

  const payload = JSON.stringify(buildSynthesisPayload(chunkedInsights, intelligenceMode), null, 2);
  const { raw, usage } = await generateRawInsights(
    INSIGHT_SYNTHESIS_SYSTEM_PROMPT,
    `Synthesize these chunk-level media analyses into one final mode-aware result for the whole asset. Return only valid JSON.\n\n${payload}`,
    provider,
    apiKey,
    model,
  );

  const parsed = parseInsights(raw, model, usage);
  if (parsed.length === 0) {
    return null;
  }

  return postprocessInsights(parsed, segments, frameAnalyses, intelligenceMode);
}

export async function generateMediaInsights(
  segments: TranscriptSegment[],
  userApiKeys?: Record<string, string>,
  options: MediaInsightGenerationOptions = {},
): Promise<InsightGenerationResult> {
  const providerConfig = resolveProvider(userApiKeys, options.preferredModel);
  if (!providerConfig) throw new Error('No LLM API key available for insight generation');

  const { provider, apiKey, model } = providerConfig;
  const frameAnalyses = options.frameAnalyses ?? [];
  const intelligenceMode = resolveMediaIntelligenceMode(options.intelligenceMode);
  const profile = getMediaIntelligenceProfile(intelligenceMode);
  const hasVisualContext = frameAnalyses.length > 0;

  if (hasVisualContext) {
    await options.onProgress?.('building_timeline');
    const timelineChunks = chunkTimelineEntries(buildTimelineEntries(segments, frameAnalyses), profile.chunking);
    logger.info(`Generating media insights via ${provider}/${model} with combined audio+visual timeline (${segments.length} transcript segments, ${frameAnalyses.length} frames across ${timelineChunks.length} batch(es))`);
    await options.onProgress?.('generating_insights');

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    const allChunkInsights: MediaInsight[] = [];
    const chunkInsightGroups: MediaInsight[][] = [];

    for (const [index, chunk] of timelineChunks.entries()) {
      logger.info(`Generating media insight batch ${index + 1}/${timelineChunks.length} (${chunk.length} timeline entries)`);
      const chunkTimelineText = chunk.map(timelineEntryToText);
      const chunkSegments = chunk
        .filter((entry): entry is Extract<TimelineEntry, { kind: 'audio' }> => entry.kind === 'audio')
        .map((entry, sequenceIndex) => ({
          startTime: entry.t,
          endTime: entry.endTime,
          text: entry.text,
          speaker: entry.speaker,
          sequenceIndex,
          metadata: {},
        } satisfies TranscriptSegment));
      const chunkFrames = chunk
        .filter((entry): entry is Extract<TimelineEntry, { kind: 'visual' }> => entry.kind === 'visual')
        .map(entry => ({
          timestampSec: entry.t,
          description: entry.description,
          detectedText: entry.detectedText,
          objects: [],
          confidence: 0.8,
          metadata: { model: 'timeline', promptTokens: 0, completionTokens: 0 },
        } satisfies FrameAnalysis));
      const promptPayload = JSON.stringify(
        buildPromptPayload(
          chunkTimelineText,
          chunkSegments,
          chunkFrames,
          index + 1,
          timelineChunks.length,
          options.speakerAttributionStrategy ?? 'none',
          intelligenceMode,
        ),
        null,
        2,
      );
      const { raw, usage } = await generateRawInsights(
        INSIGHT_SYSTEM_PROMPT,
        `Analyse this structured media payload and return only valid JSON.\n\n${promptPayload}`,
        provider,
        apiKey,
        model,
      );
      totalPromptTokens += usage.prompt;
      totalCompletionTokens += usage.completion;
      const processedChunkInsights = postprocessInsights(parseInsights(raw, model, usage), chunkSegments, chunkFrames, intelligenceMode);
      chunkInsightGroups.push(processedChunkInsights);
      allChunkInsights.push(...processedChunkInsights);

      if (provider === 'groq' && index < timelineChunks.length - 1) {
        await delay(GROQ_BATCH_DELAY_MS);
      }
    }

    await options.onProgress?.('synthesizing_results');
    const synthesizedInsights = await synthesizeChunkInsights(
      chunkInsightGroups,
      provider,
      apiKey,
      model,
      intelligenceMode,
      segments,
      frameAnalyses,
    );

    const insights =
      timelineChunks.length === 1
        ? postprocessInsights(allChunkInsights, segments, frameAnalyses, intelligenceMode)
        : synthesizedInsights
          ? synthesizedInsights
        : postprocessInsights(mergeChunkInsights(allChunkInsights, model, {
            prompt: totalPromptTokens,
            completion: totalCompletionTokens,
          }, intelligenceMode), segments, frameAnalyses, intelligenceMode);

    logger.info(`Generated ${insights.length} insights from combined audio+visual timeline`);
    return { insights, provider, model };
  }

  await options.onProgress?.('building_timeline');
  const transcriptChunks = chunkTranscriptSegments(segments, profile.chunking);

  logger.info(`Generating media insights via ${provider}/${model} (${segments.length} segments across ${transcriptChunks.length} batch(es))`);
  await options.onProgress?.('generating_insights');

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  const allChunkInsights: MediaInsight[] = [];
  const chunkInsightGroups: MediaInsight[][] = [];

  for (const [index, chunk] of transcriptChunks.entries()) {
    logger.info(`Generating media insight batch ${index + 1}/${transcriptChunks.length} (${chunk.length} segments)`);
    const promptPayload = JSON.stringify(
      buildPromptPayload(
        chunk.map(segment => `[${segment.startTime.toFixed(1)}s–${segment.endTime.toFixed(1)}s] AUDIO${segment.speaker ? ` | ${segment.speaker}` : ''}: ${segment.text}`),
        chunk,
        [],
        index + 1,
        transcriptChunks.length,
        options.speakerAttributionStrategy ?? 'none',
        intelligenceMode,
      ),
      null,
      2,
    );

    const { raw, usage } = await generateRawInsights(
      INSIGHT_SYSTEM_PROMPT,
      `Analyse this structured media payload and return only valid JSON.\n\n${promptPayload}`,
      provider,
      apiKey,
      model,
    );
    totalPromptTokens += usage.prompt;
    totalCompletionTokens += usage.completion;
    const processedChunkInsights = postprocessInsights(parseInsights(raw, model, usage), chunk, [], intelligenceMode);
    chunkInsightGroups.push(processedChunkInsights);
    allChunkInsights.push(...processedChunkInsights);

    if (provider === 'groq' && index < transcriptChunks.length - 1) {
      await delay(GROQ_BATCH_DELAY_MS);
    }
  }

  await options.onProgress?.('synthesizing_results');
  const synthesizedInsights = await synthesizeChunkInsights(
    chunkInsightGroups,
    provider,
    apiKey,
    model,
    intelligenceMode,
    segments,
    [],
  );

  const insights =
    transcriptChunks.length === 1
      ? postprocessInsights(allChunkInsights, segments, [], intelligenceMode)
      : synthesizedInsights
        ? synthesizedInsights
      : postprocessInsights(mergeChunkInsights(allChunkInsights, model, {
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
        }, intelligenceMode), segments, [], intelligenceMode);

  logger.info(`Generated ${insights.length} insights (${provider}/${model}) across ${transcriptChunks.length} batch(es)`);

  return { insights, provider, model };
}
