import Groq from 'groq-sdk';
import * as fs from 'fs/promises';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export interface FrameAnalysis {
  timestampSec: number;
  description: string;
  objects: string[];
  detectedText: string | null;
  confidence: number;
  metadata: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    meetingLayout?: 'gallery' | 'speaker' | 'screen_share' | 'single_person' | 'unknown';
    peopleCount?: number;
    visibleNameLabels?: string[];
    activeSpeakerHint?: string | null;
  };
}

// Vision models in preference order — all on Groq, same API key.
// Llama 4 Maverick was shut down ~2026-03-09; Scout may still work; Qwen 3.6 is current vision.
const VISION_MODELS = [
  'qwen/qwen3.6-27b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
] as const;

const FRAME_ANALYSIS_PROMPT = `Analyse this video frame and respond with a JSON object:
{
  "description": "one sentence describing the scene",
  "objects": ["list", "of", "visible", "objects", "or", "elements"],
  "detected_text": "any text visible on screen, or null if none",
  "meeting_layout": "gallery | speaker | screen_share | single_person | unknown",
  "people_count": 0,
  "visible_name_labels": ["names or tile labels visible on screen"],
  "active_speaker_hint": "name or label of the person who appears to be actively speaking, or null"
}
Be concise. Focus on what would be useful for understanding a video's content: slides, charts, UI screens, people, objects, on-screen text.
If this looks like a meeting or call recording, capture visible participant names or tile labels when they are actually visible on screen.
Do not invent names; only return visible labels or strong visual cues.`;

const BATCH_DELAY_MS = 200; // stay within Groq rate limits
const MAX_FRAMES = 50;      // hard cap to control cost

function isUsableKey(value?: string | null): value is string {
  return Boolean(value && value.trim().length > 0 && !value.includes('PLACEHOLDER'));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isUnavailableVisionModelError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('decommissioned') ||
    message.includes('model_not_found') ||
    message.includes('does not exist') ||
    message.includes('do not have access')
  );
}

function isRateLimitedVisionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('rate_limit_exceeded') || message.includes('Rate limit reached');
}

/**
 * Compute a sensible frame extraction interval based on media duration.
 * Guarantees at most MAX_FRAMES frames are extracted, so FFmpeg never writes
 * more frames than we'll actually analyse — and coverage is spread across the
 * full video rather than front-loaded.
 *
 * Base intervals provide density for short content; the MAX_FRAMES floor
 * automatically widens the interval for long-form video (e.g. a 3-hour video
 * gets one frame every ~4 minutes instead of 180 frames at 60s).
 */
export function frameIntervalForDuration(durationSecs: number): number {
  const baseInterval =
    durationSecs <= 60      ? 5  :   // short clip
    durationSecs <= 5 * 60  ? 10 :   // up to 5 min
    durationSecs <= 30 * 60 ? 30 :   // up to 30 min
    60;                               // default for long video

  // Widen interval so we never extract more than MAX_FRAMES total.
  const minIntervalForCap = Math.ceil(durationSecs / MAX_FRAMES);
  return Math.max(baseInterval, minIntervalForCap);
}

async function analyseFrame(
  framePath: string,
  timestampSec: number,
  client: Groq,
  model: string,
): Promise<FrameAnalysis> {
  const imageBuffer = await fs.readFile(framePath);
  const base64 = imageBuffer.toString('base64');

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
          { type: 'text', text: FRAME_ANALYSIS_PROMPT },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 300,
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn(`Vision model returned non-JSON for frame at ${timestampSec}s`);
  }

  const hasDescription = typeof parsed.description === 'string' && parsed.description.trim().length > 0;
  const hasObjects = Array.isArray(parsed.objects) && parsed.objects.length > 0;
  const confidence = hasDescription && hasObjects ? 0.85 : hasDescription ? 0.6 : 0.35;
  const visibleNameLabels = Array.isArray(parsed.visible_name_labels)
    ? parsed.visible_name_labels
      .map((label: unknown) => typeof label === 'string' ? label.trim() : '')
      .filter(Boolean)
      .slice(0, 8)
    : [];
  const meetingLayout = typeof parsed.meeting_layout === 'string'
    && ['gallery', 'speaker', 'screen_share', 'single_person', 'unknown'].includes(parsed.meeting_layout)
    ? parsed.meeting_layout as 'gallery' | 'speaker' | 'screen_share' | 'single_person' | 'unknown'
    : 'unknown';
  const peopleCount = typeof parsed.people_count === 'number' && Number.isFinite(parsed.people_count)
    ? Math.max(0, Math.min(20, Math.floor(parsed.people_count)))
    : undefined;
  const activeSpeakerHint = typeof parsed.active_speaker_hint === 'string' && parsed.active_speaker_hint.trim().length > 0
    ? parsed.active_speaker_hint.trim()
    : null;

  return {
    timestampSec,
    description: hasDescription ? parsed.description.trim() : 'Frame content unavailable',
    objects: Array.isArray(parsed.objects) ? parsed.objects.slice(0, 20) : [],
    detectedText: parsed.detected_text ?? null,
    confidence,
    metadata: {
      model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      meetingLayout,
      peopleCount,
      visibleNameLabels,
      activeSpeakerHint,
    },
  };
}

/**
 * Analyse a list of video frames using Groq vision.
 * Accepts `{ path, timestampSec }[]` — typically from extractFrames() in media-processing-service.
 * Silently skips frames that fail; gracefully returns [] if no vision key is available.
 */
export async function analyseVideoFrames(
  frames: Array<{ path: string; timestampSec: number }>,
  userApiKeys?: Record<string, string>,
): Promise<FrameAnalysis[]> {
  const apiKey = userApiKeys?.groq || config.groqApiKey;
  if (!isUsableKey(apiKey)) {
    logger.warn('No Groq API key available — skipping vision analysis');
    return [];
  }

  const cappedFrames = frames.slice(0, MAX_FRAMES);
  if (cappedFrames.length < frames.length) {
    logger.info(`Vision analysis capped at ${MAX_FRAMES} frames (${frames.length} available)`);
  }

  const client = new Groq({ apiKey });
  const results: FrameAnalysis[] = [];

  // Determine which model to use — fall back along VISION_MODELS if the first is decommissioned.
  let activeModel: string = VISION_MODELS[0];
  let modelResolved = false;

  logger.info(`Analysing ${cappedFrames.length} frames with ${activeModel}`);

  for (const [index, frame] of cappedFrames.entries()) {
    let succeeded = false;
    for (let mi = modelResolved ? (VISION_MODELS as readonly string[]).indexOf(activeModel) : 0; mi < VISION_MODELS.length; mi++) {
      const model: string = VISION_MODELS[mi];
      try {
        const analysis = await analyseFrame(frame.path, frame.timestampSec, client, model);
        results.push(analysis);
        if (!modelResolved || model !== activeModel) {
          logger.info(`Vision model resolved to ${model}`);
          activeModel = model;
          modelResolved = true;
        }
        succeeded = true;
        break;
      } catch (error: any) {
        const isUnavailable = isUnavailableVisionModelError(error);
        const isRateLimited = isRateLimitedVisionError(error);
        if ((isUnavailable || isRateLimited) && mi < VISION_MODELS.length - 1) {
          logger.warn(
            `${isUnavailable ? 'Vision model unavailable' : 'Vision model rate-limited'} for ${model} — trying ${VISION_MODELS[mi + 1]}`,
          );
          continue;
        }
        logger.warn(`Vision analysis failed for frame at ${frame.timestampSec}s:`, error);
        break; // skip frame, try next
      }
    }
    if (!succeeded) {
      // frame skipped — continue
    }

    if (index < cappedFrames.length - 1) {
      await delay(BATCH_DELAY_MS);
    }
  }

  logger.info(`Vision analysis complete: ${results.length}/${cappedFrames.length} frames analysed`);
  return results;
}

export type CreativeReferenceVision = {
  filename: string;
  summary: string;
  colors: string[];
  styleNotes: string[];
  detectedText: string | null;
  isLogoLike: boolean;
  model: string;
};

const CREATIVE_REF_PROMPT = `You are helping an AI image generator match a brand reference.
Analyse this still image and respond with JSON only:
{
  "summary": "2-3 sentences: composition, subject, overall look",
  "colors": ["#RRGGBB hex codes for dominant brand/design colors, up to 5"],
  "style_notes": ["short phrases: typography feel, layout, photo vs flat design, mood"],
  "detected_text": "readable text in the image, or null",
  "is_logo_like": true
}
is_logo_like should be true for logos, seals, wordmarks, or icon marks.
Prefer real hex codes when colors are clear; otherwise approximate closely.
Do not invent institution names that are not visible.`;

/**
 * Describe creative reference stills (logos / brand boards) for prompt enrichment.
 * Uses the same Groq Llama-4 vision stack as video frame analysis.
 * Returns [] when no Groq key is available (generate continues without vision).
 */
/** Groq vision + json_object often fails on large stills; keep payloads modest. */
const CREATIVE_VISION_MAX_BYTES = 900_000;

function parseLooseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

function isJsonValidateFailed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('json_validate_failed') ||
    message.includes('Failed to validate JSON') ||
    message.includes('invalid_request_error')
  );
}

export async function describeCreativeReferenceImages(
  images: Array<{ filename: string; contentType: string; buffer: Buffer }>,
  options?: { apiKey?: string | null; maxImages?: number },
): Promise<CreativeReferenceVision[]> {
  const apiKey = options?.apiKey;
  if (!isUsableKey(apiKey)) {
    logger.info('Creative vision skip — no Groq API key');
    return [];
  }

  const capped = images.slice(0, Math.min(2, options?.maxImages ?? 2));
  if (capped.length === 0) return [];

  const client = new Groq({ apiKey });
  const results: CreativeReferenceVision[] = [];
  let activeModel: string = VISION_MODELS[0];
  let modelResolved = false;

  for (const [index, image] of capped.entries()) {
    if (image.buffer.length > CREATIVE_VISION_MAX_BYTES) {
      logger.warn(
        `Creative vision skip oversized ref ${image.filename} (${image.buffer.length} bytes)`,
      );
      continue;
    }

    const mime = image.contentType.startsWith('image/') ? image.contentType : 'image/png';
    const dataUrl = `data:${mime};base64,${image.buffer.toString('base64')}`;
    let succeeded = false;

    for (
      let mi = modelResolved ? (VISION_MODELS as readonly string[]).indexOf(activeModel) : 0;
      mi < VISION_MODELS.length;
      mi += 1
    ) {
      const model = VISION_MODELS[mi];
      const attemptVision = async (useJsonMode: boolean) => {
        const response = await client.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: dataUrl } },
                {
                  type: 'text',
                  text: useJsonMode
                    ? CREATIVE_REF_PROMPT
                    : `${CREATIVE_REF_PROMPT}\n\nReply with raw JSON only — no markdown fences.`,
                },
              ],
            },
          ],
          ...(useJsonMode ? { response_format: { type: 'json_object' as const } } : {}),
          max_tokens: 450,
          temperature: 0.1,
        });
        return response.choices[0]?.message?.content ?? '{}';
      };

      try {
        let raw: string;
        try {
          raw = await attemptVision(true);
        } catch (jsonModeError: unknown) {
          if (!isJsonValidateFailed(jsonModeError)) throw jsonModeError;
          logger.warn(
            `Creative vision json_object failed for ${image.filename} on ${model} — retrying without JSON mode`,
          );
          raw = await attemptVision(false);
        }

        const parsed = parseLooseJsonObject(raw);

        const summary =
          typeof parsed.summary === 'string' && parsed.summary.trim()
            ? parsed.summary.trim()
            : '';
        if (!summary) {
          throw new Error('Empty vision summary');
        }

        const colors = Array.isArray(parsed.colors)
          ? parsed.colors
              .map((c) => (typeof c === 'string' ? c.trim() : ''))
              .filter((c) => /^#[0-9A-Fa-f]{6}$/.test(c))
              .slice(0, 5)
          : [];
        const styleNotes = Array.isArray(parsed.style_notes)
          ? parsed.style_notes
              .map((n) => (typeof n === 'string' ? n.trim() : ''))
              .filter(Boolean)
              .slice(0, 8)
          : [];
        const detectedText =
          typeof parsed.detected_text === 'string' && parsed.detected_text.trim()
            ? parsed.detected_text.trim()
            : null;

        results.push({
          filename: image.filename,
          summary,
          colors,
          styleNotes,
          detectedText,
          isLogoLike: parsed.is_logo_like === true,
          model,
        });

        activeModel = model;
        modelResolved = true;
        succeeded = true;
        break;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const isUnavailable = isUnavailableVisionModelError(error);
        const isRateLimited = isRateLimitedVisionError(error);
        const jsonFailed = isJsonValidateFailed(error);
        if ((isUnavailable || isRateLimited || jsonFailed) && mi < VISION_MODELS.length - 1) {
          logger.warn(
            `Creative vision ${
              isUnavailable ? 'model unavailable' : isRateLimited ? 'rate-limited' : 'JSON failed'
            } for ${model} — trying next`,
          );
          continue;
        }
        logger.warn(`Creative vision failed for ${image.filename}: ${message}`);
        break;
      }
    }

    if (!succeeded) {
      // skip image
    }
    if (index < capped.length - 1) {
      await delay(BATCH_DELAY_MS);
    }
  }

  logger.info(`Creative vision complete: ${results.length}/${capped.length} references`);
  return results;
}
