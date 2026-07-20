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
// llama-3.2-*-vision-preview was decommissioned April 2026; Llama 4 Scout is the replacement.
const VISION_MODELS = [
  'meta-llama/llama-4-maverick-17b-128e-instruct',
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
        const isDecommissioned =
          error?.status === 400 &&
          (error?.message ?? '').includes('decommissioned');
        const isRateLimited = isRateLimitedVisionError(error);
        if ((isDecommissioned || isRateLimited) && mi < VISION_MODELS.length - 1) {
          logger.warn(
            `${isDecommissioned ? 'Model decommissioned' : 'Vision model rate-limited'} for ${model} — trying ${VISION_MODELS[mi + 1]}`,
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
