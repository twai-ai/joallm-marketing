import Groq, { toFile } from 'groq-sdk';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export interface TranscriptSegment {
  speaker?: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence?: number;
  lowConfidence?: boolean;
  sequenceIndex: number;
  language?: string;
  metadata: {
    words?: Array<{ word: string; start: number; end: number; confidence?: number }>;
    noSpeechProb?: number;
    avgLogprob?: number;
  };
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  language: string;
  duration: number;
  provider: 'groq';
}

const LANGUAGE_VERIFICATION_MODEL = 'llama-3.3-70b-versatile';

function hasDevanagariScript(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function normalizeLanguageLabel(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    english: 'en',
    en: 'en',
    hindi: 'hi',
    hi: 'hi',
    urdu: 'ur',
    ur: 'ur',
    hinglish: 'hi',
  };
  return aliases[normalized] || normalized;
}

export async function verifyTranscriptLanguage(
  segments: TranscriptSegment[],
  userApiKeys?: Record<string, string>,
  reportedLanguage?: string,
): Promise<string> {
  const transcriptSample = segments
    .map(segment => segment.text.trim())
    .filter(Boolean)
    .slice(0, 24)
    .join(' ')
    .trim();

  if (!transcriptSample) {
    return reportedLanguage || 'en';
  }

  if (hasDevanagariScript(transcriptSample)) {
    return 'hi';
  }

  if (hasArabicScript(transcriptSample)) {
    return 'ur';
  }

  const apiKey = resolveGroqKey(userApiKeys);
  if (!apiKey) {
    return reportedLanguage || 'en';
  }

  try {
    const client = new Groq({ apiKey });
    const response = await client.chat.completions.create({
      model: LANGUAGE_VERIFICATION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a multilingual language identification assistant. Classify the transcript language and return only strict JSON.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Identify the spoken language of this transcript. Pay special attention to Hindi vs Urdu. Use transcript evidence, lexical choice, and script clues. If text is romanized Hindi/Urdu, choose the closest spoken language. Return one of: en, hi, ur.',
            reported_language: reportedLanguage || null,
            transcript_sample: transcriptSample,
          }),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 60,
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { language?: string };
    const verified = normalizeLanguageLabel(parsed.language);
    return verified || reportedLanguage || 'en';
  } catch (error) {
    logger.warn('Transcript language verification failed, using reported language', error);
    return reportedLanguage || 'en';
  }
}

export interface TranscriptionOptions {
  mimeType?: string;
  timeOffsetSec?: number;
  sequenceOffset?: number;
}

function resolveGroqKey(userApiKeys?: Record<string, string>): string | null {
  return userApiKeys?.groq || config.groqApiKey || null;
}

/**
 * Transcribe an audio file using Groq Whisper.
 * Accepts a Buffer (audio content) and the original filename for MIME detection.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  userApiKeys?: Record<string, string>,
  options: TranscriptionOptions = {},
): Promise<TranscriptionResult> {
  const apiKey = resolveGroqKey(userApiKeys);
  if (!apiKey) throw new Error('No Groq API key available for transcription');

  const client = new Groq({ apiKey });
  const mimeType = options.mimeType
    || (filename.endsWith('.mp3') ? 'audio/mpeg'
      : filename.endsWith('.flac') ? 'audio/flac'
      : 'audio/wav');
  const timeOffsetSec = options.timeOffsetSec ?? 0;
  const sequenceOffset = options.sequenceOffset ?? 0;

  logger.info(`Transcribing audio: ${filename} (${audioBuffer.length} bytes)`);

  const file = await toFile(audioBuffer, filename, { type: mimeType });

  const response = await client.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  const rawSegments: any[] = (response as any).segments ?? [];
  const language: string = (response as any).language ?? 'en';
  const duration: number = (response as any).duration ?? 0;

  const segments: TranscriptSegment[] = rawSegments.map((seg: any, idx: number) => {
    const confidence = seg.avg_logprob != null ? Math.exp(seg.avg_logprob) : undefined;
    const noSpeechProb: number = seg.no_speech_prob ?? 0;
    // Mark segment as low-confidence when Whisper signals likely silence/noise or poor transcription
    const lowConfidence = (noSpeechProb > 0.6) || (confidence !== undefined && confidence < 0.4);
    return {
      startTime: (seg.start ?? 0) + timeOffsetSec,
      endTime: (seg.end ?? 0) + timeOffsetSec,
      text: (seg.text ?? '').trim(),
      confidence,
      lowConfidence,
      sequenceIndex: sequenceOffset + idx,
      language,
      metadata: {
        noSpeechProb,
        avgLogprob: seg.avg_logprob,
      },
    };
  });

  logger.info(`Transcription complete: ${segments.length} segments, language=${language}, duration=${duration}s`);

  return { segments, language, duration: duration + timeOffsetSec, provider: 'groq' };
}
