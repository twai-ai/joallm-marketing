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
    typography: 'bold clean sans-serif headlines, restrained supporting text',
    layout: 'minimal, generous whitespace, clear hierarchy, logo-safe margins',
    imagery: 'real institutional life — campus, learners, mentors; not stock-ad clichés',
    density: 'sparse',
    notes:
      'ATRISI Marketing brand for Institution Acquisition. Teal + slate. No neon, no purple glow, no cluttered badge stacks.',
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

/**
 * Brand this beat — Creative AI remix with ATRISI brand theme (edit mode).
 * Replaces the beat image; clears vision cache so Propose re-reads it.
 */
export async function brandStoryBeat(
  ownerUserId: string,
  storyId: string,
  beatId: string,
): Promise<{ story: StorySessionDto; provider: string; fileId: string }> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const beat = findBeatOrThrow(existing.beats, beatId);

  const promptParts = [
    'Restyle this reference creative into an ATRISI Marketing institutional acquisition visual.',
    'Keep the core subject and composition recognizable.',
    'Apply ATRISI teal and slate brand, premium institutional look, clean hierarchy.',
    'Do not invent program names, prices, or stats that are not in the reference.',
  ];
  if (beat.title) promptParts.push(`Beat title context: ${beat.title}.`);
  if (beat.caption) promptParts.push(`Caption context: ${beat.caption}.`);
  if (beat.vision?.onImageText) promptParts.push(`Preserve readable text where possible: ${beat.vision.onImageText}.`);

  const generated = await generateCreativeImages({
    ownerUserId,
    prompt: promptParts.join(' '),
    style: 'marketing_poster',
    quality: 'standard',
    aspectRatio: '16x9',
    titleHint: beat.title || 'ATRISI branded beat',
    referenceFileIds: [beat.fileId!],
    referenceMode: 'edit',
    analyzeReferences: true,
    variantCount: 1,
    metadata: {
      source: 'story_brand_beat',
      storyId,
      beatId,
      originalFileId: beat.fileId,
    },
    precision: {
      institutionName: 'ATRISI',
      brandTheme: ATRISI_STORY_BRAND_THEME,
      paletteType: 'institutional_navy',
      avoid: 'neon colors, purple glow, cluttered stickers, fake logos, watermarks',
      mustIncludeText: beat.vision?.onImageText || undefined,
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
          notes: b.notes || 'Branded with ATRISI Creative AI',
        }
      : b,
  );

  const story = await updateStory(ownerUserId, storyId, { beats });
  return { story, provider: generated.provider, fileId: newFileId };
}

/**
 * Generate similar — Creative AI style-reference variants appended after the beat.
 */
export async function generateSimilarStoryBeats(
  ownerUserId: string,
  storyId: string,
  beatId: string,
  options?: { count?: number },
): Promise<{ story: StorySessionDto; provider: string; addedBeatIds: string[] }> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  const beat = findBeatOrThrow(existing.beats, beatId);
  const count = Math.min(Math.max(options?.count || 1, 1), 3);

  const promptParts = [
    'Create a similar institutional acquisition creative inspired by the reference.',
    'Same subject world and mood, fresh composition — not a duplicate.',
    'ATRISI Marketing look: teal + slate, premium, trustworthy, sparse layout.',
    'Suitable as a Story beat for Context / Proof / Ask narratives.',
  ];
  if (beat.vision?.what) promptParts.push(`Reference scene: ${beat.vision.what}.`);
  if (beat.vision?.claimHint) promptParts.push(`Claim direction: ${beat.vision.claimHint}.`);
  if (beat.title) promptParts.push(`Related to: ${beat.title}.`);

  const generated = await generateCreativeImages({
    ownerUserId,
    prompt: promptParts.join(' '),
    style: 'social_media',
    quality: 'standard',
    aspectRatio: '16x9',
    titleHint: beat.title ? `Similar · ${beat.title}` : 'Similar beat',
    referenceFileIds: [beat.fileId!],
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
      institutionName: 'ATRISI',
      brandTheme: ATRISI_STORY_BRAND_THEME,
      paletteType: 'institutional_navy',
      avoid: 'exact copy of reference, neon, clutter, wrong logos',
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
    title: beat.title ? `${beat.title} · similar` : `Similar ${index + 1}`,
    caption: beat.caption || '',
    notes: 'Generated similar via Creative AI',
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
}> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  if (!existing.beats.length) {
    throw Object.assign(new Error('Add assets before proposing a storyline'), {
      statusCode: 400,
    });
  }

  const refreshVision = Boolean(options?.refreshVision);
  const keepOrder = Boolean(options?.keepOrder);

  // 1) See — Groq vision cards (cached on beats)
  const seen = await seeBeatVisionCards(ownerUserId, existing.beats, refreshVision);

  // 2) Structure — order + roles from cards
  const structure = await structureStoryline(existing.title, seen.beats, keepOrder);

  let proposal: { title: string; arc: string; tone: string; beats: StoryBeat[] };
  let source: 'vision-compose' | 'vision-heuristic' | 'heuristic' = 'heuristic';

  if (structure) {
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

    // 3) Speak — titles/captions grounded in vision + roles
    const copy = await speakStoryline(structure.title, structuredBeats);
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
            caption: spoken?.caption || beat.vision?.what || beat.caption,
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
      composePipeline: 'see_structure_speak',
    },
  });

  return { story, source, visionCount: seen.visionCount };
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

  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
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
    slide.addText('Story · Studio create workspace', {
      x: 0.5,
      y: 3.4,
      w: 9,
      h: 0.4,
      fontSize: 14,
      color: '94A3B8',
      fontFace: 'Arial',
    });
  }

  for (const beat of beats) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };

    const role = ARC_LABELS[beat.arcRole || 'other'];
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
      try {
        const [fileRow] = await db
          .select()
          .from(files)
          .where(and(eq(files.id, beat.fileId), eq(files.userId, ownerUserId)))
          .limit(1);
        const storageKey = fileRow?.storageKey;
        if (storageKey) {
          const fileBuffer = await storageProvider.downloadFile(storageKey);
          const mime = fileRow.mimetype || 'image/png';
          const ext = mime.includes('jpeg') || mime.includes('jpg')
            ? 'jpg'
            : mime.includes('webp')
              ? 'webp'
              : 'png';
          slide.addImage({
            data: `data:${mime};base64,${fileBuffer.toString('base64')}`,
            x: 0.4,
            y: 1.15,
            w: 9.2,
            h: 3.6,
            sizing: { type: 'contain', w: 9.2, h: 3.6 },
          });
          void ext;
        }
      } catch (error) {
        logger.warn('Story PPTX image skip', {
          beatId: beat.id,
          error: error instanceof Error ? error.message : String(error),
        });
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

  const output = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  const safeName = (story.title || 'story')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return {
    buffer: Buffer.from(output),
    filename: `${safeName || 'atrisi-story'}.pptx`,
  };
}
