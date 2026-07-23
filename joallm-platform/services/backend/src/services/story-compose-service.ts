/**
 * Story compose pipeline: See (Groq vision) → Structure → Speak.
 * Context is ATRISI Marketing (Institution Acquisition), not generic ad copy.
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

/** Invalidate cached vision when this changes */
export const STORY_VISION_PROMPT_VERSION = 'atrisi-v2';

/**
 * Shared product brief for every compose stage.
 * Wrong brief → generic “marketing poster” copy. This is the acquisition job.
 */
const ATRISI_STORY_BRIEF = `You work inside ATRISI Marketing — the Institution Acquisition Platform.
Job: help institutions acquire Program Interest from the market (prospects → interest → Education converts).
Story is a Studio create workspace: turn uploaded creatives into one coherent multi-medium narrative
(deck / carousel / brochure), not a generic ad agency slideshow.

Audience defaults (unless the images clearly say otherwise):
- Prospective learners / applicants and the people who influence them
- Occasionally partners, employers, or alumni — only if the visual clearly signals that

Voice:
- Clear, credible, institutional — premium and trustworthy
- Short titles; captions that advance the argument (not describe the photo)
- Never invent program names, stats, prices, dates, or CTAs that are not visible on the image
- Prefer exact on-image text when a headline/CTA is readable
- Do NOT write “in this image…”, “this slide shows…”, or stock phrases like “unlock your potential”

Narrative arc (Context → Proof → Ask):
- context: world / program / who it’s for — set the frame
- proof: outcomes, community, credibility, evidence — build trust
- ask: clear next step toward interest / registration / conversation
Constitution: Studio creates. Products operate. Platform remembers.`;

const SEE_PROMPT = `${ATRISI_STORY_BRIEF}

You are the See stage. Look at this single creative asset that may become a beat in an ATRISI acquisition story.
Extract facts for later Structure/Speak stages. Return ONLY JSON:
{
  "what": "one concrete sentence: what is visually dominant (people/setting/object/UI) — factual, not slogan",
  "onImageText": "exact readable text/logo/CTA lines on the image, or null if none",
  "claimHint": "the claim this creative appears to make for acquisition, or null if unclear",
  "audienceHint": "prospect|influencer|partner|employer|alumni|internal|unclear",
  "signals": ["people","product","campus","classroom","proof","brand","ui","crowd","document","event","testimonial","outcome"],
  "narrativeFit": "context|proof|ask|other",
  "mood": "2-4 words matching institutional acquisition tone",
  "confidence": 0.0
}
Rules:
- Do not invent text that is not visible.
- Prefer precise nouns over vague marketing language.
- If the image is decorative only, say so in what and set narrativeFit to other.`;

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

function asNarrativeFit(value: unknown): StoryBeatVision['narrativeFit'] {
  if (value === 'context' || value === 'proof' || value === 'ask' || value === 'other') {
    return value;
  }
  return null;
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
): Promise<{ mime: string; base64: string; originalName?: string } | null> {
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
  return {
    mime,
    base64: buffer.toString('base64'),
    originalName: fileRow.originalName || undefined,
  };
}

async function seeOneImage(
  client: Groq,
  mime: string,
  base64: string,
  fileId: string,
  filenameHint?: string,
): Promise<StoryBeatVision | null> {
  let lastError: unknown;
  const seeUserText = filenameHint
    ? `${SEE_PROMPT}\n\nFilename hint (may be noisy): ${filenameHint}`
    : SEE_PROMPT;

  for (const model of VISION_MODELS) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 420,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
              { type: 'text', text: seeUserText },
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
        claimHint:
          typeof parsed.claimHint === 'string' && parsed.claimHint.trim()
            ? parsed.claimHint.trim()
            : null,
        audienceHint:
          typeof parsed.audienceHint === 'string' && parsed.audienceHint.trim()
            ? parsed.audienceHint.trim()
            : null,
        narrativeFit: asNarrativeFit(parsed.narrativeFit),
        signals,
        mood: typeof parsed.mood === 'string' ? parsed.mood.trim() : 'premium institutional',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
        model,
        analyzedAt: new Date().toISOString(),
        promptVersion: STORY_VISION_PROMPT_VERSION,
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

function visionCacheValid(beat: StoryBeat): boolean {
  return Boolean(
    beat.vision &&
      beat.fileId &&
      beat.vision.fileId === beat.fileId &&
      beat.vision.what &&
      beat.vision.promptVersion === STORY_VISION_PROMPT_VERSION,
  );
}

/** Stage 1 — See: Groq vision cards per beat (cached unless refresh or prompt version bump). */
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
    if (!refreshVision && visionCacheValid(beat)) {
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
      const card = await seeOneImage(
        client,
        image.mime,
        image.base64,
        beat.fileId,
        image.originalName,
      );
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

export type StoryCombineResult = {
  title: string;
  arc: string;
  tone: string;
  thesis: string;
  orderedIds: string[];
  roles: Record<string, StoryBeat['arcRole']>;
  reordered: boolean;
  method: 'multi-vision' | 'card-combine' | 'structure' | 'heuristic';
};

function parseOrderAndRoles(
  parsed: Record<string, unknown>,
  beats: StoryBeat[],
  keepOrder: boolean,
): { orderedIds: string[]; roles: Record<string, StoryBeat['arcRole']>; reordered: boolean } {
  const list = Array.isArray(parsed.beats) ? parsed.beats : [];
  const roles: Record<string, StoryBeat['arcRole']> = {};
  const orderedIds: string[] = [];
  const known = new Set(beats.map((b) => b.id));
  const originalIds = beats.map((b) => b.id);

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
    orderedIds.splice(0, orderedIds.length, ...originalIds);
  }

  for (const beat of beats) {
    if (!roles[beat.id] && beat.vision?.narrativeFit) {
      roles[beat.id] = beat.vision.narrativeFit;
    }
  }

  const reordered =
    !keepOrder &&
    orderedIds.length === originalIds.length &&
    orderedIds.some((id, i) => id !== originalIds[i]);

  return { orderedIds, roles, reordered };
}

function cardsPayload(beats: StoryBeat[]) {
  return beats.map((b, index) => ({
    id: b.id,
    uploadIndex: index,
    currentTitle: b.title,
    what: b.vision?.what || null,
    onImageText: b.vision?.onImageText || null,
    claimHint: b.vision?.claimHint || null,
    audienceHint: b.vision?.audienceHint || null,
    narrativeFit: b.vision?.narrativeFit || null,
    signals: b.vision?.signals || [],
    mood: b.vision?.mood || null,
  }));
}

/**
 * Heuristic reorder: Context → Proof → Ask using vision narrativeFit,
 * then original upload order as tiebreaker.
 */
export function heuristicReorderBeats(beats: StoryBeat[]): StoryBeat[] {
  const rank = (role?: string | null) =>
    role === 'context' ? 0 : role === 'proof' ? 1 : role === 'ask' ? 2 : 1.5;
  return [...beats]
    .sort((a, b) => {
      const ra = rank(a.vision?.narrativeFit || a.arcRole);
      const rb = rank(b.vision?.narrativeFit || b.arcRole);
      if (ra !== rb) return ra - rb;
      return a.order - b.order;
    })
    .map((b, order) => ({
      ...b,
      order,
      arcRole: b.arcRole || b.vision?.narrativeFit || (order === 0 ? 'context' : order === beats.length - 1 ? 'ask' : 'proof'),
    }));
}

async function combineWithMultiVision(
  ownerUserId: string,
  title: string,
  beats: StoryBeat[],
  keepOrder: boolean,
): Promise<StoryCombineResult | null> {
  if (!isUsableKey(config.groqApiKey)) return null;
  const withFiles = beats.filter((b) => b.fileId);
  // Token/size safety: only glance all images together when few beats
  if (withFiles.length < 2 || withFiles.length > 5) return null;

  const client = new Groq({ apiKey: config.groqApiKey });
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  const idList: string[] = [];
  for (const beat of withFiles) {
    const image = await loadBeatImage(ownerUserId, beat.fileId!);
    if (!image) continue;
    // Cap each image for multi-vision (~1.2MB base64 ≈ fine for small sets)
    if (image.base64.length > 1_600_000) continue;
    idList.push(beat.id);
    content.push({
      type: 'text',
      text: `Beat id=${beat.id} (upload #${beats.findIndex((b) => b.id === beat.id)})`,
    });
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mime};base64,${image.base64}` },
    });
  }

  if (idList.length < 2) return null;

  content.push({
    type: 'text',
    text: `${ATRISI_STORY_BRIEF}

You are looking at ALL story assets together. Combine them into one acquisition narrative.
Working title: ${title || 'Untitled story'}
Beat ids in upload order: ${beats.map((b) => b.id).join(', ')}

Return ONLY JSON:
{
  "thesis": "2-3 sentences: the single story these images tell together for Program Interest",
  "title": "short story title",
  "arc": "context_proof_ask",
  "tone": "atrisi_institutional",
  "beats": [
    { "id": "beat-id", "arcRole": "context|proof|ask|other", "order": 0, "why": "one short reason" }
  ]
}
Rules:
- Include every beat id from the upload list exactly once (ids without images still belong in order).
- ${keepOrder ? 'Keep upload order; only assign roles.' : 'YOU MUST reorder for the strongest Context → Proof → Ask. Do not leave weak upload order if a better sequence exists.'}
- Thesis must unify the set — not summarize each image separately.`,
  });

  try {
    let parsed: Record<string, unknown> | null = null;
    for (const model of VISION_MODELS) {
      try {
        const response = await client.chat.completions.create({
          model,
          temperature: 0.2,
          max_tokens: 900,
          messages: [{ role: 'user', content }],
          response_format: { type: 'json_object' },
        });
        parsed = parseJsonObject(response.choices[0]?.message?.content || '{}');
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('rate_limit')) await delay(900);
      }
    }
    if (!parsed) return null;

    const { orderedIds, roles, reordered } = parseOrderAndRoles(parsed, beats, keepOrder);
    return {
      title:
        typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title.trim()
          : title?.trim() && title !== 'Untitled story'
            ? title.trim()
            : 'Program interest story',
      arc: typeof parsed.arc === 'string' ? parsed.arc : 'context_proof_ask',
      tone: typeof parsed.tone === 'string' ? parsed.tone : 'atrisi_institutional',
      thesis: typeof parsed.thesis === 'string' ? parsed.thesis.trim() : '',
      orderedIds,
      roles,
      reordered,
      method: 'multi-vision',
    };
  } catch (error) {
    logger.warn('Story multi-vision combine failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Stage 2 — Combine: synthesize ALL vision cards into one thesis + reorder.
 * Prefers multi-image vision when 2–5 assets; else card-combine text LLM.
 */
export async function combineVisionIntoStory(
  ownerUserId: string,
  title: string,
  beats: StoryBeat[],
  keepOrder = false,
): Promise<StoryCombineResult | null> {
  const multi = await combineWithMultiVision(ownerUserId, title, beats, keepOrder);
  if (multi?.thesis && multi.orderedIds.length === beats.length) {
    return multi;
  }

  const system = `${ATRISI_STORY_BRIEF}

You are the Combine stage. You receive per-beat vision cards from See.
Your job: fuse them into ONE acquisition story — not a list of isolated captions.
Return ONLY JSON:
{
  "thesis": "2-3 sentences throughline connecting all beats toward Program Interest",
  "title": "short story title",
  "arc": "context_proof_ask",
  "tone": "atrisi_institutional",
  "beats": [
    { "id": "beat-id", "arcRole": "context|proof|ask|other", "order": 0, "why": "why this position" }
  ]
}
Rules:
- Include every beat id exactly once.
- ${keepOrder ? 'KEEP upload order; assign roles only.' : 'Reorder aggressively for Context → Proof → Ask. Upload order is usually wrong — fix it.'}
- Prefer opening with world/who-for (context), middle with evidence (proof), close with next step (ask).
- Deduplicate near-identical beats by placing the stronger one earlier in its role band.
- Thesis must explain how the sequence works as one argument.`;

  const parsed = await chatJson({
    system,
    user: JSON.stringify({
      workingTitle: title,
      keepOrder,
      purpose: 'multi-medium acquisition story — combine vision into one spine',
      uploadOrderIds: beats.map((b) => b.id),
      beats: cardsPayload(beats),
    }),
    temperature: 0.2,
  });

  if (!parsed) return null;

  const { orderedIds, roles, reordered } = parseOrderAndRoles(parsed, beats, keepOrder);
  return {
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : title?.trim() && title !== 'Untitled story'
          ? title.trim()
          : 'Program interest story',
    arc: typeof parsed.arc === 'string' ? parsed.arc : 'context_proof_ask',
    tone: typeof parsed.tone === 'string' ? parsed.tone : 'atrisi_institutional',
    thesis: typeof parsed.thesis === 'string' ? parsed.thesis.trim() : '',
    orderedIds,
    roles,
    reordered,
    method: 'card-combine',
  };
}

type StructureResult = {
  title: string;
  arc: string;
  tone: string;
  orderedIds: string[];
  roles: Record<string, StoryBeat['arcRole']>;
};

/** Fallback Structure if Combine fails — text-only card spine. */
export async function structureStoryline(
  title: string,
  beats: StoryBeat[],
  keepOrder: boolean,
): Promise<(StructureResult & { thesis?: string }) | null> {
  const system = `${ATRISI_STORY_BRIEF}

Build the story spine from vision cards. MUST reorder for Context → Proof → Ask unless keepOrder is true.
Return ONLY JSON:
{
  "title": "short story title",
  "thesis": "2-3 sentence throughline",
  "arc": "context_proof_ask",
  "tone": "atrisi_institutional",
  "beats": [{ "id": "beat-id", "arcRole": "context|proof|ask|other", "order": 0 }]
}
Include every beat id once. ${keepOrder ? 'Keep order.' : 'Reorder for strongest acquisition argument.'}`;

  const parsed = await chatJson({
    system,
    user: JSON.stringify({
      workingTitle: title,
      keepOrder,
      beats: cardsPayload(beats),
    }),
    temperature: 0.2,
  });
  if (!parsed) return null;

  const { orderedIds, roles } = parseOrderAndRoles(parsed, beats, keepOrder);
  return {
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : title?.trim() && title !== 'Untitled story'
          ? title.trim()
          : 'Program interest story',
    arc: typeof parsed.arc === 'string' ? parsed.arc : 'context_proof_ask',
    tone: typeof parsed.tone === 'string' ? parsed.tone : 'atrisi_institutional',
    orderedIds,
    roles,
    thesis: typeof parsed.thesis === 'string' ? parsed.thesis.trim() : undefined,
  };
}

/** Stage 3 — Speak: titles/captions grounded in combined thesis + vision + roles. */
export async function speakStoryline(
  storyTitle: string,
  beats: StoryBeat[],
  thesis?: string,
): Promise<Map<string, { title: string; caption: string; notes: string }> | null> {
  const payload = beats.map((b, index) => ({
    id: b.id,
    order: index,
    arcRole: b.arcRole || 'other',
    what: b.vision?.what || null,
    onImageText: b.vision?.onImageText || null,
    claimHint: b.vision?.claimHint || null,
    audienceHint: b.vision?.audienceHint || null,
    signals: b.vision?.signals || [],
    mood: b.vision?.mood || null,
  }));

  const system = `${ATRISI_STORY_BRIEF}

You are the Speak stage. Write beat titles and captions that serve the UNIFIED story thesis.
Return ONLY JSON:
{
  "beats": [
    {
      "id": "beat-id",
      "title": "≤6 words — argument headline for THIS step in the thesis",
      "caption": "one sentence advancing the thesis (not a photo description)",
      "notes": "optional"
    }
  ]
}
Rules:
- Every caption must connect to the thesis — the set should read as one argument.
- Titles argue; they do not label the photo.
- If onImageText has a strong headline/CTA, reuse or lightly polish — do not invent conflicting CTAs.
- Match arcRole: context = who/for; proof = why trust; ask = next step to Program Interest.
- Never invent stats/names absent from onImageText/claimHint.
- Preserve every beat id.`;

  const parsed = await chatJson({
    system,
    user: JSON.stringify({
      storyTitle,
      thesis: thesis || null,
      purpose: 'unified acquisition narrative',
      beats: payload,
    }),
    temperature: 0.3,
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
  const reordered = heuristicReorderBeats(beats);
  const n = reordered.length;
  const proposed = reordered.map((beat, index) => {
    const arcRole: StoryBeat['arcRole'] =
      beat.arcRole ||
      beat.vision?.narrativeFit ||
      (n <= 1 ? 'ask' : index === 0 ? 'context' : index === n - 1 ? 'ask' : 'proof');

    const onText = beat.vision?.onImageText;
    const claim = beat.vision?.claimHint;
    const roleCaption =
      arcRole === 'context'
        ? 'See who this program is for.'
        : arcRole === 'proof'
          ? 'Evidence that builds trust.'
          : 'Take the next step toward interest.';

    return {
      ...beat,
      order: index,
      arcRole,
      title: (onText?.split(/[\n|]/)[0] || claim || beat.title || `Beat ${index + 1}`).slice(0, 48),
      caption: claim || roleCaption,
      notes: beat.vision ? `${arcRole} — ${beat.vision.what}` : beat.notes,
    };
  });

  return {
    title: title?.trim() && title !== 'Untitled story' ? title : 'Program interest story',
    arc: 'context_proof_ask',
    tone: 'atrisi_institutional',
    beats: proposed,
  };
}
