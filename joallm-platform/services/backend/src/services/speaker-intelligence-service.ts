import type { TranscriptSegment } from './transcription-service.js';

export type SpeakerAttributionStrategy =
  | 'provided'
  | 'heuristic_dialogue'
  | 'single_speaker_default'
  | 'none';

export interface SpeakerTurn {
  speaker: string;
  startTime: number;
  endTime: number;
  confidence: number;
  strategy: SpeakerAttributionStrategy;
}

export interface SpeakerEnrichmentResult {
  segments: TranscriptSegment[];
  turns: SpeakerTurn[];
  speakersDetected: number;
  strategy: SpeakerAttributionStrategy;
  confidence: number;
}

interface TurnGroup {
  indices: number[];
  startTime: number;
  endTime: number;
}

const DIALOGUE_TURN_GAP_SEC = 1.25;
const MAX_DIALOGUE_SEGMENT_WORDS = 22;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasQuestionCue(text: string): boolean {
  return /\?|\b(what|why|how|when|where|who|do you|can you|could you|would you|should we)\b/i.test(text);
}

function hasAnswerCue(text: string): boolean {
  return /\b(yes|no|absolutely|definitely|i think|we should|let me|sure|exactly|right)\b/i.test(text);
}

function normalizeProvidedSpeakers(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.map(segment => ({
    ...segment,
    speaker: segment.speaker?.trim() || undefined,
  }));
}

function buildTurnsFromSpeakers(
  segments: TranscriptSegment[],
  strategy: SpeakerAttributionStrategy,
  confidence: number,
): SpeakerTurn[] {
  const turns: SpeakerTurn[] = [];

  for (const segment of segments) {
    const speaker = segment.speaker?.trim();
    if (!speaker) continue;

    const previous = turns[turns.length - 1];
    if (previous && previous.speaker === speaker && segment.startTime <= previous.endTime + 0.5) {
      previous.endTime = Math.max(previous.endTime, segment.endTime);
      previous.confidence = Math.max(previous.confidence, confidence);
      continue;
    }

    turns.push({
      speaker,
      startTime: segment.startTime,
      endTime: segment.endTime,
      confidence,
      strategy,
    });
  }

  return turns;
}

function buildTurnGroups(segments: TranscriptSegment[]): TurnGroup[] {
  const groups: TurnGroup[] = [];
  let current: TurnGroup | null = null;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const previous = index > 0 ? segments[index - 1] : null;
    const gap = previous ? segment.startTime - previous.endTime : 0;
    const startsNewTurn =
      !current
      || gap >= DIALOGUE_TURN_GAP_SEC
      || hasQuestionCue(previous?.text || '')
      || countWords(segment.text) > MAX_DIALOGUE_SEGMENT_WORDS;

    if (startsNewTurn) {
      current = {
        indices: [index],
        startTime: segment.startTime,
        endTime: segment.endTime,
      };
      groups.push(current);
      continue;
    }

    current!.indices.push(index);
    current!.endTime = segment.endTime;
  }

  return groups;
}

function detectDialogueScore(segments: TranscriptSegment[], turnGroups: TurnGroup[]): number {
  const text = segments.map(segment => segment.text).join(' ');
  const questionSegments = segments.filter(segment => hasQuestionCue(segment.text)).length;
  const answerSegments = segments.filter(segment => hasAnswerCue(segment.text)).length;
  const shortSegments = segments.filter(segment => countWords(segment.text) <= MAX_DIALOGUE_SEGMENT_WORDS).length;
  const strongDialogueKeywords = /\b(interview|guest|host|question|answer|q and a|panel|podcast)\b/i.test(text);

  let score = 0;
  if (strongDialogueKeywords) score += 0.35;
  if (questionSegments >= 2) score += 0.25;
  if (answerSegments >= 2) score += 0.15;
  if (questionSegments >= 2 && answerSegments >= 1) score += 0.15;
  if (turnGroups.length >= 6) score += 0.15;
  if (shortSegments >= Math.ceil(segments.length * 0.6)) score += 0.1;
  return Math.min(score, 0.95);
}

function applyHeuristicDialogueLabels(segments: TranscriptSegment[]): SpeakerEnrichmentResult | null {
  if (segments.length < 6) return null;

  const turnGroups = buildTurnGroups(segments);
  const dialogueScore = detectDialogueScore(segments, turnGroups);
  if (dialogueScore < 0.55 || turnGroups.length < 4) {
    return null;
  }

  const labelled = segments.map(segment => ({ ...segment }));
  const turns: SpeakerTurn[] = [];

  turnGroups.forEach((group, index) => {
    const speaker = index % 2 === 0 ? 'Speaker 1' : 'Speaker 2';
    for (const segmentIndex of group.indices) {
      labelled[segmentIndex].speaker = speaker;
    }

    turns.push({
      speaker,
      startTime: group.startTime,
      endTime: group.endTime,
      confidence: Number(Math.max(0.55, dialogueScore).toFixed(2)),
      strategy: 'heuristic_dialogue',
    });
  });

  return {
    segments: labelled,
    turns,
    speakersDetected: 2,
    strategy: 'heuristic_dialogue',
    confidence: Number(Math.max(0.55, dialogueScore).toFixed(2)),
  };
}

function applySingleSpeakerDefault(segments: TranscriptSegment[]): SpeakerEnrichmentResult {
  const labelled = segments.map(segment => ({
    ...segment,
    speaker: segment.text.trim() ? 'Speaker 1' : undefined,
  }));

  return {
    segments: labelled,
    turns: buildTurnsFromSpeakers(labelled, 'single_speaker_default', 0.4),
    speakersDetected: labelled.some(segment => segment.speaker) ? 1 : 0,
    strategy: labelled.some(segment => segment.speaker) ? 'single_speaker_default' : 'none',
    confidence: labelled.some(segment => segment.speaker) ? 0.4 : 0,
  };
}

export function enrichTranscriptSpeakers(segments: TranscriptSegment[]): SpeakerEnrichmentResult {
  const normalizedSegments = normalizeProvidedSpeakers(segments);
  const providedSpeakers = [...new Set(normalizedSegments.map(segment => segment.speaker).filter(Boolean))];

  if (providedSpeakers.length > 0) {
    return {
      segments: normalizedSegments,
      turns: buildTurnsFromSpeakers(normalizedSegments, 'provided', 0.95),
      speakersDetected: providedSpeakers.length,
      strategy: 'provided',
      confidence: 0.95,
    };
  }

  const heuristicDialogue = applyHeuristicDialogueLabels(normalizedSegments);
  if (heuristicDialogue) {
    return heuristicDialogue;
  }

  return applySingleSpeakerDefault(normalizedSegments);
}
