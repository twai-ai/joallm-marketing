/**
 * Story — Studio create workspace for multi-medium narrative compose.
 * Constitution: Studio creates. Products operate. Platform remembers.
 * Free-floating until attach; not a new aggregate root (Institution · Program · Person).
 */

import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { files, storySessions, type StoryBeat } from '../database/schema.js';
import { storageProvider } from './file-storage.js';
import { generateCreativeImages } from './creative-ai-generate-service.js';
import type { BrandThemeInput } from './creative-brand-theme.js';
import {
  applyHeuristicFromVision,
  combineVisionIntoStory,
  seeBeatVisionCards,
  speakStoryline,
  structureStoryline,
} from './story-compose-service.js';
import {
  buildOrgDualReadScope,
  resolveOrganizationIdForUser,
} from './organization-ownership.js';
import { logger } from '../utils/logger.js';

/** Default ATRISI Marketing visual theme for Story Creative AI actions */
export const ATRISI_STORY_BRAND_THEME: BrandThemeInput = {
  palette: {
    primary: '#0F766E',
    secondary: '#0F172A',
    accent: '#2DD4BF',
    background: '#F8FAFC',
    text: '#0F172A',
  },
  theme: {
    mood: 'premium institutional, trustworthy, calm authority',
    // Typography is applied in Story overlays — do not ask the image model for headlines
    layout: 'minimal, generous whitespace, clear visual hierarchy, empty margins for text overlay',
    imagery: 'real institutional life — campus, learners, mentors; not stock-ad clichés',
    density: 'sparse',
    notes:
      'ATRISI Marketing brand for Institution Acquisition. Teal + slate. No neon, no purple glow, no cluttered badge stacks. Images are text-free; copy lives in Story fields.',
  },
};

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
};

const ARC_LABELS: Record<string, string> = {
  context: 'Context',
  proof: 'Proof',
  ask: 'Ask',
  other: 'Beat',
};

function toDto(row: typeof storySessions.$inferSelect): StorySessionDto {
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
  };
}

async function scopeForUser(ownerUserId: string) {
  const organizationId = await resolveOrganizationIdForUser(ownerUserId);
  return {
    organizationId,
    scope: buildOrgDualReadScope({
      organizationId,
      ownerUserId,
      organizationColumn: storySessions.organizationId,
      ownerColumn: storySessions.ownerUserId,
    }),
  };
}

async function getOwnedStory(ownerUserId: string, storyId: string) {
  const { scope } = await scopeForUser(ownerUserId);
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

export async function listStories(ownerUserId: string): Promise<StorySessionDto[]> {
  const { scope } = await scopeForUser(ownerUserId);
  const rows = await db
    .select()
    .from(storySessions)
    .where(scope!)
    .orderBy(desc(storySessions.updatedAt))
    .limit(100);
  return rows.map(toDto);
}

export async function getStory(ownerUserId: string, storyId: string): Promise<StorySessionDto> {
  return toDto(await getOwnedStory(ownerUserId, storyId));
}

export async function createStory(
  ownerUserId: string,
  input?: { title?: string; tone?: string; arc?: string },
): Promise<StorySessionDto> {
  const organizationId = await resolveOrganizationIdForUser(ownerUserId);
  const [row] = await db
    .insert(storySessions)
    .values({
      ownerUserId,
      organizationId,
      title: input?.title?.trim() || 'Untitled story',
      tone: input?.tone || 'atrisi_institutional',
      arc: input?.arc || 'context_proof_ask',
      beats: [],
      metadata: { constitution: 'Studio creates. Products operate. Platform remembers.' },
    })
    .returning();
  return toDto(row);
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

  return toDto(row);
}

export async function deleteStory(ownerUserId: string, storyId: string): Promise<void> {
  await getOwnedStory(ownerUserId, storyId);
  await db.delete(storySessions).where(eq(storySessions.id, storyId));
}

export async function addBeatsFromFiles(
  ownerUserId: string,
  storyId: string,
  fileIds: string[],
): Promise<StorySessionDto> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const { scope } = await scopeForUser(ownerUserId);

  const ownedFiles = await db
    .select({ id: files.id, originalName: files.originalName })
    .from(files)
    .where(and(eq(files.userId, ownerUserId)));

  // Prefer dual-read when org-scoped files exist; fall back to user-owned list above.
  void scope;

  const ownedIdSet = new Set(ownedFiles.map((f) => f.id));
  const nameById = new Map(ownedFiles.map((f) => [f.id, f.originalName || 'Asset']));

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
};

export function getStoryBrandKit(metadata: Record<string, unknown> | null | undefined): StoryBrandKit {
  const raw = metadata?.brandKit;
  if (!raw || typeof raw !== 'object') return { logoFileId: null, styleFileIds: [] };
  const kit = raw as Record<string, unknown>;
  const styleFileIds = Array.isArray(kit.styleFileIds)
    ? kit.styleFileIds.filter((id): id is string => typeof id === 'string').slice(0, 3)
    : [];
  return {
    logoFileId: typeof kit.logoFileId === 'string' ? kit.logoFileId : null,
    styleFileIds,
  };
}

function brandReferenceIds(kit: StoryBrandKit, beatFileId: string): string[] {
  const ids: string[] = [];
  if (kit.logoFileId) ids.push(kit.logoFileId);
  for (const id of kit.styleFileIds || []) {
    if (id && !ids.includes(id)) ids.push(id);
  }
  if (!ids.includes(beatFileId)) ids.push(beatFileId);
  return ids.slice(0, 4);
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
  };
  return updateStory(ownerUserId, storyId, {
    metadata: {
      ...(existing.metadata as Record<string, unknown>),
      brandKit: nextKit,
    },
  });
}

/**
 * Brand this beat — Creative AI remix with ATRISI theme + optional brand kit refs.
 * Prefer clean visuals; Story titles/captions hold messaging (not invented poster text).
 */
export async function brandStoryBeat(
  ownerUserId: string,
  storyId: string,
  beatId: string,
): Promise<{ story: StorySessionDto; provider: string; fileId: string }> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const beat = findBeatOrThrow(existing.beats, beatId);
  const kit = getStoryBrandKit(existing.metadata as Record<string, unknown>);

  const promptParts = [
    'Restyle the subject reference into an ATRISI Marketing institutional acquisition visual.',
    'Keep the core subject and composition recognizable.',
    'Apply ATRISI teal and slate brand, premium institutional look, clean visual hierarchy.',
    'TEXT-FREE: zero readable text on the image — no headlines, CTAs, captions, signs, or gibberish letters. Leave empty safe area for Story title/caption overlay.',
    'Do not add fake logos unless a logo reference image is provided.',
  ];
  if (kit.logoFileId) {
    promptParts.push('Place the official logo mark only (corner / clear space). No invented wordmark lettering.');
  }
  if (beat.title) promptParts.push(`Mood only (do not render as text): ${beat.title}.`);

  const generated = await generateCreativeImages({
    ownerUserId,
    prompt: promptParts.join(' '),
    style: 'photo_realistic',
    quality: 'standard',
    aspectRatio: '16x9',
    titleHint: beat.title || 'ATRISI branded beat',
    referenceFileIds: brandReferenceIds(kit, beat.fileId!),
    referenceMode: 'style',
    analyzeReferences: true,
    variantCount: 1,
    metadata: {
      source: 'story_brand_beat',
      storyId,
      beatId,
      originalFileId: beat.fileId,
      usedBrandKit: Boolean(kit.logoFileId || (kit.styleFileIds && kit.styleFileIds.length)),
    },
    precision: {
      textFree: true,
      brandTheme: ATRISI_STORY_BRAND_THEME,
      paletteType: 'institutional_navy',
      useLogoReference: Boolean(kit.logoFileId),
      avoid:
        'any readable text, gibberish letters, misspelled words, fake logos, neon, purple glow, cluttered stickers, watermarks, CTAs, captions, signage',
    },
  });

  const newFileId = generated.files[0]?.fileId;
  if (!newFileId) {
    throw Object.assign(new Error('Creative AI returned no branded image'), { statusCode: 502 });
  }

  const beats = existing.beats.map((b) =>
    b.id === beatId
      ? {
          ...b,
          fileId: newFileId,
          vision: null,
          // Keep story copy — do not replace with AI-invented poster text
          title: b.title,
          caption: b.caption,
          notes: 'Branded with ATRISI Creative AI (copy stays in Story fields)',
        }
      : b,
  );

  const story = await updateStory(ownerUserId, storyId, { beats });
  return { story, provider: generated.provider, fileId: newFileId };
}

/**
 * Generate similar — style-reference variants.
 * Images stay text-light; titles/captions inherit from the source beat.
 */
export async function generateSimilarStoryBeats(
  ownerUserId: string,
  storyId: string,
  beatId: string,
  options?: { count?: number },
): Promise<{ story: StorySessionDto; provider: string; addedBeatIds: string[] }> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const beat = findBeatOrThrow(existing.beats, beatId);
  const kit = getStoryBrandKit(existing.metadata as Record<string, unknown>);
  const count = Math.min(Math.max(options?.count || 1, 1), 3);

  const promptParts = [
    'Create a similar institutional acquisition scene inspired by the reference.',
    'Same subject world and mood, fresh composition — not a duplicate.',
    'ATRISI Marketing look: teal + slate, premium, trustworthy, sparse layout.',
    'TEXT-FREE: absolutely no readable text, headlines, CTAs, logos-as-words, or gibberish letters. Clean visual only — Story editor owns typography.',
  ];
  if (beat.vision?.what) promptParts.push(`Reference scene: ${beat.vision.what}.`);
  if (beat.vision?.mood) promptParts.push(`Mood: ${beat.vision.mood}.`);

  const refs = brandReferenceIds(kit, beat.fileId!);
  // For similar, put beat first as primary style, then brand kit
  const similarRefs = [
    beat.fileId!,
    ...refs.filter((id) => id !== beat.fileId),
  ].slice(0, 4);

  const generated = await generateCreativeImages({
    ownerUserId,
    prompt: promptParts.join(' '),
    style: 'photo_realistic',
    quality: 'standard',
    aspectRatio: '16x9',
    titleHint: beat.title || 'Similar beat',
    referenceFileIds: similarRefs,
    referenceMode: 'style',
    analyzeReferences: true,
    variantCount: count,
    metadata: {
      source: 'story_generate_similar',
      storyId,
      beatId,
      referenceFileId: beat.fileId,
    },
    precision: {
      textFree: true,
      brandTheme: ATRISI_STORY_BRAND_THEME,
      paletteType: 'institutional_navy',
      useLogoReference: Boolean(kit.logoFileId),
      avoid:
        'any readable text, gibberish letters, fake logos, watermarks, neon, clutter, exact duplicate of reference',
    },
  });

  const newFileIds = generated.files.map((f) => f.fileId).filter(Boolean);
  if (newFileIds.length === 0) {
    throw Object.assign(new Error('Creative AI returned no similar images'), { statusCode: 502 });
  }

  const insertAt = existing.beats.findIndex((b) => b.id === beatId);
  const added: StoryBeat[] = newFileIds.map((fileId, index) => ({
    id: randomUUID(),
    fileId,
    // Inherit story copy from source — do not invent new poster text
    title: beat.title || `Similar ${index + 1}`,
    caption: beat.caption || '',
    notes: 'Similar visual · copy inherited from source beat',
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
    provider: generated.provider,
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
          arcRole: structure.roles[id] || beat.arcRole || 'other',
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
            title: spoken?.title || beat.title,
            caption: spoken?.caption || beat.vision?.claimHint || beat.caption,
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
      composePipeline: 'see_combine_speak',
      combineMethod: combined?.method || (structure ? 'structure' : 'heuristic'),
    },
  });

  return { story, source, visionCount: seen.visionCount, reordered, thesis: thesis || undefined };
}

function storySafeFilename(title: string, ext: string): string {
  const safeName = (title || 'story')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${safeName || 'atrisi-story'}.${ext}`;
}

async function loadBeatImageForExport(
  ownerUserId: string,
  fileId: string,
  options?: { allowWebp?: boolean },
): Promise<{ mime: string; base64: string } | null> {
  try {
    const [fileRow] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, ownerUserId)))
      .limit(1);
    if (!fileRow?.storageKey) return null;
    const mime = (fileRow.mimetype || '').toLowerCase();
    const isPng = mime.includes('png');
    const isJpeg = mime.includes('jpeg') || mime.includes('jpg');
    const isWebp = mime.includes('webp');
    if (!isPng && !isJpeg && !(options?.allowWebp && isWebp)) {
      return null;
    }
    const fileBuffer = await storageProvider.downloadFile(fileRow.storageKey);
    const normalized = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
    return { mime: normalized, base64: fileBuffer.toString('base64') };
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
  const beats = [...story.beats].sort((a, b) => a.order - b.order);

  if (beats.length === 0) {
    throw Object.assign(new Error('Story has no beats to export'), { statusCode: 400 });
  }

  const pptxMod = await import('pptxgenjs');
  // CJS/ESM interop across Node + bundlers
  const PptxCtor = (pptxMod as unknown as { default?: new () => any }).default
    || (pptxMod as unknown as new () => any);
  const pptx = new PptxCtor();
  pptx.author = 'ATRISI Marketing';
  pptx.title = story.title;
  pptx.subject = 'Story export — Studio creates. Products operate. Platform remembers.';

  // Title slide
  {
    const slide = pptx.addSlide();
    slide.background = { color: '0F172A' };
    slide.addText('ATRISI', {
      x: 0.5,
      y: 1.6,
      w: 9,
      h: 0.5,
      fontSize: 18,
      color: '2DD4BF',
      fontFace: 'Arial',
      bold: true,
    });
    slide.addText(story.title || 'Untitled story', {
      x: 0.5,
      y: 2.2,
      w: 9,
      h: 1,
      fontSize: 32,
      color: 'F8FAFC',
      fontFace: 'Arial',
      bold: true,
    });
    const thesis =
      typeof (story.metadata as Record<string, unknown>)?.lastThesis === 'string'
        ? String((story.metadata as Record<string, unknown>).lastThesis)
        : 'Story · Context → Proof → Ask';
    slide.addText(thesis, {
      x: 0.5,
      y: 3.4,
      w: 9,
      h: 0.8,
      fontSize: 14,
      color: '94A3B8',
      fontFace: 'Arial',
    });
  }

  for (const beat of beats) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };

    const role = ARC_LABELS[beat.arcRole || 'other'] || 'Beat';
    slide.addText(role.toUpperCase(), {
      x: 0.4,
      y: 0.25,
      w: 4,
      h: 0.3,
      fontSize: 11,
      color: '0D9488',
      fontFace: 'Arial',
      bold: true,
    });
    slide.addText(beat.title || 'Beat', {
      x: 0.4,
      y: 0.55,
      w: 9.2,
      h: 0.45,
      fontSize: 22,
      color: '0F172A',
      fontFace: 'Arial',
      bold: true,
    });

    if (beat.fileId) {
      const image = await loadBeatImageForExport(ownerUserId, beat.fileId);
      if (image) {
        try {
          slide.addImage({
            data: `data:${image.mime};base64,${image.base64}`,
            x: 0.4,
            y: 1.15,
            w: 9.2,
            h: 3.6,
            sizing: { type: 'contain', w: 9.2, h: 3.6 },
          });
        } catch (error) {
          logger.warn('Story PPTX addImage failed', {
            beatId: beat.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (beat.caption) {
      slide.addText(beat.caption, {
        x: 0.4,
        y: 4.9,
        w: 9.2,
        h: 0.45,
        fontSize: 13,
        color: '334155',
        fontFace: 'Arial',
      });
    }
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
    `> ATRISI Marketing · Story export`,
    thesis ? `> Thesis: ${thesis}` : '',
    '',
    '## Arc',
    '',
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === ''));

  for (const [index, beat] of beats.entries()) {
    const role = ARC_LABELS[beat.arcRole || 'other'] || 'Beat';
    lines.push(`### ${index + 1}. ${role} — ${beat.title || 'Untitled beat'}`);
    lines.push('');
    if (beat.caption) {
      lines.push(beat.caption);
      lines.push('');
    }
    lines.push(`- Arc role: ${role}`);
    if (beat.fileId) lines.push(`- Asset file: ${beat.fileId}`);
    lines.push('');
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
  const beats = [...story.beats].sort((a, b) => a.order - b.order);
  if (beats.length === 0) {
    throw Object.assign(new Error('Story has no beats to export'), { statusCode: 400 });
  }

  const thesis =
    typeof (story.metadata as Record<string, unknown>)?.lastThesis === 'string'
      ? String((story.metadata as Record<string, unknown>).lastThesis)
      : '';

  const cards: string[] = [];
  for (const [index, beat] of beats.entries()) {
    const role = ARC_LABELS[beat.arcRole || 'other'] || 'Beat';
    let img = '';
    if (beat.fileId) {
      const image = await loadBeatImageForExport(ownerUserId, beat.fileId, { allowWebp: true });
      if (image) {
        img = `<img src="data:${image.mime};base64,${image.base64}" alt="" />`;
      }
    }
    cards.push(`
<article class="beat">
  <p class="role">${escapeHtml(role)} · ${index + 1}/${beats.length}</p>
  <h2>${escapeHtml(beat.title || 'Beat')}</h2>
  ${img}
  <p class="caption">${escapeHtml(beat.caption || '')}</p>
</article>`);
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
  header { padding:2.5rem 1.5rem 1rem; max-width:720px; margin:0 auto; }
  header .brand { font-family: system-ui, sans-serif; letter-spacing:.18em; text-transform:uppercase; font-size:.7rem; color:var(--teal); font-weight:700; }
  header h1 { font-size:2rem; margin:.5rem 0; }
  header .thesis { color:var(--muted); line-height:1.5; }
  main { max-width:720px; margin:0 auto; padding:0 1.5rem 3rem; display:grid; gap:1.5rem; }
  .beat { background:#fff; padding:1.25rem; border-radius:4px; }
  .beat .role { font-family: system-ui, sans-serif; font-size:.7rem; letter-spacing:.14em; text-transform:uppercase; color:var(--teal); margin:0 0 .5rem; }
  .beat h2 { margin:0 0 1rem; font-size:1.35rem; }
  .beat img { width:100%; height:auto; display:block; margin:0 0 1rem; background:#e2e8f0; }
  .beat .caption { margin:0; color:#334155; line-height:1.55; font-size:1rem; }
  footer { text-align:center; padding:2rem; color:var(--muted); font-size:.8rem; font-family:system-ui,sans-serif; }
</style>
</head>
<body>
<header>
  <p class="brand">ATRISI · Story</p>
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
