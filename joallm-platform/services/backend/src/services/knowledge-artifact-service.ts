/**
 * KnowledgeArtifact service — Phase B Interpretation → Timeline bridge.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../database/connection.js';
import {
  acquisitionPersons,
  files,
  knowledgeArtifacts,
  mediaInsights,
} from '../database/schema.js';
import { logger } from '../utils/logger.js';

export type KnowledgeArtifactRow = typeof knowledgeArtifacts.$inferSelect;

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapKnowledgeArtifact(row: KnowledgeArtifactRow) {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId ?? null,
    personId: row.personId ?? null,
    initiativeId: row.initiativeId ?? null,
    acquisitionEventId: row.acquisitionEventId ?? null,
    interactionId: row.interactionId ?? null,
    artifactType: row.artifactType,
    title: row.title ?? null,
    interpretation: (row.interpretation as Record<string, unknown>) || {},
    signals: (row.signals as Record<string, unknown>) || {},
    sourceFileId: row.sourceFileId ?? null,
    knowledgeDocumentId: row.knowledgeDocumentId ?? null,
    mediaAssetId: row.mediaAssetId ?? null,
    occurredAt: toIso(row.occurredAt),
    createdAt: toIso(row.createdAt) || new Date(0).toISOString(),
  };
}

export async function listPersonArtifacts(
  ownerUserId: string,
  personId: string,
  limit = 100,
): Promise<ReturnType<typeof mapKnowledgeArtifact>[]> {
  const rows = await db
    .select()
    .from(knowledgeArtifacts)
    .where(
      and(
        eq(knowledgeArtifacts.ownerUserId, ownerUserId),
        eq(knowledgeArtifacts.personId, personId),
      ),
    )
    .orderBy(desc(knowledgeArtifacts.occurredAt), desc(knowledgeArtifacts.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));

  return rows.map(mapKnowledgeArtifact);
}

function resolveArtifactType(mediaType?: string | null): 'audio' | 'video' | 'transcript' {
  if (mediaType === 'audio') return 'audio';
  if (mediaType === 'video') return 'video';
  return 'transcript';
}

/**
 * Upsert a KnowledgeArtifact from Media AI insights onto a Person Timeline.
 */
export async function upsertMediaKnowledgeArtifact(options: {
  ownerUserId: string;
  personId: string;
  fileId: string;
}): Promise<KnowledgeArtifactRow | null> {
  const { ownerUserId, personId, fileId } = options;

  const [person] = await db
    .select({ id: acquisitionPersons.id })
    .from(acquisitionPersons)
    .where(
      and(
        eq(acquisitionPersons.id, personId),
        eq(acquisitionPersons.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  if (!person) {
    logger.warn('upsertMediaKnowledgeArtifact: person not found', { personId, ownerUserId });
    return null;
  }

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, ownerUserId)))
    .limit(1);
  if (!file) {
    logger.warn('upsertMediaKnowledgeArtifact: file not found', { fileId, ownerUserId });
    return null;
  }

  const insights = await db
    .select()
    .from(mediaInsights)
    .where(eq(mediaInsights.fileId, fileId));

  const summary = insights.find((row) => row.insightType === 'summary');
  const highlights = insights.filter((row) => row.insightType === 'highlight');
  const topics = insights.filter((row) => row.insightType === 'topic');
  const actionItems = insights.filter((row) => row.insightType === 'action_item');
  const keyMoments = insights.filter((row) => row.insightType === 'key_moment');

  const mediaType = (file.metadata as { mediaType?: string } | null)?.mediaType;
  const artifactType = resolveArtifactType(mediaType);
  const title =
    summary?.title ||
    file.originalName ||
    'Media interpretation';

  const interpretation = {
    source: 'media_ai',
    summary: summary
      ? { title: summary.title, description: summary.description, tags: summary.tags }
      : null,
    highlights: highlights.map((row) => ({
      title: row.title,
      description: row.description,
      startTime: row.startTime,
      endTime: row.endTime,
      score: row.score,
      tags: row.tags,
    })),
    keyMoments: keyMoments.map((row) => ({
      title: row.title,
      description: row.description,
      startTime: row.startTime,
      endTime: row.endTime,
      tags: row.tags,
    })),
    topics: topics.map((row) => ({ title: row.title, description: row.description, tags: row.tags })),
    actionItems: actionItems.map((row) => ({
      title: row.title,
      description: row.description,
      tags: row.tags,
    })),
    insightCount: insights.length,
  };

  const signals = {
    topicCount: topics.length,
    actionItemCount: actionItems.length,
    highlightCount: highlights.length,
  };

  const occurredAt = file.createdAt || new Date();

  const [existing] = await db
    .select()
    .from(knowledgeArtifacts)
    .where(
      and(
        eq(knowledgeArtifacts.ownerUserId, ownerUserId),
        eq(knowledgeArtifacts.sourceFileId, fileId),
        eq(knowledgeArtifacts.artifactType, artifactType),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(knowledgeArtifacts)
      .set({
        personId,
        title,
        interpretation,
        signals,
        mediaAssetId: fileId,
        occurredAt,
      })
      .where(eq(knowledgeArtifacts.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(knowledgeArtifacts)
    .values({
      ownerUserId,
      personId,
      artifactType,
      title,
      interpretation,
      signals,
      sourceFileId: fileId,
      mediaAssetId: fileId,
      occurredAt,
    })
    .returning();

  return created;
}

/**
 * Link a processed media file to a Person: stamp metadata + upsert KnowledgeArtifact.
 */
export async function linkMediaFileToPerson(options: {
  ownerUserId: string;
  personId: string;
  fileId: string;
}): Promise<{ artifact: ReturnType<typeof mapKnowledgeArtifact> | null; fileId: string }> {
  const { ownerUserId, personId, fileId } = options;

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.userId, ownerUserId)))
    .limit(1);
  if (!file) {
    throw new Error('Media file not found');
  }

  const [person] = await db
    .select({ id: acquisitionPersons.id })
    .from(acquisitionPersons)
    .where(
      and(
        eq(acquisitionPersons.id, personId),
        eq(acquisitionPersons.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  if (!person) {
    throw new Error('Person not found');
  }

  const currentMeta = (file.metadata || {}) as Record<string, unknown>;
  await db
    .update(files)
    .set({
      metadata: {
        ...currentMeta,
        acquisitionPersonId: personId,
      } as typeof file.metadata,
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));

  const artifact = await upsertMediaKnowledgeArtifact({ ownerUserId, personId, fileId });
  return {
    artifact: artifact ? mapKnowledgeArtifact(artifact) : null,
    fileId,
  };
}

/**
 * Called from media insight worker when file.metadata.acquisitionPersonId is set.
 */
export async function bridgeMediaInsightsToAcquisitionTimeline(options: {
  ownerUserId: string;
  fileId: string;
  acquisitionPersonId?: string | null;
}): Promise<void> {
  const personId = options.acquisitionPersonId;
  if (!personId) return;

  try {
    await upsertMediaKnowledgeArtifact({
      ownerUserId: options.ownerUserId,
      personId,
      fileId: options.fileId,
    });
    logger.info('Bridged Media AI insights onto Person Timeline', {
      fileId: options.fileId,
      personId,
    });
  } catch (error) {
    logger.error('Failed to bridge Media AI → Acquisition Timeline', {
      error: error instanceof Error ? error.message : String(error),
      fileId: options.fileId,
      personId,
    });
  }
}

/** Ensure knowledge_artifacts table exists (bootstrap environments). */
export async function ensureKnowledgeArtifactsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "knowledge_artifacts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
      "person_id" uuid REFERENCES "acquisition_persons"("id") ON DELETE SET NULL,
      "initiative_id" uuid,
      "acquisition_event_id" uuid,
      "interaction_id" uuid,
      "artifact_type" text NOT NULL,
      "title" text,
      "interpretation" jsonb DEFAULT '{}'::jsonb,
      "signals" jsonb DEFAULT '{}'::jsonb,
      "source_file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL,
      "knowledge_document_id" uuid,
      "media_asset_id" uuid,
      "occurred_at" timestamp,
      "created_at" timestamp DEFAULT NOW() NOT NULL
    )
  `);
}
