/**
 * Story — Studio create workspace for multi-medium narrative compose.
 * Constitution: Studio creates. Products operate. Platform remembers.
 * Free-floating until attach; not a new aggregate root (Institution · Program · Person).
 */

import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { files, storySessions, users, type StoryBeat } from '../database/schema.js';
import { generateCreativeImages } from './creative-ai-generate-service.js';
import {
  applyHeuristicFromVision,
  combineVisionIntoStory,
  enforceAndValidateStoryArc,
  sanitizeBeatCaption,
  sanitizeBeatTitle,
  seeBeatVisionCards,
  speakStoryline,
  structureStoryline,
} from './story-compose-service.js';
import { getStoryAspectRatio, getStoryFormat, isStoryFormatId } from './story-format.js';
import { ATRISI_INSTITUTE_BRAND_THEME } from './atrisi-brand.js';
import {
  buildOrgTeamOwnerReadScope,
  canActorAccessOwnerResource,
  listOrganizationMemberUserIds,
  resolveOrganizationIdForUser,
} from './organization-ownership.js';
import { logger } from '../utils/logger.js';
import {
  buildZipArchive,
  cleanStoryTypography,
  fitImageInBox,
  groupBeatsByArc,
  pickDeckImageLayout,
  readImagePixelSize,
  safeExportSlug,
  sortBeatsByStoryArc,
} from './story-export-utils.js';

const requirePptx = createRequire(import.meta.url);

/** @deprecated Use ATRISI_INSTITUTE_BRAND_THEME — kept as alias for Story imports */
export const ATRISI_STORY_BRAND_THEME = ATRISI_INSTITUTE_BRAND_THEME;

export type StoryStatus = 'draft' | 'ready' | 'archived';

export type StorySessionDto = {
  id: string;
  title: string;
  status: StoryStatus;
  programId: string | null;
  campaignId: string | null;
  arc: string;
  tone: string;
  beats: StoryBeat[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  attached: boolean;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  isOwner: boolean;
};

const ARC_LABELS: Record<string, string> = {
  context: 'Context',
  proof: 'Proof',
  ask: 'Ask',
  other: 'Beat',
};

type OwnerProfile = { name: string; email: string };

function toDto(
  row: typeof storySessions.$inferSelect,
  actorUserId: string,
  owner?: OwnerProfile | null,
): StorySessionDto {
  const beats = Array.isArray(row.beats) ? row.beats : [];
  return {
    id: row.id,
    title: row.title,
    status: row.status as StoryStatus,
    programId: row.programId ?? null,
    campaignId: row.campaignId ?? null,
    arc: row.arc,
    tone: row.tone,
    beats: [...beats].sort((a, b) => a.order - b.order),
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attached: Boolean(row.programId || row.campaignId),
    ownerUserId: row.ownerUserId,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    isOwner: row.ownerUserId === actorUserId,
  };
}

async function loadOwnerProfiles(ownerIds: string[]): Promise<Map<string, OwnerProfile>> {
  const unique = [...new Set(ownerIds.filter(Boolean))];
  const map = new Map<string, OwnerProfile>();
  if (unique.length === 0) return map;
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, unique));
  for (const row of rows) {
    map.set(row.id, { name: row.name, email: row.email });
  }
  return map;
}

async function toDtoWithOwner(
  row: typeof storySessions.$inferSelect,
  actorUserId: string,
): Promise<StorySessionDto> {
  const owners = await loadOwnerProfiles([row.ownerUserId]);
  return toDto(row, actorUserId, owners.get(row.ownerUserId));
}

async function scopeForUser(actorUserId: string) {
  const organizationId = await resolveOrganizationIdForUser(actorUserId);
  const memberUserIds = organizationId
    ? await listOrganizationMemberUserIds(organizationId)
    : [actorUserId];
  return {
    organizationId,
    memberUserIds,
    scope: buildOrgTeamOwnerReadScope({
      organizationId,
      actorUserId,
      memberUserIds,
      organizationColumn: storySessions.organizationId,
      ownerColumn: storySessions.ownerUserId,
    }),
  };
}

async function getOwnedStory(actorUserId: string, storyId: string) {
  const { scope } = await scopeForUser(actorUserId);
  const [row] = await db
    .select()
    .from(storySessions)
    .where(and(eq(storySessions.id, storyId), scope!))
    .limit(1);
  if (!row) {
    throw Object.assign(new Error('Story not found'), { statusCode: 404 });
  }
  return row;
}

export async function listStories(actorUserId: string): Promise<StorySessionDto[]> {
  const { scope } = await scopeForUser(actorUserId);
  const rows = await db
    .select()
    .from(storySessions)
    .where(scope!)
    .orderBy(desc(storySessions.updatedAt))
    .limit(100);
  const owners = await loadOwnerProfiles(rows.map((r) => r.ownerUserId));
  return rows.map((row) => toDto(row, actorUserId, owners.get(row.ownerUserId)));
}

export async function getStory(actorUserId: string, storyId: string): Promise<StorySessionDto> {
  return toDtoWithOwner(await getOwnedStory(actorUserId, storyId), actorUserId);
}

export async function createStory(
  ownerUserId: string,
  input?: { title?: string; tone?: string; arc?: string; format?: string },
): Promise<StorySessionDto> {
  const organizationId = await resolveOrganizationIdForUser(ownerUserId);
  const format = isStoryFormatId(input?.format) ? input!.format : 'deck';
  const [row] = await db
    .insert(storySessions)
    .values({
      ownerUserId,
      organizationId,
      title: input?.title?.trim() || 'Untitled story',
      tone: input?.tone || 'atrisi_institutional',
      arc: input?.arc || 'context_proof_ask',
      beats: [],
      metadata: {
        constitution: 'Studio creates. Products operate. Platform remembers.',
        format,
        aspectRatio: getStoryAspectRatio({ format }),
      },
    })
    .returning();
  return toDtoWithOwner(row, ownerUserId);
}

export async function updateStory(
  ownerUserId: string,
  storyId: string,
  patch: {
    title?: string;
    status?: StoryStatus;
    programId?: string | null;
    campaignId?: string | null;
    arc?: string;
    tone?: string;
    beats?: StoryBeat[];
    metadata?: Record<string, unknown>;
  },
): Promise<StorySessionDto> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const nextBeats = patch.beats
    ? patch.beats.map((beat, index) => ({
        ...beat,
        id: beat.id || randomUUID(),
        order: typeof beat.order === 'number' ? beat.order : index,
        fileId: beat.fileId ?? null,
        title: beat.title ?? '',
        caption: beat.caption ?? '',
        notes: beat.notes ?? '',
        vision: beat.vision ?? null,
      }))
    : existing.beats;

  const [row] = await db
    .update(storySessions)
    .set({
      title: patch.title?.trim() ?? existing.title,
      status: patch.status ?? existing.status,
      programId: patch.programId === undefined ? existing.programId : patch.programId,
      campaignId: patch.campaignId === undefined ? existing.campaignId : patch.campaignId,
      arc: patch.arc ?? existing.arc,
      tone: patch.tone ?? existing.tone,
      beats: nextBeats,
      metadata: patch.metadata
        ? { ...(existing.metadata as Record<string, unknown>), ...patch.metadata }
        : existing.metadata,
      updatedAt: new Date(),
    })
    .where(eq(storySessions.id, storyId))
    .returning();

  return toDtoWithOwner(row, ownerUserId);
}

export async function deleteStory(actorUserId: string, storyId: string): Promise<void> {
  const existing = await getOwnedStory(actorUserId, storyId);
  if (existing.ownerUserId !== actorUserId) {
    throw Object.assign(new Error('Only the story creator can delete this story'), {
      statusCode: 403,
    });
  }
  await db.delete(storySessions).where(eq(storySessions.id, storyId));
}

export async function addBeatsFromFiles(
  ownerUserId: string,
  storyId: string,
  fileIds: string[],
): Promise<StorySessionDto> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const uniqueIds = [...new Set(fileIds.filter(Boolean))];
  const candidateFiles =
    uniqueIds.length === 0
      ? []
      : await db
          .select({ id: files.id, originalName: files.originalName, userId: files.userId })
          .from(files)
          .where(inArray(files.id, uniqueIds));

  const accessible: Array<{ id: string; originalName: string | null }> = [];
  for (const file of candidateFiles) {
    if (await canActorAccessOwnerResource(ownerUserId, file.userId)) {
      accessible.push({ id: file.id, originalName: file.originalName });
    }
  }

  const ownedIdSet = new Set(accessible.map((f) => f.id));
  const nameById = new Map(accessible.map((f) => [f.id, f.originalName || 'Asset']));

  const startOrder = existing.beats.length;
  const added: StoryBeat[] = fileIds
    .filter((id) => ownedIdSet.has(id))
    .map((fileId, index) => ({
      id: randomUUID(),
      fileId,
      title: nameById.get(fileId)?.replace(/\.[^.]+$/, '') || `Beat ${startOrder + index + 1}`,
      caption: '',
      notes: '',
      order: startOrder + index,
      arcRole: 'other' as const,
    }));

  if (added.length === 0) {
    throw Object.assign(new Error('No valid files to add'), { statusCode: 400 });
  }

  return updateStory(ownerUserId, storyId, {
    beats: [...existing.beats, ...added],
  });
}

function findBeatOrThrow(beats: StoryBeat[], beatId: string): StoryBeat {
  const beat = beats.find((b) => b.id === beatId);
  if (!beat) {
    throw Object.assign(new Error('Beat not found'), { statusCode: 404 });
  }
  if (!beat.fileId) {
    throw Object.assign(new Error('Beat has no image to use as reference'), { statusCode: 400 });
  }
  return beat;
}

export type StoryBrandKit = {
  logoFileId?: string | null;
  styleFileIds?: string[];
  /** Burn logo as corner watermark on Brand / Similar (default true when logo set) */
  watermark?: boolean;
};

export function getStoryBrandKit(metadata: Record<string, unknown> | null | undefined): StoryBrandKit {
  const raw = metadata?.brandKit;
  if (!raw || typeof raw !== 'object') return { logoFileId: null, styleFileIds: [], watermark: true };
  const kit = raw as Record<string, unknown>;
  const styleFileIds = Array.isArray(kit.styleFileIds)
    ? kit.styleFileIds.filter((id): id is string => typeof id === 'string').slice(0, 3)
    : [];
  return {
    logoFileId: typeof kit.logoFileId === 'string' ? kit.logoFileId : null,
    styleFileIds,
    watermark: kit.watermark !== false,
  };
}

/**
 * Beat image always first (subject to preserve), then logo, then style refs.
 * Never drop the beat when the brand kit is full.
 */
function brandReferenceIds(kit: StoryBrandKit, beatFileId: string): string[] {
  const rest: string[] = [];
  if (kit.logoFileId && kit.logoFileId !== beatFileId) rest.push(kit.logoFileId);
  for (const id of kit.styleFileIds || []) {
    if (id && id !== beatFileId && !rest.includes(id)) rest.push(id);
  }
  return [beatFileId, ...rest].slice(0, 4);
}

export async function setStoryBrandKit(
  ownerUserId: string,
  storyId: string,
  kit: StoryBrandKit,
): Promise<StorySessionDto> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const nextKit: StoryBrandKit = {
    logoFileId: kit.logoFileId ?? null,
    styleFileIds: [...new Set(kit.styleFileIds || [])].slice(0, 3),
    watermark: kit.watermark !== false,
  };
  return updateStory(ownerUserId, storyId, {
    metadata: {
      ...(existing.metadata as Record<string, unknown>),
      brandKit: nextKit,
    },
  });
}

export type StoryBrandTextMode = 'none' | 'title';

/**
 * Brand this beat — ATRISI look applied to THIS photo via brand kit.
 *
 * Providers (distinct from More visuals):
 * - textMode=none → BFL/FLUX edit remix (subject lock) + logo watermark
 * - textMode=title → Ideogram typography + brand kit (logo/styles); beat described via vision,
 *   not attached as a style photo (avoids remixed garbage letters)
 */
export async function brandStoryBeat(
  ownerUserId: string,
  storyId: string,
  beatId: string,
  options?: { textMode?: StoryBrandTextMode },
): Promise<{ story: StorySessionDto; provider: string; fileId: string; addedBeatId: string }> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const beat = findBeatOrThrow(existing.beats, beatId);
  if (!beat.fileId) {
    throw Object.assign(new Error('Beat has no image to brand'), { statusCode: 400 });
  }
  const kit = getStoryBrandKit(existing.metadata as Record<string, unknown>);
  const headline = cleanStoryTypography(beat.title, 56);
  const textMode: StoryBrandTextMode =
    options?.textMode || (headline ? 'title' : 'none');
  const useBrandCopy = textMode === 'title' && Boolean(headline);
  const watermark = Boolean(kit.logoFileId) && kit.watermark !== false;

  const brandKitStyleIds: string[] = [];
  if (kit.logoFileId && kit.logoFileId !== beat.fileId) brandKitStyleIds.push(kit.logoFileId);
  for (const id of kit.styleFileIds || []) {
    if (id && id !== beat.fileId && !brandKitStyleIds.includes(id)) brandKitStyleIds.push(id);
  }

  const promptParts = useBrandCopy
    ? [
        'ATRISI Marketing branded institutional acquisition creative for THIS subject (from scene description).',
        'Apply ATRISI institute brand: teal #0F766E accents on navy #0F172A with blue #1E40AF — premium institutional look, clean visual hierarchy.',
        'Preserve the recognizable people and place from the description — branded treatment of the same moment, not a random stock scene.',
        'Do not use gold, purple, fuchsia, neon cyan, or generic university crest clichés.',
      ]
    : [
        'Remix THIS uploaded subject photo into an ATRISI Marketing institutional acquisition visual.',
        'Preserve the recognizable people, place, and composition from the first reference image — subject-locked edit.',
        'Apply ATRISI teal #0F766E and navy #0F172A color grade, premium institutional look.',
        'Do not use gold, purple, fuchsia, or neon cyan.',
        'TEXT-FREE brand pass: no readable text, headlines, CTAs, or gibberish. Empty margins for later overlay.',
      ];

  if (useBrandCopy && headline) {
    promptParts.push(
      `Brand typography — render ONLY this headline letter-perfect: "${headline}".`,
    );
    // Captions from Build story are often long — they spawn garbage slogans. Title only by default.
    promptParts.push(
      'No other slogans, fake stats, dates, CTAs, button labels, or gibberish. Only the headline above.',
    );
  }

  if (beat.vision?.what) {
    promptParts.push(`Subject to keep: ${beat.vision.what}.`);
  }

  if (watermark) {
    promptParts.push(
      'Place the official logo reference as a small corner mark (bottom-right preferred), about 8–12% of frame width. Prefer the logo graphic; do not invent extra seals.',
    );
  } else if (kit.logoFileId) {
    promptParts.push('Do not invent logos. Logo reference may inform brand color only.');
  } else {
    promptParts.push('Do not add fake logos.');
  }

  // Brand look = BFL/FLUX subject remix. Brand + title = Ideogram + brand kit (not the same as More visuals).
  const providerOverride = useBrandCopy ? 'ideogram' : 'flux';

  const generated = await generateCreativeImages({
    ownerUserId,
    prompt: promptParts.join(' '),
    style: useBrandCopy ? 'marketing_poster' : 'photo_realistic',
    quality: 'standard',
    aspectRatio: getStoryAspectRatio(existing.metadata as Record<string, unknown>),
    titleHint: beat.title || 'ATRISI branded beat',
    // Vision always sees the beat (+ kit). Provider attach differs by mode.
    referenceFileIds: brandReferenceIds(kit, beat.fileId),
    referenceMode: useBrandCopy ? 'style' : 'edit',
    visionOnlyReferences: useBrandCopy,
    providerReferenceFileIds: useBrandCopy ? brandKitStyleIds.slice(0, 3) : undefined,
    analyzeReferences: true,
    variantCount: 1,
    providerOverride,
    metadata: {
      source: 'story_brand_beat',
      storyId,
      beatId,
      originalFileId: beat.fileId,
      textMode,
      watermark,
      providerRole: useBrandCopy ? 'ideogram_brand_typography' : 'flux_brand_remix',
      usedBrandKit: Boolean(kit.logoFileId || (kit.styleFileIds && kit.styleFileIds.length)),
      format: getStoryFormat(existing.metadata as Record<string, unknown>).id,
    },
    precision: {
      textFree: !useBrandCopy,
      headline: useBrandCopy ? headline : undefined,
      cta: undefined,
      mustIncludeText: useBrandCopy ? headline : undefined,
      brandTheme: ATRISI_STORY_BRAND_THEME,
      paletteType: 'atrisi_institute',
      useLogoReference: watermark,
      avoid: useBrandCopy
        ? 'any text except the quoted headline, gibberish, misspellings, extra slogans, fake CTAs, Apply Now, Learn More, neon, purple glow, fuchsia, cyan cyberpunk, gold seals, clutter'
        : 'any readable text, gibberish letters, misspelled words, fake logos, neon, purple glow, fuchsia, cyan cyberpunk, gold seals, cluttered stickers, CTAs, captions, signage',
    },
  });

  const newFileId = generated.files[0]?.fileId;
  if (!newFileId) {
    throw Object.assign(new Error('Creative AI returned no branded image'), { statusCode: 502 });
  }

  const insertAt = existing.beats.findIndex((b) => b.id === beatId);
  const addedBeatId = randomUUID();
  const brandedBeat: StoryBeat = {
    id: addedBeatId,
    fileId: newFileId,
    sourceFileId: beat.fileId,
    title: beat.title,
    caption: beat.caption,
    notes: useBrandCopy
      ? `Brand · Ideogram + brand kit · title on image · original kept`
      : `Brand · FLUX/BFL subject remix · visual only · original kept`,
    order: insertAt + 1,
    arcRole: beat.arcRole || 'other',
    vision: null,
  };

  const before = existing.beats.slice(0, insertAt + 1);
  const after = existing.beats.slice(insertAt + 1);
  const beats = [...before, brandedBeat, ...after].map((b, order) => ({ ...b, order }));

  const story = await updateStory(ownerUserId, storyId, { beats });
  return { story, provider: generated.provider, fileId: newFileId, addedBeatId };
}

/**
 * More visuals — alternate associated shots (not a brand-kit pass).
 *
 * Providers (distinct from Brand):
 * - textMode=none → BFL/FLUX only: fresh angle / framing of the same subject
 * - textMode=title|title_caption → Ideogram only: new poster from scene description + Story copy
 *   (no brand kit / logo watermark — use Brand for that)
 */
export async function generateSimilarStoryBeats(
  ownerUserId: string,
  storyId: string,
  beatId: string,
  options?: { count?: number; textMode?: 'none' | 'title' | 'title_caption' },
): Promise<{ story: StorySessionDto; provider: string; addedBeatIds: string[] }> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const beat = findBeatOrThrow(existing.beats, beatId);
  if (!beat.fileId) {
    throw Object.assign(new Error('Beat has no image for More visuals'), { statusCode: 400 });
  }
  const perProvider = Math.min(Math.max(options?.count || 1, 1), 2);

  const headline = cleanStoryTypography(beat.title, 56);
  const cta = cleanStoryTypography(beat.caption?.split(/[.!?\n]/)[0] || '', 40);
  const requestedMode = options?.textMode;
  const textMode: 'none' | 'title' | 'title_caption' =
    requestedMode || (headline ? 'title' : 'none');
  const useCopy = textMode !== 'none' && Boolean(headline);
  const includeCaption = textMode === 'title_caption' && Boolean(cta) && cta !== headline;

  const promptParts = useCopy
    ? [
        'New institutional acquisition marketing visual inspired by this scene description.',
        'Fresh framing and composition — an associated shot, not a brand-kit restyle of the same frame.',
        'Premium look, natural lighting, recognizable subject from the description.',
        'Do not add logos or watermarks.',
      ]
    : [
        'Associated photograph matching the first reference image — fresh angle or framing, not a duplicate.',
        'Same people, place, and lighting. Subject-locked photo remix (BFL/FLUX).',
        'Premium natural photo. Do not apply brand logos or poster layouts.',
        'Critical: strip all text — no letters, signs, captions, or watermarks. Blank surfaces for later copy.',
      ];

  if (beat.vision?.what) {
    promptParts.push(`Keep recognizable: ${beat.vision.what}.`);
  }
  if (!useCopy && beat.vision?.onImageText) {
    promptParts.push(
      'The reference contains on-image lettering — erase it completely; do not redraw or invent replacement words.',
    );
  }
  if (beat.vision?.mood) {
    promptParts.push(`Mood: ${beat.vision.mood}.`);
  }

  // More visuals: Ideogram for copy posters; FLUX/BFL alone for photo variants (not both)
  const providerOverride = useCopy ? 'ideogram' : 'flux';

  let batch;
  try {
    batch = await generateCreativeImages({
      ownerUserId,
      prompt: promptParts.join(' '),
      style: useCopy ? 'marketing_poster' : 'photo_realistic',
      quality: 'standard',
      aspectRatio: getStoryAspectRatio(existing.metadata as Record<string, unknown>),
      titleHint: useCopy ? beat.title || 'Story visual' : 'Similar visual',
      referenceFileIds: [beat.fileId],
      referenceMode: useCopy ? 'style' : 'edit',
      visionOnlyReferences: useCopy,
      analyzeReferences: true,
      variantCount: perProvider,
      providerOverride,
      metadata: {
        source: 'story_generate_similar',
        storyId,
        beatId,
        referenceFileId: beat.fileId,
        textFree: !useCopy,
        withCopy: useCopy,
        textMode,
        providerRole: useCopy ? 'ideogram_story_poster' : 'flux_associated_photo',
        format: getStoryFormat(existing.metadata as Record<string, unknown>).id,
      },
      precision: {
        textFree: !useCopy,
        headline: useCopy ? headline : undefined,
        cta: includeCaption ? cta : undefined,
        mustIncludeText: useCopy ? headline : undefined,
        brandTheme: ATRISI_STORY_BRAND_THEME,
        paletteType: 'atrisi_institute',
        useLogoReference: false,
        avoid: useCopy
          ? 'any text except the quoted headline' +
            (includeCaption ? '/supporting line' : '') +
            ', gibberish, misspellings, extra slogans, fake CTAs, Apply Now, Learn More, logos, watermarks, badge stacks, neon, purple glow, fuchsia, cyan cyberpunk, gold seals, clutter'
          : 'any readable text, letters, words, gibberish, captions, headlines, CTAs, logos, watermarks, signage, posters, subtitles, UI chrome, neon, purple glow, fuchsia, cyan, gold seals, clutter, exact duplicate of reference',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw Object.assign(
      new Error(
        useCopy
          ? `More visuals failed (Ideogram). ${message}`
          : `More visuals failed (FLUX/BFL). ${message} — add a BFL key in Settings for photo variants, or set on-image text to Title for Ideogram posters.`,
      ),
      { statusCode: (error as { statusCode?: number })?.statusCode || 502 },
    );
  }

  const collected = batch.files
    .filter((f) => f.fileId)
    .map((f) => ({ fileId: f.fileId, provider: batch.provider }));

  if (collected.length === 0) {
    throw Object.assign(new Error('More visuals returned no images'), { statusCode: 502 });
  }

  const insertAt = existing.beats.findIndex((b) => b.id === beatId);
  const added: StoryBeat[] = collected.map((item, index) => ({
    id: randomUUID(),
    fileId: item.fileId,
    sourceFileId: beat.fileId,
    title: beat.title || `Visual ${index + 1}`,
    caption: beat.caption || '',
    notes: useCopy
      ? `More visuals · Ideogram poster · ${textMode === 'title_caption' ? 'title+caption' : 'title only'} · no brand kit`
      : `More visuals · FLUX/BFL associated photo · text-free`,
    order: insertAt + 1 + index,
    arcRole: beat.arcRole || 'other',
    vision: null,
  }));

  const before = existing.beats.slice(0, insertAt + 1);
  const after = existing.beats.slice(insertAt + 1);
  const beats = [...before, ...added, ...after].map((b, order) => ({ ...b, order }));

  const story = await updateStory(ownerUserId, storyId, { beats });
  return {
    story,
    provider: batch.provider,
    addedBeatIds: added.map((b) => b.id),
  };
}

export async function proposeStoryline(
  ownerUserId: string,
  storyId: string,
  options?: { refreshVision?: boolean; keepOrder?: boolean },
): Promise<{
  story: StorySessionDto;
  source: 'vision-compose' | 'vision-heuristic' | 'heuristic';
  visionCount: number;
  reordered: boolean;
  thesis?: string;
  warnings?: string[];
}> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  if (!existing.beats.length) {
    throw Object.assign(new Error('Add assets before proposing a storyline'), {
      statusCode: 400,
    });
  }

  const refreshVision = Boolean(options?.refreshVision);
  // Default: allow rearrange so upload order does not dictate the story
  const keepOrder = Boolean(options?.keepOrder);

  // 1) See — per-beat Groq vision cards
  const seen = await seeBeatVisionCards(ownerUserId, existing.beats, refreshVision);

  // 2) Combine — fuse all vision into one thesis + reorder (multi-vision when 2–5 assets)
  const combined = await combineVisionIntoStory(
    ownerUserId,
    existing.title,
    seen.beats,
    keepOrder,
  );
  const structure =
    combined ||
    (await structureStoryline(existing.title, seen.beats, keepOrder).then((s) =>
      s
        ? {
            ...s,
            thesis: s.thesis || '',
            reordered: s.orderedIds.some((id, i) => id !== seen.beats[i]?.id),
            method: 'structure' as const,
          }
        : null,
    ));

  let proposal: { title: string; arc: string; tone: string; beats: StoryBeat[] };
  let source: 'vision-compose' | 'vision-heuristic' | 'heuristic' = 'heuristic';
  let reordered = false;
  let thesis = '';

  if (structure) {
    reordered = Boolean(structure.reordered);
    thesis = structure.thesis || '';
    const byId = new Map(seen.beats.map((b) => [b.id, b]));
    const structuredBeats: StoryBeat[] = structure.orderedIds
      .map((id, order) => {
        const beat = byId.get(id);
        if (!beat) return null;
        return {
          ...beat,
          order,
          arcRole: structure.roles[id] || beat.arcRole || beat.vision?.narrativeFit || 'other',
        };
      })
      .filter(Boolean) as StoryBeat[];

    // 3) Speak — captions serve the unified thesis
    const copy = await speakStoryline(structure.title, structuredBeats, thesis);
    if (copy) {
      proposal = {
        title: structure.title,
        arc: structure.arc,
        tone: structure.tone,
        beats: structuredBeats.map((beat) => {
          const spoken = copy.get(beat.id);
          const notesFromVision = beat.vision
            ? `${beat.arcRole || 'beat'} — ${beat.vision.what}`
            : beat.notes;
          return {
            ...beat,
            title: sanitizeBeatTitle(spoken?.title || beat.title),
            caption: sanitizeBeatCaption(
              spoken?.caption || beat.vision?.claimHint || beat.caption,
            ),
            notes: spoken?.notes || notesFromVision,
          };
        }),
      };
      source = seen.visionCount > 0 ? 'vision-compose' : 'heuristic';
    } else {
      proposal = applyHeuristicFromVision(structuredBeats, structure.title);
      source = seen.visionCount > 0 ? 'vision-heuristic' : 'heuristic';
    }
  } else {
    proposal = applyHeuristicFromVision(seen.beats, existing.title);
    reordered = proposal.beats.some((b, i) => b.id !== seen.beats[i]?.id);
    source = seen.visionCount > 0 ? 'vision-heuristic' : 'heuristic';
  }

  // 4) Enforce Context → Proof → Ask; warn (don't block) when vision unavailable
  const validated = enforceAndValidateStoryArc(proposal.beats, {
    visionCount: seen.visionCount,
    visionDiag: seen.diag,
  });
  if (!validated.ok) {
    throw Object.assign(new Error(validated.errors.join(' ')), {
      statusCode: 422,
      details: { errors: validated.errors, warnings: validated.warnings },
    });
  }

  const arcChanged = validated.beats.some(
    (b, i) => b.id !== proposal.beats[i]?.id || b.arcRole !== proposal.beats[i]?.arcRole,
  );
  if (arcChanged) reordered = true;

  proposal = {
    ...proposal,
    arc: 'context_proof_ask',
    beats: validated.beats.map((beat) => {
      const spoken = proposal.beats.find((b) => b.id === beat.id);
      return {
        ...beat,
        title: spoken?.title || beat.title,
        caption: spoken?.caption || beat.caption,
        notes: spoken?.notes || beat.notes,
      };
    }),
  };

  const story = await updateStory(ownerUserId, storyId, {
    title: proposal.title,
    arc: proposal.arc,
    tone: proposal.tone,
    beats: proposal.beats,
    status: 'ready',
    metadata: {
      lastProposeSource: source,
      lastProposedAt: new Date().toISOString(),
      lastVisionCount: seen.visionCount,
      lastThesis: thesis || undefined,
      lastReordered: reordered,
      lastProposeWarnings: validated.warnings,
      composePipeline: 'see_combine_speak',
      combineMethod: combined?.method || (structure ? 'structure' : 'heuristic'),
    },
  });

  return {
    story,
    source,
    visionCount: seen.visionCount,
    reordered,
    thesis: thesis || undefined,
    warnings: validated.warnings,
  };
}

function storySafeFilename(title: string, ext: string): string {
  const safeName = (title || 'story')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${safeName || 'atrisi-story'}.${ext}`;
}

async function loadBeatImageForExport(
  actorUserId: string,
  fileId: string,
  options?: { allowWebp?: boolean },
): Promise<{ mime: string; base64: string } | null> {
  try {
    const [fileRow] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);
    if (!fileRow) return null;
    if (!(await canActorAccessOwnerResource(actorUserId, fileRow.userId))) return null;
    const mime = (fileRow.mimetype || '').toLowerCase();
    const isPng = mime.includes('png');
    const isJpeg = mime.includes('jpeg') || mime.includes('jpg');
    const isWebp = mime.includes('webp');
    if (!isPng && !isJpeg && !(options?.allowWebp && isWebp) && !mime.startsWith('image/')) {
      return null;
    }
    const { resolveFileImageBytes } = await import('./file-bytes.js');
    const resolved = await resolveFileImageBytes({
      id: fileRow.id,
      originalName: fileRow.originalName,
      filename: fileRow.filename,
      mimetype: fileRow.mimetype,
      storageKey: fileRow.storageKey,
      metadata: fileRow.metadata as Record<string, unknown> | null,
    });
    return {
      mime: resolved.contentType,
      base64: resolved.buffer.toString('base64'),
    };
  } catch (error) {
    logger.warn('Story export image load failed', {
      fileId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function exportStoryPptx(
  ownerUserId: string,
  storyId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const story = await getOwnedStory(ownerUserId, storyId);
  const beats = sortBeatsByStoryArc([...story.beats]);
  const meta = story.metadata as Record<string, unknown>;
  const format = getStoryFormat(meta);
  const kit = getStoryBrandKit(meta);
  let watermarkLogo: { mime: string; base64: string } | null = null;
  if (kit.logoFileId && kit.watermark !== false) {
    watermarkLogo = await loadBeatImageForExport(ownerUserId, kit.logoFileId, { allowWebp: true });
  }

  if (beats.length === 0) {
    throw Object.assign(new Error('Story has no beats to export'), { statusCode: 400 });
  }

  let PptxCtor: new () => any;
  try {
    const pptxMod = requirePptx('pptxgenjs');
    PptxCtor = pptxMod?.default || pptxMod;
    if (typeof PptxCtor !== 'function') {
      throw new Error('pptxgenjs did not export a constructor');
    }
  } catch (error) {
    logger.error('Story PPTX dependency load failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw Object.assign(
      new Error(
        'PPTX export unavailable on this server. Use Visual pack (HTML) or Carousel brief (MD) instead.',
      ),
      { statusCode: 503 },
    );
  }

  const slideW = format.pptx.width;
  const slideH = format.pptx.height;
  const pptx = new PptxCtor();
  pptx.author = 'ATRISI Marketing';
  pptx.title = story.title;
  pptx.subject = `Story export · ${format.label} · Context → Proof → Ask`;
  pptx.defineLayout({ name: format.pptx.name, width: slideW, height: slideH });
  pptx.layout = format.pptx.name;

  const thesis =
    typeof meta.lastThesis === 'string' ? String(meta.lastThesis) : 'Context → Proof → Ask';

  const addLogo = (
    slide: { addImage: (opts: Record<string, unknown>) => void },
    box: { x: number; y: number; w: number; h: number },
  ) => {
    if (!watermarkLogo) return;
    const logoRaw = Buffer.from(watermarkLogo.base64, 'base64');
    const logoPx = readImagePixelSize(logoRaw) || { width: 400, height: 200 };
    const logoFit = fitImageInBox(logoPx.width, logoPx.height, box.x, box.y, box.w, box.h);
    slide.addImage({
      data: `data:${watermarkLogo.mime};base64,${watermarkLogo.base64}`,
      x: logoFit.x,
      y: logoFit.y,
      w: logoFit.w,
      h: logoFit.h,
    });
  };

  // Title slide
  {
    const slide = pptx.addSlide();
    slide.background = { color: '0F172A' };
    const pad = Math.min(0.7, slideW * 0.08);
    slide.addText('ATRISI', {
      x: pad,
      y: slideH * 0.28,
      w: slideW - pad * 2,
      h: 0.35,
      fontSize: 14,
      color: '2DD4BF',
      fontFace: 'Arial',
      bold: true,
    });
    slide.addText(story.title || 'Untitled story', {
      x: pad,
      y: slideH * 0.34,
      w: slideW - pad * 2,
      h: Math.min(1.4, slideH * 0.2),
      fontSize: format.layout === 'fullbleed' ? 28 : 36,
      color: 'F8FAFC',
      fontFace: 'Arial',
      bold: true,
    });
    slide.addText(`${format.label} · ${thesis}`, {
      x: pad,
      y: slideH * 0.55,
      w: slideW - pad * 2,
      h: 0.9,
      fontSize: 14,
      color: '94A3B8',
      fontFace: 'Arial',
    });
    addLogo(slide, {
      x: slideW - 1.5,
      y: slideH - 0.9,
      w: 1.2,
      h: 0.6,
    });
  }

  const grouped = groupBeatsByArc(beats);
  let slideIndex = 0;

  for (const role of ['context', 'proof', 'ask', 'other'] as const) {
    const group = grouped[role];
    if (group.length === 0) continue;

    // Section divider (deck only — fullbleed stays image-led)
    if (format.layout === 'deck') {
      const divider = pptx.addSlide();
      divider.background = { color: '0F172A' };
      divider.addText(ARC_LABELS[role].toUpperCase(), {
        x: 0.7,
        y: slideH * 0.4,
        w: slideW - 1.4,
        h: 0.55,
        fontSize: 28,
        color: '2DD4BF',
        fontFace: 'Arial',
        bold: true,
      });
      divider.addText(`${group.length} beat${group.length === 1 ? '' : 's'}`, {
        x: 0.7,
        y: slideH * 0.4 + 0.65,
        w: slideW - 1.4,
        h: 0.35,
        fontSize: 14,
        color: '94A3B8',
        fontFace: 'Arial',
      });
    }

    for (const beat of group) {
      slideIndex += 1;
      const slide = pptx.addSlide();
      const storyLine = [beat.caption, beat.notes].filter(Boolean).join(' — ');
      const roleLabel = `${ARC_LABELS[role].toUpperCase()}  ·  ${slideIndex}`;

      let image: { mime: string; base64: string } | null = null;
      let pixels = { width: 1920, height: 1080 };
      if (beat.fileId) {
        image = await loadBeatImageForExport(ownerUserId, beat.fileId);
        if (image) {
          const raw = Buffer.from(image.base64, 'base64');
          pixels = readImagePixelSize(raw) || pixels;
        }
      }

      if (format.layout === 'fullbleed') {
        slide.background = { color: '0F172A' };
        if (image) {
          try {
            // Cover the full slide so carousel/feed/stories use pixels optimally
            slide.addImage({
              data: `data:${image.mime};base64,${image.base64}`,
              x: 0,
              y: 0,
              w: slideW,
              h: slideH,
              sizing: { type: 'cover', w: slideW, h: slideH },
            });
          } catch (error) {
            // Fallback without sizing API
            const fitted = fitImageInBox(pixels.width, pixels.height, 0, 0, slideW, slideH);
            slide.addImage({
              data: `data:${image.mime};base64,${image.base64}`,
              x: fitted.x,
              y: fitted.y,
              w: fitted.w,
              h: fitted.h,
            });
            logger.warn('Story PPTX cover sizing fallback', {
              beatId: beat.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        // Overlay bars for readable copy
        try {
          const rect = pptx.ShapeType?.rect;
          if (rect) {
            slide.addShape(rect, {
              x: 0,
              y: 0,
              w: slideW,
              h: Math.min(1.35, slideH * 0.18),
              fill: { color: '0F172A', transparency: 35 },
              line: { color: '0F172A', transparency: 100 },
            });
            slide.addShape(rect, {
              x: 0,
              y: slideH - Math.min(1.8, slideH * 0.24),
              w: slideW,
              h: Math.min(1.8, slideH * 0.24),
              fill: { color: '0F172A', transparency: 30 },
              line: { color: '0F172A', transparency: 100 },
            });
          }
        } catch {
          // Shapes optional — text overlays still render
        }
        slide.addText(roleLabel, {
          x: 0.35,
          y: 0.25,
          w: slideW - 0.7,
          h: 0.28,
          fontSize: 11,
          color: '2DD4BF',
          fontFace: 'Arial',
          bold: true,
        });
        slide.addText(beat.title || 'Beat', {
          x: 0.35,
          y: 0.55,
          w: slideW - 0.7,
          h: 0.55,
          fontSize: 22,
          color: 'F8FAFC',
          fontFace: 'Arial',
          bold: true,
        });
        if (storyLine) {
          slide.addText(storyLine, {
            x: 0.35,
            y: slideH - Math.min(1.55, slideH * 0.2),
            w: slideW - 1.6,
            h: Math.min(1.2, slideH * 0.16),
            fontSize: 13,
            color: 'E2E8F0',
            fontFace: 'Arial',
            valign: 'top',
          });
        }
        addLogo(slide, {
          x: slideW - 1.25,
          y: slideH - 0.85,
          w: 0.95,
          h: 0.55,
        });
        continue;
      }

      // Deck layout — pick split vs stack from source image aspect
      slide.background = { color: 'F8FAFC' };
      const layout = pickDeckImageLayout(pixels.width, pixels.height, slideW, slideH);

      slide.addText(roleLabel, {
        x: layout.roleBox.x,
        y: layout.roleBox.y,
        w: layout.roleBox.w,
        h: layout.roleBox.h,
        fontSize: 11,
        color: '0D9488',
        fontFace: 'Arial',
        bold: true,
      });
      slide.addText(beat.title || 'Beat', {
        x: layout.titleBox.x,
        y: layout.titleBox.y,
        w: layout.titleBox.w,
        h: layout.titleBox.h,
        fontSize: layout.mode === 'split' ? 26 : 22,
        color: '0F172A',
        fontFace: 'Arial',
        bold: true,
        valign: 'top',
      });

      if (image) {
        try {
          const box = layout.imageBox;
          if (format.imageFit === 'cover') {
            slide.addImage({
              data: `data:${image.mime};base64,${image.base64}`,
              x: box.x,
              y: box.y,
              w: box.w,
              h: box.h,
              sizing: { type: 'cover', w: box.w, h: box.h },
            });
          } else {
            const fitted = fitImageInBox(
              pixels.width,
              pixels.height,
              box.x,
              box.y,
              box.w,
              box.h,
            );
            // Prefer contain with correct aspect; if near-match, use cover to fill
            const srcAspect = pixels.width / Math.max(pixels.height, 1);
            const boxAspect = box.w / Math.max(box.h, 1);
            const closeMatch = Math.abs(srcAspect - boxAspect) / boxAspect < 0.12;
            if (closeMatch) {
              slide.addImage({
                data: `data:${image.mime};base64,${image.base64}`,
                x: box.x,
                y: box.y,
                w: box.w,
                h: box.h,
                sizing: { type: 'cover', w: box.w, h: box.h },
              });
            } else {
              slide.addImage({
                data: `data:${image.mime};base64,${image.base64}`,
                x: fitted.x,
                y: fitted.y,
                w: fitted.w,
                h: fitted.h,
              });
            }
          }
        } catch (error) {
          logger.warn('Story PPTX addImage failed', {
            beatId: beat.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (storyLine) {
        slide.addText(storyLine, {
          x: layout.captionBox.x,
          y: layout.captionBox.y,
          w: layout.captionBox.w,
          h: layout.captionBox.h,
          fontSize: 14,
          color: '334155',
          fontFace: 'Arial',
          valign: 'top',
        });
      }

      addLogo(slide, {
        x: slideW - 1.35,
        y: slideH - 0.75,
        w: 1.0,
        h: 0.5,
      });
    }
  }

  // Closing ask slide
  {
    const askBeats = grouped.ask;
    const closing =
      askBeats[askBeats.length - 1]?.caption ||
      askBeats[askBeats.length - 1]?.title ||
      thesis;
    const close = pptx.addSlide();
    close.background = { color: '0F172A' };
    const pad = Math.min(0.7, slideW * 0.08);
    close.addText('ASK', {
      x: pad,
      y: slideH * 0.32,
      w: slideW - pad * 2,
      h: 0.35,
      fontSize: 14,
      color: '2DD4BF',
      fontFace: 'Arial',
      bold: true,
    });
    close.addText(closing, {
      x: pad,
      y: slideH * 0.38,
      w: slideW - pad * 2,
      h: Math.min(2.2, slideH * 0.35),
      fontSize: format.layout === 'fullbleed' ? 24 : 28,
      color: 'F8FAFC',
      fontFace: 'Arial',
      bold: true,
    });
    addLogo(close, {
      x: slideW - 1.5,
      y: slideH - 0.9,
      w: 1.2,
      h: 0.6,
    });
  }

  try {
    const output = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
    return {
      buffer: Buffer.isBuffer(output) ? output : Buffer.from(output),
      filename: storySafeFilename(story.title, 'pptx'),
    };
  } catch (error) {
    logger.error('Story PPTX write failed', {
      storyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw Object.assign(
      new Error(
        error instanceof Error
          ? `PPTX export failed: ${error.message}`
          : 'PPTX export failed',
      ),
      { statusCode: 500 },
    );
  }
}

/** High-quality image ZIP — one file per beat, ordered Context → Proof → Ask */
export async function exportStoryImagesZip(
  ownerUserId: string,
  storyId: string,
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const story = await getOwnedStory(ownerUserId, storyId);
  const beats = sortBeatsByStoryArc([...story.beats]);
  if (beats.length === 0) {
    throw Object.assign(new Error('Story has no beats to export'), { statusCode: 400 });
  }

  const entries: Array<{ name: string; data: Buffer }> = [];
  let index = 0;
  for (const beat of beats) {
    if (!beat.fileId) continue;
    const image = await loadBeatImageForExport(ownerUserId, beat.fileId, { allowWebp: true });
    if (!image) continue;
    index += 1;
    const role = beat.arcRole || 'other';
    const ext = image.mime.includes('jpeg') || image.mime.includes('jpg')
      ? 'jpg'
      : image.mime.includes('webp')
        ? 'webp'
        : 'png';
    const name = `${String(index).padStart(2, '0')}-${role}-${safeExportSlug(beat.title || 'beat')}.${ext}`;
    entries.push({ name, data: Buffer.from(image.base64, 'base64') });
  }

  if (entries.length === 0) {
    throw Object.assign(
      new Error('No beat images available to export. Re-upload assets and try again.'),
      { statusCode: 400 },
    );
  }

  const manifest = [
    `# ${story.title || 'ATRISI Story'}`,
    '',
    'High-quality beat images · Context → Proof → Ask',
    '',
    ...entries.map((e) => `- ${e.name}`),
    '',
  ].join('\n');
  entries.unshift({ name: 'README.md', data: Buffer.from(manifest, 'utf8') });

  return {
    buffer: buildZipArchive(entries),
    filename: storySafeFilename(story.title, 'zip'),
    contentType: 'application/zip',
  };
}

/** Carousel / social copy brief aligned to Context → Proof → Ask */
export async function exportStoryMarkdown(
  ownerUserId: string,
  storyId: string,
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const story = await getOwnedStory(ownerUserId, storyId);
  const beats = [...story.beats].sort((a, b) => a.order - b.order);
  if (beats.length === 0) {
    throw Object.assign(new Error('Story has no beats to export'), { statusCode: 400 });
  }

  const thesis =
    typeof (story.metadata as Record<string, unknown>)?.lastThesis === 'string'
      ? String((story.metadata as Record<string, unknown>).lastThesis)
      : '';

  const lines = [
    `# ${story.title || 'Untitled story'}`,
    '',
    `> ATRISI Marketing · Story export · Context → Proof → Ask`,
    thesis ? `> Thesis: ${thesis}` : '',
    '',
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === ''));

  const byArc: Record<string, typeof beats> = {
    context: [],
    proof: [],
    ask: [],
    other: [],
  };
  for (const beat of beats) {
    const role = beat.arcRole && byArc[beat.arcRole] ? beat.arcRole : 'other';
    byArc[role].push(beat);
  }

  for (const role of ['context', 'proof', 'ask', 'other'] as const) {
    const group = byArc[role];
    if (group.length === 0) continue;
    lines.push(`## ${ARC_LABELS[role] || 'Beat'}`);
    lines.push('');
    for (const [index, beat] of group.entries()) {
      lines.push(`### ${index + 1}. ${beat.title || 'Untitled beat'}`);
      lines.push('');
      if (beat.caption) {
        lines.push(beat.caption);
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push('_Studio creates · Products operate · Platform remembers_');
  lines.push('');

  return {
    buffer: Buffer.from(lines.join('\n'), 'utf8'),
    filename: storySafeFilename(story.title, 'md'),
    contentType: 'text/markdown; charset=utf-8',
  };
}

export async function exportStoryJson(
  ownerUserId: string,
  storyId: string,
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const story = await getOwnedStory(ownerUserId, storyId);
  const beats = [...story.beats].sort((a, b) => a.order - b.order);
  if (beats.length === 0) {
    throw Object.assign(new Error('Story has no beats to export'), { statusCode: 400 });
  }

  const payload = {
    format: 'atrisi-story-v1',
    exportedAt: new Date().toISOString(),
    title: story.title,
    arc: story.arc,
    tone: story.tone,
    thesis: (story.metadata as Record<string, unknown>)?.lastThesis ?? null,
    brandKit: getStoryBrandKit(story.metadata as Record<string, unknown>),
    beats: beats.map((beat, index) => ({
      order: index + 1,
      id: beat.id,
      arcRole: beat.arcRole || 'other',
      arcLabel: ARC_LABELS[beat.arcRole || 'other'] || 'Beat',
      title: beat.title,
      caption: beat.caption,
      fileId: beat.fileId,
      notes: beat.notes,
    })),
  };

  return {
    buffer: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
    filename: storySafeFilename(story.title, 'json'),
    contentType: 'application/json; charset=utf-8',
  };
}

/** Self-contained HTML carousel pack for review / handoff */
export async function exportStoryHtml(
  ownerUserId: string,
  storyId: string,
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const story = await getOwnedStory(ownerUserId, storyId);
  const beats = sortBeatsByStoryArc([...story.beats]);
  if (beats.length === 0) {
    throw Object.assign(new Error('Story has no beats to export'), { statusCode: 400 });
  }

  const meta = story.metadata as Record<string, unknown>;
  const format = getStoryFormat(meta);
  const frameClass =
    format.id === 'carousel'
      ? 'frame-1x1'
      : format.id === 'feed'
        ? 'frame-4x5'
        : format.id === 'story'
          ? 'frame-9x16'
          : 'frame-16x9';
  const maxW =
    format.id === 'story' ? '420px' : format.id === 'deck' ? '960px' : '560px';

  const thesis = typeof meta.lastThesis === 'string' ? String(meta.lastThesis) : '';

  const cards: string[] = [];
  const byArc = groupBeatsByArc(beats);

  let globalIndex = 0;
  for (const role of ['context', 'proof', 'ask', 'other'] as const) {
    const group = byArc[role];
    if (group.length === 0) continue;
    cards.push(`<h2 class="arc">${escapeHtml(ARC_LABELS[role] || 'Beat')}</h2>`);
    for (const beat of group) {
      globalIndex += 1;
      let img = '';
      if (beat.fileId) {
        const image = await loadBeatImageForExport(ownerUserId, beat.fileId, { allowWebp: true });
        if (image) {
          img = `<div class="frame ${frameClass}"><img src="data:${image.mime};base64,${image.base64}" alt="" /></div>`;
        } else {
          img = `<p class="missing">Image unavailable — re-upload this beat asset</p>`;
        }
      }
      cards.push(`
<article class="beat">
  <p class="role">${escapeHtml(ARC_LABELS[role] || 'Beat')} · ${globalIndex}/${beats.length}</p>
  <h3>${escapeHtml(beat.title || 'Beat')}</h3>
  ${img}
  <p class="caption">${escapeHtml(beat.caption || '')}</p>
</article>`);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(story.title || 'ATRISI Story')}</title>
<style>
  :root { color-scheme: light; --ink:#0f172a; --muted:#64748b; --teal:#0d9488; --bg:#f1f5f9; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Georgia, "Times New Roman", serif; background:var(--bg); color:var(--ink); }
  header { padding:2.5rem 1.5rem 1rem; max-width:${maxW}; margin:0 auto; }
  header .brand { font-family: system-ui, sans-serif; letter-spacing:.18em; text-transform:uppercase; font-size:.7rem; color:var(--teal); font-weight:700; }
  header h1 { font-size:2rem; margin:.5rem 0; }
  header .thesis { color:var(--muted); line-height:1.5; }
  header .format { font-family:system-ui,sans-serif; font-size:.75rem; color:var(--muted); }
  main { max-width:${maxW}; margin:0 auto; padding:0 1.5rem 3rem; display:grid; gap:1rem; }
  .arc { font-family: system-ui, sans-serif; font-size:.75rem; letter-spacing:.16em; text-transform:uppercase; color:var(--teal); margin:1.5rem 0 0.25rem; }
  .beat { background:#fff; padding:1.25rem; border-radius:4px; }
  .beat .role { font-family: system-ui, sans-serif; font-size:.7rem; letter-spacing:.14em; text-transform:uppercase; color:var(--teal); margin:0 0 .5rem; }
  .beat h3 { margin:0 0 1rem; font-size:1.35rem; }
  .frame { width:100%; overflow:hidden; background:#0f172a; margin:0 0 1rem; }
  .frame-1x1 { aspect-ratio:1/1; }
  .frame-4x5 { aspect-ratio:4/5; }
  .frame-9x16 { aspect-ratio:9/16; }
  .frame-16x9 { aspect-ratio:16/9; }
  .frame img { width:100%; height:100%; object-fit:cover; display:block; }
  .beat .caption { margin:0; color:#334155; line-height:1.55; font-size:1rem; }
  .beat .missing { margin:0 0 1rem; padding:1rem; background:#f8fafc; color:var(--muted); font-family:system-ui,sans-serif; font-size:.85rem; }
  footer { text-align:center; padding:2rem; color:var(--muted); font-size:.8rem; font-family:system-ui,sans-serif; }
</style>
</head>
<body>
<header>
  <p class="brand">ATRISI · Story · Context → Proof → Ask</p>
  <p class="format">${escapeHtml(format.label)} · ${escapeHtml(format.hint)}</p>
  <h1>${escapeHtml(story.title || 'Untitled story')}</h1>
  ${thesis ? `<p class="thesis">${escapeHtml(thesis)}</p>` : ''}
</header>
<main>
${cards.join('\n')}
</main>
<footer>Studio creates · Products operate · Platform remembers</footer>
</body>
</html>`;

  return {
    buffer: Buffer.from(html, 'utf8'),
    filename: storySafeFilename(story.title, 'html'),
    contentType: 'text/html; charset=utf-8',
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
