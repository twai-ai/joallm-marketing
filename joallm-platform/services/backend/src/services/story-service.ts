/**
 * Story — Studio create workspace for multi-medium narrative compose.
 * Constitution: Studio creates. Products operate. Platform remembers.
 * Free-floating until attach; not a new aggregate root (Institution · Program · Person).
 */

import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { config } from '../config/config.js';
import { db } from '../database/connection.js';
import { files, storySessions, type StoryBeat } from '../database/schema.js';
import { storageProvider } from './file-storage.js';
import {
  buildOrgDualReadScope,
  resolveOrganizationIdForUser,
} from './organization-ownership.js';
import { logger } from '../utils/logger.js';

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

function isUsableKey(value?: string | null): value is string {
  return Boolean(value && value.trim().length > 0 && !value.includes('PLACEHOLDER'));
}

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

function heuristicPropose(beats: StoryBeat[], title: string): {
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

    const roleLabel = ARC_LABELS[arcRole || 'other'];
    return {
      ...beat,
      order: index,
      arcRole,
      title: beat.title?.trim() || `${roleLabel} ${index + 1}`,
      caption:
        beat.caption?.trim() ||
        (arcRole === 'context'
          ? 'Set the scene for the audience.'
          : arcRole === 'proof'
            ? 'Show evidence that builds trust.'
            : arcRole === 'ask'
              ? 'Close with a clear next step.'
              : 'Advance the narrative.'),
    };
  });

  return {
    title: title?.trim() && title !== 'Untitled story' ? title : 'ATRISI story',
    arc: 'context_proof_ask',
    tone: 'atrisi_institutional',
    beats: proposed,
  };
}

async function llmProposeStoryline(
  title: string,
  beats: StoryBeat[],
): Promise<{ title: string; arc: string; tone: string; beats: StoryBeat[] } | null> {
  const beatSummaries = beats.map((b, i) => ({
    index: i,
    id: b.id,
    currentTitle: b.title,
    hasImage: Boolean(b.fileId),
  }));

  const system = `You are ATRISI Marketing Story composer.
Constitution: Studio creates. Products operate. Platform remembers.
Propose a coherent multi-medium narrative (Context → Proof → Ask) for institutional acquisition marketing.
Return ONLY valid JSON:
{
  "title": "short story title",
  "arc": "context_proof_ask",
  "tone": "atrisi_institutional",
  "beats": [
    { "id": "beat-id", "title": "...", "caption": "...", "notes": "...", "arcRole": "context|proof|ask|other" }
  ]
}
Keep titles short. Captions one sentence. Preserve every beat id. Do not invent beat ids.`;

  const user = JSON.stringify({ currentTitle: title, beats: beatSummaries });

  try {
    let content = '';
    if (isUsableKey(config.groqApiKey)) {
      const client = new Groq({ apiKey: config.groqApiKey });
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      });
      content = response.choices[0]?.message?.content || '';
    } else if (isUsableKey(config.openaiApiKey)) {
      const client = new OpenAI({ apiKey: config.openaiApiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      });
      content = response.choices[0]?.message?.content || '';
    } else {
      return null;
    }

    const parsed = JSON.parse(content) as {
      title?: string;
      arc?: string;
      tone?: string;
      beats?: Array<{
        id: string;
        title?: string;
        caption?: string;
        notes?: string;
        arcRole?: StoryBeat['arcRole'];
      }>;
    };

    const byId = new Map((parsed.beats || []).map((b) => [b.id, b]));
    const nextBeats = beats.map((beat, index) => {
      const suggestion = byId.get(beat.id);
      return {
        ...beat,
        order: index,
        title: suggestion?.title?.trim() || beat.title,
        caption: suggestion?.caption?.trim() || beat.caption,
        notes: suggestion?.notes?.trim() || beat.notes,
        arcRole: suggestion?.arcRole || beat.arcRole || 'other',
      };
    });

    return {
      title: parsed.title?.trim() || title,
      arc: parsed.arc || 'context_proof_ask',
      tone: parsed.tone || 'atrisi_institutional',
      beats: nextBeats,
    };
  } catch (error) {
    logger.warn('Story LLM propose failed; using heuristic', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function proposeStoryline(
  ownerUserId: string,
  storyId: string,
): Promise<{ story: StorySessionDto; source: 'llm' | 'heuristic' }> {
  const existing = await getOwnedStory(ownerUserId, storyId);
  if (!existing.beats.length) {
    throw Object.assign(new Error('Add assets before proposing a storyline'), {
      statusCode: 400,
    });
  }

  const llm = await llmProposeStoryline(existing.title, existing.beats);
  const proposal = llm || heuristicPropose(existing.beats, existing.title);
  const story = await updateStory(ownerUserId, storyId, {
    title: proposal.title,
    arc: proposal.arc,
    tone: proposal.tone,
    beats: proposal.beats,
    status: 'ready',
    metadata: {
      lastProposeSource: llm ? 'llm' : 'heuristic',
      lastProposedAt: new Date().toISOString(),
    },
  });

  return { story, source: llm ? 'llm' : 'heuristic' };
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
