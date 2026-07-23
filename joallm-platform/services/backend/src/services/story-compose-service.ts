/**
 * Story compose pipeline: See (Groq vision) → Structure → Speak.
 * Reuses Platform Groq vision models already used by Media AI.
 */

import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { and, eq } from 'drizzle-orm';
import { config } from '../config/config.js';
import { db } from '../database/connection.js';
import { files, type StoryBeat, type StoryBeatVision } from '../database/schema.js';
import { storageProvider } from './file-storage.js';
import { logger } from '../utils/logger.js';

const VISION_MODELS = [
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
] as const;

const TEXT_MODEL_GROQ = 'llama-3.3-70b-versatile';
const VISION_DELAY_MS = 200;
const MAX_IMAGE_BYTES = 4_500_000;

const SEE_PROMPT = `You are ATRISI Marketing vision for Story compose.
Analyse this marketing/creative image. Return ONLY JSON:
{
  "what": "one sentence: dominant visual subject",
  "onImageText": "readable text/logo/CTA on the image, or null",
  "signals": ["people|product|campus|proof|brand|ui|crowd|empty|document|event — pick fitting tags"],
  "mood": "2-4 word mood for institutional marketing",
  "confidence": 0.0
}
Do not invent text that is not visible. Be concise.`;

function isUsableKey(value?: string | null): value is string {
  return Boolean(value && value.trim().length > 0 && !value.includes('PLACEHOLDER'));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('Model returned non-JSON');
  }
}

async function chatJson(options: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<Record<string, unknown> | null> {
  const { system, user, temperature = 0.35 } = options;
  try {
    if (isUsableKey(config.groqApiKey)) {
      const client = new Groq({ apiKey: config.groqApiKey });
      const response = await client.chat.completions.create({
        model: TEXT_MODEL_GROQ,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      });
      return parseJsonObject(response.choices[0]?.message?.content || '{}');
    }
    if (isUsableKey(config.openaiApiKey)) {
      const client = new OpenAI({ apiKey: config.openaiApiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      });
      return parseJsonObject(response.choices[0]?.message?.content || '{}');
    }
    return null;
  } catch (error) {
    logger.warn('Story compose text LLM failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function loadBeatImage(
  ownerUserId: string,
  fileId: string,
): Promise<{ mime: string; base64: string } | null> {
  const [fileRow] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, ownerUserId)))
    .limit(1);
  if (!fileRow?.storageKey) return null;
  const buffer = await storageProvider.downloadFile(fileRow.storageKey);
  if (!buffer?.length) return null;
  if (buffer.length > MAX_IMAGE_BYTES) {
    logger.warn('Story vision skip: image too large', { fileId, bytes: buffer.length });
    return null;
  }
  const mime = fileRow.mimetype || 'image/jpeg';
  if (!mime.startsWith('image/')) return null;
  return { mime, base64: buffer.toString('base64') };
}

async function seeOneImage(
  client: Groq,
  mime: string,
  base64: string,
  fileId: string,
): Promise<StoryBeatVision | null> {
  let lastError: unknown;
  for (const model of VISION_MODELS) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.15,
        max_tokens: 350,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
              { type: 'text', text: SEE_PROMPT },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      });
      const parsed = parseJsonObject(response.choices[0]?.message?.content || '{}');
      const signals = Array.isArray(parsed.signals)
        ? parsed.signals.filter((s): s is string => typeof s === 'string').slice(0, 8)
        : [];
      const what = typeof parsed.what === 'string' ? parsed.what.trim() : '';
      if (!what) continue;
      return {
        fileId,
        what,
        onImageText:
          typeof parsed.onImageText === 'string' && parsed.onImageText.trim()
            ? parsed.onImageText.trim()
            : null,
        signals,
        mood: typeof parsed.mood === 'string' ? parsed.mood.trim() : 'institutional',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
        model,
        analyzedAt: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('rate_limit')) {
        await delay(800);
      }
    }
  }
  logger.warn('Story vision see failed for file', {
    fileId,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  return null;
}

/** Stage 1 — See: Groq vision cards per beat (cached unless refreshVision). */
export async function seeBeatVisionCards(
  ownerUserId: string,
  beats: StoryBeat[],
  refreshVision = false,
): Promise<{ beats: StoryBeat[]; visionCount: number }> {
  if (!isUsableKey(config.groqApiKey)) {
    return { beats, visionCount: 0 };
  }

  const client = new Groq({ apiKey: config.groqApiKey });
  const next: StoryBeat[] = [];
  let visionCount = 0;

  for (const beat of beats) {
    const cachedOk =
      !refreshVision &&
      beat.vision &&
      beat.fileId &&
      beat.vision.fileId === beat.fileId &&
      beat.vision.what;

    if (cachedOk) {
      next.push(beat);
      visionCount += 1;
      continue;
    }

    if (!beat.fileId) {
      next.push({ ...beat, vision: null });
      continue;
    }

    try {
      const image = await loadBeatImage(ownerUserId, beat.fileId);
      if (!image) {
        next.push({ ...beat, vision: null });
        continue;
      }
      const card = await seeOneImage(client, image.mime, image.base64, beat.fileId);
      if (card) visionCount += 1;
      next.push({ ...beat, vision: card });
      await delay(VISION_DELAY_MS);
    } catch (error) {
      logger.warn('Story see beat failed', {
        beatId: beat.id,
        error: error instanceof Error ? error.message : String(error),
      });
      next.push({ ...beat, vision: null });
    }
  }

  return { beats: next, visionCount };
}

type StructureResult = {
  title: string;
  arc: string;
  tone: string;
  orderedIds: string[];
  roles: Record<string, StoryBeat['arcRole']>;
};

/** Stage 2 — Structure: order + arc roles from vision cards (text LLM). */
export async function structureStoryline(
  title: string,
  beats: StoryBeat[],
  keepOrder: boolean,
): Promise<StructureResult | null> {
  const cards = beats.map((b, index) => ({
    id: b.id,
    index,
    currentTitle: b.title,
    what: b.vision?.what || null,
    onImageText: b.vision?.onImageText || null,
    signals: b.vision?.signals || [],
    mood: b.vision?.mood || null,
  }));

  const system = `You are ATRISI Marketing Story structurer.
Constitution: Studio creates. Products operate. Platform remembers.
Given beat vision cards, propose a coherent Context → Proof → Ask arc for institutional acquisition.
Return ONLY JSON:
{
  "title": "short story title",
  "arc": "context_proof_ask",
  "tone": "atrisi_institutional",
  "beats": [
    { "id": "beat-id", "arcRole": "context|proof|ask|other", "order": 0 }
  ]
}
Rules:
- Include every beat id exactly once.
- Prefer context early, proof in the middle, ask at the end.
- ${keepOrder ? 'KEEP the given index order; only assign arcRole.' : 'You may reorder for a stronger narrative.'}
- Do not write captions here.`;

  const parsed = await chatJson({
    system,
    user: JSON.stringify({ currentTitle: title, keepOrder, beats: cards }),
    temperature: 0.3,
  });
  if (!parsed) return null;

  const list = Array.isArray(parsed.beats) ? parsed.beats : [];
  const roles: Record<string, StoryBeat['arcRole']> = {};
  const orderedIds: string[] = [];
  const known = new Set(beats.map((b) => b.id));

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id || !known.has(id) || orderedIds.includes(id)) continue;
    orderedIds.push(id);
    const role = row.arcRole;
    if (role === 'context' || role === 'proof' || role === 'ask' || role === 'other') {
      roles[id] = role;
    }
  }
  for (const beat of beats) {
    if (!orderedIds.includes(beat.id)) orderedIds.push(beat.id);
  }

  if (keepOrder) {
    orderedIds.splice(0, orderedIds.length, ...beats.map((b) => b.id));
  }

  return {
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : title,
    arc: typeof parsed.arc === 'string' ? parsed.arc : 'context_proof_ask',
    tone: typeof parsed.tone === 'string' ? parsed.tone : 'atrisi_institutional',
    orderedIds,
    roles,
  };
}

/** Stage 3 — Speak: titles/captions grounded in vision + assigned roles. */
export async function speakStoryline(
  storyTitle: string,
  beats: StoryBeat[],
): Promise<Map<string, { title: string; caption: string; notes: string }> | null> {
  const payload = beats.map((b) => ({
    id: b.id,
    arcRole: b.arcRole || 'other',
    what: b.vision?.what || null,
    onImageText: b.vision?.onImageText || null,
    signals: b.vision?.signals || [],
    mood: b.vision?.mood || null,
    currentTitle: b.title,
  }));

  const system = `You are ATRISI Marketing Story copywriter.
Write beat titles and captions for a multi-medium institutional narrative.
Return ONLY JSON:
{
  "beats": [
    { "id": "beat-id", "title": "≤6 words", "caption": "one sentence", "notes": "optional why this beat / speaker hint" }
  ]
}
Rules:
- Ground copy in vision "what" and prefer visible onImageText when present (do not invent CTAs).
- No "in this image we see…". Marketing voice, ATRISI institutional tone.
- Preserve every beat id. Captions one sentence.`;

  const parsed = await chatJson({
    system,
    user: JSON.stringify({ storyTitle, beats: payload }),
    temperature: 0.4,
  });
  if (!parsed) return null;

  const map = new Map<string, { title: string; caption: string; notes: string }>();
  const list = Array.isArray(parsed.beats) ? parsed.beats : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id) continue;
    map.set(id, {
      title: typeof row.title === 'string' ? row.title.trim() : '',
      caption: typeof row.caption === 'string' ? row.caption.trim() : '',
      notes: typeof row.notes === 'string' ? row.notes.trim() : '',
    });
  }
  return map.size ? map : null;
}

export function applyHeuristicFromVision(beats: StoryBeat[], title: string): {
  title: string;
  arc: string;
  tone: string;
  beats: StoryBeat[];
} {
  const n = beats.length;
  const proposed = beats.map((beat, index) => {
    let arcRole: StoryBeat['arcRole'] = 'other';
    if (n <= 1) arcRole = 'ask';
    else if (index === 0) arcRole = 'context';
    else if (index === n - 1) arcRole = 'ask';
    else arcRole = 'proof';

    const what = beat.vision?.what;
    const onText = beat.vision?.onImageText;
    return {
      ...beat,
      order: index,
      arcRole,
      title: (onText || what || beat.title || `Beat ${index + 1}`).slice(0, 60),
      caption:
        what ||
        (arcRole === 'context'
          ? 'Set the scene for the audience.'
          : arcRole === 'proof'
            ? 'Show evidence that builds trust.'
            : 'Close with a clear next step.'),
      notes: beat.vision
        ? `${arcRole} — ${beat.vision.signals.join(', ') || 'visual'}`
        : beat.notes,
    };
  });

  return {
    title: title?.trim() && title !== 'Untitled story' ? title : 'ATRISI story',
    arc: 'context_proof_ask',
    tone: 'atrisi_institutional',
    beats: proposed,
  };
}
