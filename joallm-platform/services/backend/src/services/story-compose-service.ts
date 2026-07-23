/**
 * Story compose pipeline: See (Groq vision) → Structure → Speak.
 * Context is ATRISI Marketing (Institution Acquisition), not generic ad copy.
 */

import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { eq } from 'drizzle-orm';
import { config } from '../config/config.js';
import { db } from '../database/connection.js';
import { files, type StoryBeat, type StoryBeatVision } from '../database/schema.js';
import { storageProvider } from './file-storage.js';
import { canActorAccessOwnerResource } from './organization-ownership.js';
import { logger } from '../utils/logger.js';

const VISION_MODELS = [
  'qwen/qwen3.6-27b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
] as const;

const TEXT_MODEL_GROQ = 'llama-3.3-70b-versatile';
const VISION_DELAY_MS = 200;
const MAX_IMAGE_BYTES = 4_500_000;

/** Invalidate cached vision when this changes */
export const STORY_VISION_PROMPT_VERSION = 'atrisi-v3';

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

Narrative arc (Context → Proof → Ask) — ALWAYS assign one; the user may not have labeled beats:
- context: world / program / who it’s for — set the frame
- proof: outcomes, community, credibility, evidence — build trust
- ask: clear next step toward interest / registration / conversation
- other: ONLY if the asset cannot serve acquisition (pure decoration, unrelated stock, unreadable junk)
Constitution: Studio creates. Products operate. Platform remembers.`;

const SEE_PROMPT = `${ATRISI_STORY_BRIEF}

You are the See stage. Look at this single creative asset that may become a beat in an ATRISI acquisition story.
You MUST place it on the Context → Proof → Ask spine when possible. Return ONLY JSON:
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
- Prefer context|proof|ask over other whenever the image could open, evidence, or close an acquisition argument.
- Use other ONLY for decorative / off-brief / unusable assets — and set confidence low (<0.35).
- confidence reflects how sure you are about narrativeFit.`;

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
  actorUserId: string,
  fileId: string,
): Promise<{ mime: string; base64: string; originalName?: string } | null> {
  const [fileRow] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);
  if (!fileRow) return null;
  if (!(await canActorAccessOwnerResource(actorUserId, fileRow.userId))) return null;
  try {
    const { resolveFileImageBytes } = await import('./file-bytes.js');
    const resolved = await resolveFileImageBytes({
      id: fileRow.id,
      originalName: fileRow.originalName,
      filename: fileRow.filename,
      mimetype: fileRow.mimetype,
      storageKey: fileRow.storageKey,
      metadata: fileRow.metadata as Record<string, unknown> | null,
    });
    if (!resolved.buffer?.length) return null;
    if (resolved.buffer.length > MAX_IMAGE_BYTES) {
      logger.warn('Story vision skip: image too large', { fileId, bytes: resolved.buffer.length });
      return null;
    }
    return {
      mime: resolved.contentType,
      base64: resolved.buffer.toString('base64'),
      originalName: fileRow.originalName || undefined,
    };
  } catch (error) {
    logger.warn('Story vision skip: storage miss', {
      fileId,
      storageKey: fileRow.storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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

/** Stage 1 — See: vision cards per beat (Groq preferred, OpenAI fallback). */
export async function seeBeatVisionCards(
  ownerUserId: string,
  beats: StoryBeat[],
  refreshVision = false,
): Promise<{
  beats: StoryBeat[];
  visionCount: number;
  diag?: string;
}> {
  let groqKey = config.groqApiKey;
  let openaiKey = config.openaiApiKey;
  try {
    const { userApiKeyRepository } = await import('../repositories/user-api-key-repository.js');
    const byok = await userApiKeyRepository.getDecryptedApiKeys(ownerUserId);
    if (byok.groq?.trim()) groqKey = byok.groq.trim();
    if (byok.openai?.trim()) openaiKey = byok.openai.trim();
  } catch {
    // Platform env keys only
  }

  const hasGroq = isUsableKey(groqKey);
  const hasOpenAI = isUsableKey(openaiKey);
  if (!hasGroq && !hasOpenAI) {
    return {
      beats,
      visionCount: 0,
      diag: 'No vision API key — set GROQ_API_KEY or OpenAI key (platform or Settings BYOK). Using upload-order arc.',
    };
  }

  const groqClient = hasGroq ? new Groq({ apiKey: groqKey }) : null;
  const openaiClient = hasOpenAI ? new OpenAI({ apiKey: openaiKey }) : null;
  const next: StoryBeat[] = [];
  let visionCount = 0;
  let loadFails = 0;
  let apiFails = 0;
  let tooLarge = 0;

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
        loadFails += 1;
        next.push({ ...beat, vision: null });
        continue;
      }
      if (image.base64.length * 0.75 > MAX_IMAGE_BYTES) {
        // base64 expands ~4/3; loadBeatImage already gates buffer size — keep counter for diag
        tooLarge += 1;
      }

      let card: StoryBeatVision | null = null;
      if (groqClient) {
        card = await seeOneImage(
          groqClient,
          image.mime,
          image.base64,
          beat.fileId,
          image.originalName,
        );
      }
      if (!card && openaiClient) {
        card = await seeOneImageOpenAI(
          openaiClient,
          image.mime,
          image.base64,
          beat.fileId,
          image.originalName,
        );
      }
      if (card) visionCount += 1;
      else apiFails += 1;
      next.push({ ...beat, vision: card });
      await delay(VISION_DELAY_MS);
    } catch (error) {
      apiFails += 1;
      logger.warn('Story see beat failed', {
        beatId: beat.id,
        error: error instanceof Error ? error.message : String(error),
      });
      next.push({ ...beat, vision: null });
    }
  }

  let diag: string | undefined;
  if (visionCount === 0 && beats.some((b) => b.fileId)) {
    const parts: string[] = [];
    if (loadFails) parts.push(`${loadFails} image(s) missing from storage — re-upload`);
    if (tooLarge) parts.push(`${tooLarge} image(s) may be too large for vision`);
    if (apiFails) parts.push(`vision API failed on ${apiFails} beat(s)`);
    if (!hasGroq) parts.push('GROQ key missing (OpenAI tried or unavailable)');
    diag = parts.length
      ? `Vision unavailable (${parts.join('; ')}). Built arc from upload order.`
      : 'Vision unavailable. Built arc from upload order.';
  }

  return { beats: next, visionCount, diag };
}

async function seeOneImageOpenAI(
  client: OpenAI,
  mime: string,
  base64: string,
  fileId: string,
  filenameHint?: string,
): Promise<StoryBeatVision | null> {
  const seeUserText = filenameHint
    ? `${SEE_PROMPT}\n\nFilename hint (may be noisy): ${filenameHint}`
    : SEE_PROMPT;
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
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
    if (!what) return null;
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
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.55,
      model: 'gpt-4o-mini',
      analyzedAt: new Date().toISOString(),
      promptVersion: STORY_VISION_PROMPT_VERSION,
    };
  } catch (error) {
    logger.warn('Story OpenAI vision see failed', {
      fileId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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
- You MUST assign every beat to context, proof, or ask when it can serve acquisition. Use other only for unusable assets.
- Prefer opening with world/who-for (context), middle with evidence (proof), close with next step (ask).
- Deduplicate near-identical beats by placing the stronger one earlier in its role band.
- Thesis must explain how the sequence works as one argument.
- If assets cannot form Context → Proof → Ask, still best-effort assign roles and write thesis noting the gap.`;

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

export type StoryArcValidation = {
  ok: boolean;
  beats: StoryBeat[];
  warnings: string[];
  errors: string[];
};

/**
 * Force a Context → Proof → Ask spine.
 * Vision failures become warnings + heuristic fallback — do not block Propose.
 * Hard-fail only when vision DID run and every asset is clearly off-brief.
 */
export function enforceAndValidateStoryArc(
  beats: StoryBeat[],
  options?: { visionCount?: number; visionDiag?: string },
): StoryArcValidation {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (beats.length === 0) {
    return {
      ok: false,
      beats,
      warnings,
      errors: ['Add assets before proposing a storyline.'],
    };
  }

  // Reorder from vision narrativeFit; user need not pre-label beats.
  const ranked = heuristicReorderBeats(beats);
  const n = ranked.length;

  const next: StoryBeat[] = ranked.map((beat, index) => {
    let arcRole: StoryBeat['arcRole'] =
      beat.vision?.narrativeFit ||
      beat.arcRole ||
      (n <= 1 ? 'ask' : index === 0 ? 'context' : index === n - 1 ? 'ask' : 'proof');

    // Positional spine for multi-beat stories — always Context … Ask
    if (n >= 2) {
      if (index === 0) arcRole = 'context';
      else if (index === n - 1) arcRole = 'ask';
      else if (!arcRole || arcRole === 'other' || arcRole === 'context' || arcRole === 'ask') {
        arcRole = 'proof';
      }
    }

    return { ...beat, order: index, arcRole };
  });

  const withVision = next.filter((b) => b.vision);
  const visionCount = options?.visionCount ?? withVision.length;
  const unusable = withVision.filter(
    (b) =>
      b.vision?.narrativeFit === 'other' ||
      (typeof b.vision?.confidence === 'number' && b.vision.confidence < 0.28),
  );
  const avgConf = withVision.length
    ? withVision.reduce((sum, b) => sum + (b.vision?.confidence || 0), 0) / withVision.length
    : 0;

  if (next.length >= 2 && visionCount === 0) {
    warnings.push(
      options?.visionDiag ||
        'Vision could not read these images — built Context → Proof → Ask from upload order. Set GROQ_API_KEY (or OpenAI), re-upload if assets 404, then Propose again for smarter ordering.',
    );
  }

  // Only hard-fail when vision actually classified everything as unusable
  if (
    next.length >= 2 &&
    withVision.length >= 2 &&
    unusable.length === withVision.length &&
    visionCount > 0
  ) {
    errors.push(
      'These images look decorative or off-brief for an acquisition story. Upload creatives that open a frame (Context), show evidence (Proof), and close with an ask — then Propose again.',
    );
  }

  if (next.length >= 3 && withVision.length > 0 && avgConf > 0 && avgConf < 0.22) {
    warnings.push(
      'Vision confidence is low — review arc roles and captions after Propose.',
    );
  }

  if (next.length >= 3 && !next.some((b) => b.arcRole === 'proof')) {
    warnings.push('No clear Proof beat — middle slides were assigned as proof by position.');
  }

  const audiences = new Set(
    withVision
      .map((b) => b.vision?.audienceHint)
      .filter((a): a is string => Boolean(a) && a !== 'unclear'),
  );
  if (audiences.size > 2) {
    warnings.push('Audience signals conflict across beats — review titles and captions.');
  }

  return { ok: errors.length === 0, beats: next, warnings, errors };
}
