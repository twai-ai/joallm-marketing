/**
 * Timeline Service — Phase A
 *
 * Assembles a Person-centric Timeline from acquisition events + interactions.
 * Shared contract: @joallm/shared Timeline / TimelineEntry
 */

import { and, desc, eq, isNotNull } from 'drizzle-orm';
import type {
  AcquisitionEvent,
  Interaction,
  Person,
  Timeline,
  TimelineEntry,
} from '@joallm/shared';
import { db } from '../database/connection.js';
import {
  acquisitionEvents,
  acquisitionInteractions,
  acquisitionPersons,
} from '../database/schema.js';

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapPerson(row: typeof acquisitionPersons.$inferSelect): Person {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId ?? null,
    displayName: row.displayName ?? null,
    primaryEmail: row.primaryEmail ?? null,
    primaryPhone: row.primaryPhone ?? null,
    status: (row.status as Person['status']) || 'identified',
    relationshipMaturity: null,
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

function buildEntries(
  events: AcquisitionEvent[],
  interactions: Interaction[],
): TimelineEntry[] {
  const interactionEventIds = new Set(
    interactions.map((item) => item.sourceEventId).filter(Boolean),
  );

  const interactionEntries: TimelineEntry[] = interactions.map((item) => ({
    id: `interaction:${item.id}`,
    kind: 'interaction',
    occurredAt: item.occurredAt,
    summary: item.summary || `${item.kind}${item.direction ? ` · ${item.direction}` : ''}`,
    refId: item.id,
    initiativeId: item.initiativeId ?? null,
    attributes: {
      kind: item.kind,
      direction: item.direction,
      sourceEventId: item.sourceEventId,
    },
  }));

  // Include person-linked events that did not become interactions (e.g. delivery status)
  const eventEntries: TimelineEntry[] = events
    .filter((event) => !interactionEventIds.has(event.id))
    .map((event) => ({
      id: `event:${event.id}`,
      kind: 'event',
      occurredAt: event.occurredAt,
      summary: event.eventType,
      refId: event.id,
      initiativeId: event.initiativeId ?? null,
      attributes: {
        source: event.source,
        channel: event.channel,
        eventType: event.eventType,
        ...event.attributes,
      },
    }));

  return [...interactionEntries, ...eventEntries].sort(
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
 * Person Timeline (Phase A primary subject).
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

  const [interactionRows, eventRows] = await Promise.all([
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
  ]);

  const person = mapPerson(personRow);
  const interactions = interactionRows.map(mapInteraction);
  const events = eventRows.map(mapEvent);
  const entries = buildEntries(events, interactions).slice(0, capped);

  const timeline: Timeline = {
    subjectType: 'person',
    subjectId: person.id,
    ownerUserId: person.ownerUserId,
    organizationId: person.organizationId ?? null,
    maturity: person.relationshipMaturity ?? null,
    events,
    interactions,
    artifacts: [],
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
): TimelineEntry[] {
  return buildEntries(events, interactions);
}
