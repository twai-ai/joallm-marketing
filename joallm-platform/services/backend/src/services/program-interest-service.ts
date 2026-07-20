/**
 * Program Interest — Education pull contract (Sprint 6–7).
 * Attribution from publishing jobs + inbound WhatsApp engagement.
 */

import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../database/connection.js';
import {
  acquisitionPersons,
  programInterests,
  publishingJobs,
  studioChannels,
} from '../database/schema.js';

export type ProgramInterestEvidence = {
  kind: string;
  summary?: string;
  occurredAt?: string;
  channel?: string;
  refId?: string;
  attributes?: Record<string, unknown>;
};

export type ProgramInterestDto = {
  id: string;
  personId: string;
  programId: string;
  programName?: string;
  confidence: number;
  source: string;
  campaignId?: string;
  campaignName?: string;
  intent?: string;
  evidence: ProgramInterestEvidence[];
  occurredAt: string;
  updatedAt: string;
  publishingJobId?: string;
  acquisitionEventId?: string;
};

function mapInterest(row: typeof programInterests.$inferSelect): ProgramInterestDto {
  return {
    id: row.id,
    personId: row.personId,
    programId: row.programId,
    programName: row.programName || undefined,
    confidence: Number(row.confidence),
    source: row.source,
    campaignId: row.campaignId || undefined,
    campaignName: row.campaignName || undefined,
    intent: row.intent || undefined,
    evidence: (Array.isArray(row.evidence) ? row.evidence : []) as ProgramInterestEvidence[],
    occurredAt: row.occurredAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishingJobId: row.publishingJobId || undefined,
    acquisitionEventId: row.acquisitionEventId || undefined,
  };
}

export async function listProgramInterests(options: {
  ownerUserId: string;
  programId?: string;
  since?: Date;
  limit?: number;
}): Promise<ProgramInterestDto[]> {
  const limit = Math.min(options.limit || 100, 500);
  const conditions = [eq(programInterests.ownerUserId, options.ownerUserId)];
  if (options.programId) {
    conditions.push(eq(programInterests.programId, options.programId));
  }
  if (options.since) {
    conditions.push(gte(programInterests.occurredAt, options.since));
  }

  const rows = await db
    .select()
    .from(programInterests)
    .where(and(...conditions))
    .orderBy(desc(programInterests.occurredAt))
    .limit(limit);

  return rows.map(mapInterest);
}

export async function createProgramInterest(options: {
  ownerUserId: string;
  personId: string;
  programId: string;
  programName?: string;
  confidence?: number;
  source: string;
  campaignId?: string;
  campaignName?: string;
  intent?: string;
  evidence?: ProgramInterestEvidence[];
  publishingJobId?: string;
  acquisitionEventId?: string;
  occurredAt?: Date;
}): Promise<ProgramInterestDto> {
  const [row] = await db
    .insert(programInterests)
    .values({
      ownerUserId: options.ownerUserId,
      personId: options.personId,
      programId: options.programId,
      programName: options.programName || null,
      confidence: options.confidence ?? 0.5,
      source: options.source,
      campaignId: options.campaignId || null,
      campaignName: options.campaignName || null,
      intent: options.intent || null,
      evidence: options.evidence || [],
      publishingJobId: options.publishingJobId || null,
      acquisitionEventId: options.acquisitionEventId || null,
      occurredAt: options.occurredAt || new Date(),
    })
    .returning();

  return mapInterest(row);
}

/** Education pull shape */
export function toPullItem(interest: ProgramInterestDto) {
  return {
    id: interest.id,
    personId: interest.personId,
    programId: interest.programId,
    programName: interest.programName,
    confidence: interest.confidence,
    source: interest.source,
    campaignId: interest.campaignId,
    campaignName: interest.campaignName,
    intent: interest.intent,
    evidence: interest.evidence,
    occurredAt: interest.occurredAt,
  };
}

/**
 * After a publishing job is published: record interest for the recipient person
 * (WhatsApp `to`) or a program-scoped market person for simulated channels.
 */
export async function recordInterestFromPublishedJob(options: {
  ownerUserId: string;
  jobId: string;
  personId?: string;
}): Promise<ProgramInterestDto | null> {
  const [job] = await db
    .select()
    .from(publishingJobs)
    .where(
      and(
        eq(publishingJobs.id, options.jobId),
        eq(publishingJobs.ownerUserId, options.ownerUserId),
      ),
    )
    .limit(1);

  if (!job || job.status !== 'published') return null;

  const payload = (job.payload || {}) as Record<string, unknown>;
  const programId =
    typeof payload.programId === 'string' ? payload.programId : null;
  if (!programId) return null;

  let personId = options.personId;
  if (!personId) {
    const to =
      typeof payload.to === 'string'
        ? payload.to
        : typeof payload.recipientPhone === 'string'
          ? payload.recipientPhone
          : null;
    if (to) {
      const phone = to.replace(/\D/g, '');
      const [byPhone] = await db
        .select()
        .from(acquisitionPersons)
        .where(
          and(
            eq(acquisitionPersons.ownerUserId, options.ownerUserId),
            eq(acquisitionPersons.primaryPhone, phone),
          ),
        )
        .limit(1);
      if (byPhone) {
        personId = byPhone.id;
      } else {
        const [created] = await db
          .insert(acquisitionPersons)
          .values({
            ownerUserId: options.ownerUserId,
            displayName: `WhatsApp ${phone}`,
            primaryPhone: phone,
            status: 'identified',
            relationshipMaturity: 'observed',
          })
          .returning();
        personId = created.id;
      }
    } else {
      const marketKey = `market:${programId}`;
      const existing = await db
        .select()
        .from(acquisitionPersons)
        .where(eq(acquisitionPersons.ownerUserId, options.ownerUserId))
        .limit(50);
      const market = existing.find(
        (p) => (p.metadata as Record<string, unknown>)?.marketKey === marketKey,
      );
      if (market) {
        personId = market.id;
      } else {
        const [created] = await db
          .insert(acquisitionPersons)
          .values({
            ownerUserId: options.ownerUserId,
            displayName: `${programId} · Market`,
            status: 'anonymous',
            relationshipMaturity: 'observed',
            metadata: { marketKey },
          })
          .returning();
        personId = created.id;
      }
    }
  }

  const [channel] = await db
    .select()
    .from(studioChannels)
    .where(eq(studioChannels.id, job.channelId))
    .limit(1);

  return createProgramInterest({
    ownerUserId: options.ownerUserId,
    personId,
    programId,
    programName: typeof payload.programName === 'string' ? payload.programName : undefined,
    confidence: payload.to || payload.recipientPhone ? 0.55 : 0.35,
    source: channel?.kind || 'publish',
    campaignId: job.campaignId || undefined,
    campaignName: typeof payload.campaignName === 'string' ? payload.campaignName : undefined,
    intent: typeof payload.intentId === 'string' ? payload.intentId : undefined,
    publishingJobId: job.id,
    evidence: [
      {
        kind: 'other',
        summary: `Creative published to ${channel?.name || channel?.kind || 'channel'}`,
        channel: channel?.kind,
        refId: job.externalPostId || job.id,
        occurredAt: job.publishedAt?.toISOString() || new Date().toISOString(),
        attributes: {
          assetTitle: payload.assetTitle,
          mode: payload.executeMode,
        },
      },
    ],
    occurredAt: job.publishedAt || new Date(),
  });
}

/**
 * Inbound WhatsApp → attribute to most recent published program campaign (dogfood).
 */
export async function attributeInboundWhatsAppInterest(options: {
  ownerUserId: string;
  personId: string;
  eventId: string;
  textBody?: string;
  occurredAt?: Date;
}): Promise<ProgramInterestDto | null> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentJobs = await db
    .select({
      job: publishingJobs,
      channel: studioChannels,
    })
    .from(publishingJobs)
    .leftJoin(studioChannels, eq(publishingJobs.channelId, studioChannels.id))
    .where(
      and(
        eq(publishingJobs.ownerUserId, options.ownerUserId),
        eq(publishingJobs.status, 'published'),
        gte(publishingJobs.publishedAt, since),
      ),
    )
    .orderBy(desc(publishingJobs.publishedAt))
    .limit(20);

  const match =
    recentJobs.find((r) => r.channel?.kind === 'whatsapp') || recentJobs[0];
  if (!match) return null;

  const payload = (match.job.payload || {}) as Record<string, unknown>;
  const programId =
    typeof payload.programId === 'string' ? payload.programId : null;
  if (!programId) return null;

  return createProgramInterest({
    ownerUserId: options.ownerUserId,
    personId: options.personId,
    programId,
    confidence: 0.75,
    source: 'whatsapp',
    campaignId: match.job.campaignId || undefined,
    campaignName: typeof payload.campaignName === 'string' ? payload.campaignName : undefined,
    intent: typeof payload.intentId === 'string' ? payload.intentId : undefined,
    publishingJobId: match.job.id,
    acquisitionEventId: options.eventId,
    evidence: [
      {
        kind: 'message_inbound',
        summary: options.textBody
          ? `WhatsApp: ${options.textBody.slice(0, 180)}`
          : 'WhatsApp inbound after campaign publish',
        channel: 'whatsapp',
        refId: options.eventId,
        occurredAt: (options.occurredAt || new Date()).toISOString(),
      },
    ],
    occurredAt: options.occurredAt || new Date(),
  });
}
