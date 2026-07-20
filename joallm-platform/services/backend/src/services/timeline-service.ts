/**
 * Timeline Service — Phase A (+ Phase B artifacts)
 *
 * Assembles a Person-centric Timeline from acquisition events, interactions,
 * and KnowledgeArtifacts (Media AI / Interpretation).
 */

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../database/connection.js';
import {
  acquisitionEvents,
  acquisitionInteractions,
  acquisitionPersons,
  knowledgeArtifacts,
} from '../database/schema.js';
import { listPersonArtifacts, mapKnowledgeArtifact } from './knowledge-artifact-service.js';
import {
  isRelationshipMaturity,
  type RelationshipMaturity,
} from './relationship-maturity.js';

/** Local mirrors of shared Timeline contracts (backend has no @joallm/shared package). */
type Person = {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  displayName?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  status: string;
  relationshipMaturity?: string | null;
  createdAt: string;
  updatedAt: string;
};

type AcquisitionEvent = {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  sourceConnectionId: string;
  rawRecordId: string;
  source: string;
  externalEventId?: string | null;
  eventType: string;
  occurredAt: string;
  receivedAt: string;
  personId?: string | null;
  initiativeId?: string | null;
  campaignId?: string | null;
  channel?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  attributes: Record<string, unknown>;
  schemaVersion: number;
  createdAt?: string;
};

type Interaction = {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  personId: string;
  initiativeId?: string | null;
  campaignId?: string | null;
  sourceEventId: string;
  kind: string;
  direction?: string | null;
  summary?: string | null;
  occurredAt: string;
  createdAt: string;
};

type KnowledgeArtifact = ReturnType<typeof mapKnowledgeArtifact>;

type TimelineEntryKind =
  | 'event'
  | 'interaction'
  | 'artifact'
  | 'decision'
  | 'learning'
  | 'communication'
  | 'evidence'
  | 'outcome';

type TimelineEntry = {
  id: string;
  kind: TimelineEntryKind;
  occurredAt: string;
  summary?: string | null;
  refId: string;
  initiativeId?: string | null;
  attributes?: Record<string, unknown>;
};

type Timeline = {
  subjectType: 'person' | 'initiative' | 'campaign' | 'organization' | 'institution' | 'program';
  subjectId: string;
  ownerUserId: string;
  organizationId?: string | null;
  maturity?: string | null;
  events?: AcquisitionEvent[];
  interactions?: Interaction[];
  artifacts?: KnowledgeArtifact[];
  evidence?: unknown[];
  entries: TimelineEntry[];
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapPerson(row: typeof acquisitionPersons.$inferSelect): Person {
  const maturity = isRelationshipMaturity(row.relationshipMaturity)
    ? row.relationshipMaturity
    : 'unknown';
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId ?? null,
    displayName: row.displayName ?? null,
    primaryEmail: row.primaryEmail ?? null,
    primaryPhone: row.primaryPhone ?? null,
    status: (row.status as Person['status']) || 'identified',
    relationshipMaturity: maturity,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapEvent(row: typeof acquisitionEvents.$inferSelect): AcquisitionEvent {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId ?? null,
    sourceConnectionId: row.sourceConnectionId,
    rawRecordId: row.rawRecordId,
    source: row.source,
    externalEventId: row.externalEventId ?? null,
    eventType: row.eventType,
    occurredAt: toIso(row.occurredAt),
    receivedAt: toIso(row.receivedAt),
    personId: row.personId ?? null,
    initiativeId: row.initiativeId ?? null,
    campaignId: row.campaignId ?? null,
    channel: row.channel ?? null,
    objectType: row.objectType ?? null,
    objectId: row.objectId ?? null,
    attributes: (row.attributes as Record<string, unknown>) || {},
    schemaVersion: row.schemaVersion ?? 1,
    createdAt: toIso(row.createdAt),
  };
}

function mapInteraction(row: typeof acquisitionInteractions.$inferSelect): Interaction {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId ?? null,
    personId: row.personId,
    initiativeId: row.initiativeId ?? null,
    campaignId: row.campaignId ?? null,
    sourceEventId: row.sourceEventId,
    kind: row.kind as Interaction['kind'],
    direction: (row.direction as Interaction['direction']) ?? null,
    summary: row.summary ?? null,
    occurredAt: toIso(row.occurredAt),
    createdAt: toIso(row.createdAt),
  };
}

function classifyEventKind(eventType: string): TimelineEntryKind {
  if (
    eventType.startsWith('message.') &&
    eventType !== 'message.received' &&
    eventType !== 'message.sent'
  ) {
    return 'communication';
  }
  if (eventType.includes('decision')) return 'decision';
  return 'event';
}

function classifyInteractionKind(kind: string): TimelineEntryKind {
  if (kind === 'decision') return 'decision';
  if (kind === 'learning_activity') return 'learning';
  if (kind === 'message' || kind === 'call' || kind === 'meeting') return 'communication';
  return 'interaction';
}

function summarizeEvent(event: AcquisitionEvent): string {
  const status = event.attributes?.status;
  if (typeof status === 'string' && event.eventType.startsWith('message.')) {
    return `WhatsApp message ${status}`;
  }
  return event.eventType;
}

function buildEntries(
  events: AcquisitionEvent[],
  interactions: Interaction[],
  artifacts: KnowledgeArtifact[] = [],
): TimelineEntry[] {
  const interactionEventIds = new Set(
    interactions.map((item) => item.sourceEventId).filter(Boolean),
  );

  const interactionEntries: TimelineEntry[] = interactions.map((item) => ({
    id: `interaction:${item.id}`,
    kind: classifyInteractionKind(item.kind),
    occurredAt: item.occurredAt,
    summary: item.summary || `${item.kind}${item.direction ? ` · ${item.direction}` : ''}`,
    refId: item.id,
    initiativeId: item.initiativeId ?? null,
    attributes: {
      kind: item.kind,
      direction: item.direction,
      sourceEventId: item.sourceEventId,
      entrySource: 'interaction',
    },
  }));

  const eventEntries: TimelineEntry[] = events
    .filter((event) => !interactionEventIds.has(event.id))
    .map((event) => ({
      id: `event:${event.id}`,
      kind: classifyEventKind(event.eventType),
      occurredAt: event.occurredAt,
      summary: summarizeEvent(event),
      refId: event.id,
      initiativeId: event.initiativeId ?? null,
      attributes: {
        source: event.source,
        channel: event.channel,
        eventType: event.eventType,
        entrySource: 'event',
        ...event.attributes,
      },
    }));

  const artifactEntries: TimelineEntry[] = artifacts.map((artifact) => ({
    id: `artifact:${artifact.id}`,
    kind: 'artifact',
    occurredAt: artifact.occurredAt || artifact.createdAt,
    summary: artifact.title || `${artifact.artifactType} interpretation`,
    refId: artifact.id,
    initiativeId: artifact.initiativeId ?? null,
    attributes: {
      artifactType: artifact.artifactType,
      sourceFileId: artifact.sourceFileId,
      mediaAssetId: artifact.mediaAssetId,
      entrySource: 'artifact',
      signals: artifact.signals,
    },
  }));

  return [...interactionEntries, ...eventEntries, ...artifactEntries].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

export type PersonTimelineResult = {
  person: Person;
  timeline: Timeline;
  /** @deprecated Phase-1 shape — prefer timeline.interactions */
  interactions: Interaction[];
};

/**
 * Person Timeline (Phase A primary subject + Phase B artifacts).
 */
export async function getPersonTimeline(
  ownerUserId: string,
  personId: string,
  limit = 100,
): Promise<PersonTimelineResult | null> {
  const [personRow] = await db
    .select()
    .from(acquisitionPersons)
    .where(
      and(
        eq(acquisitionPersons.id, personId),
        eq(acquisitionPersons.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);

  if (!personRow) return null;

  const capped = Math.min(Math.max(limit, 1), 500);

  const [interactionRows, eventRows, artifacts] = await Promise.all([
    db
      .select()
      .from(acquisitionInteractions)
      .where(
        and(
          eq(acquisitionInteractions.personId, personId),
          eq(acquisitionInteractions.ownerUserId, ownerUserId),
        ),
      )
      .orderBy(desc(acquisitionInteractions.occurredAt))
      .limit(capped),
    db
      .select()
      .from(acquisitionEvents)
      .where(
        and(
          eq(acquisitionEvents.personId, personId),
          eq(acquisitionEvents.ownerUserId, ownerUserId),
          isNotNull(acquisitionEvents.personId),
        ),
      )
      .orderBy(desc(acquisitionEvents.occurredAt))
      .limit(capped),
    listPersonArtifacts(ownerUserId, personId, capped).catch(() => {
      // Table may not exist yet on partially migrated envs
      return [] as ReturnType<typeof mapKnowledgeArtifact>[];
    }),
  ]);

  const person = mapPerson(personRow);
  const interactions = interactionRows.map(mapInteraction);
  const events = eventRows.map(mapEvent);
  const entries = buildEntries(events, interactions, artifacts).slice(0, capped);

  const timeline: Timeline = {
    subjectType: 'person',
    subjectId: person.id,
    ownerUserId: person.ownerUserId,
    organizationId: person.organizationId ?? null,
    maturity: (person.relationshipMaturity as RelationshipMaturity) ?? null,
    events,
    interactions,
    artifacts,
    evidence: [],
    entries,
  };

  return {
    person,
    timeline,
    interactions,
  };
}

/** Merge helper exported for unit tests */
export function mergeTimelineEntriesForTest(
  events: AcquisitionEvent[],
  interactions: Interaction[],
  artifacts: KnowledgeArtifact[] = [],
): TimelineEntry[] {
  return buildEntries(events, interactions, artifacts);
}

/** Ensure relationship_maturity column exists (bootstrap). */
export async function ensureRelationshipMaturityColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "acquisition_persons"
    ADD COLUMN IF NOT EXISTS "relationship_maturity" text NOT NULL DEFAULT 'unknown'
  `);
}
