import { describe, expect, it } from 'vitest';
import type { AcquisitionEvent, Interaction } from '@joallm/shared';
import { mergeTimelineEntriesForTest } from '../../../services/timeline-service.js';

const baseEvent = (overrides: Partial<AcquisitionEvent>): AcquisitionEvent => ({
  id: 'evt-1',
  ownerUserId: 'user-1',
  organizationId: null,
  sourceConnectionId: 'src-1',
  rawRecordId: 'raw-1',
  source: 'meta',
  externalEventId: null,
  eventType: 'message.received',
  occurredAt: '2026-07-20T10:00:00.000Z',
  receivedAt: '2026-07-20T10:00:01.000Z',
  personId: 'person-1',
  initiativeId: null,
  campaignId: null,
  channel: 'whatsapp',
  objectType: null,
  objectId: null,
  attributes: {},
  schemaVersion: 1,
  createdAt: '2026-07-20T10:00:01.000Z',
  ...overrides,
});

const baseInteraction = (overrides: Partial<Interaction>): Interaction => ({
  id: 'int-1',
  ownerUserId: 'user-1',
  organizationId: null,
  personId: 'person-1',
  initiativeId: null,
  campaignId: null,
  sourceEventId: 'evt-1',
  kind: 'message',
  direction: 'inbound',
  summary: 'Hello',
  occurredAt: '2026-07-20T10:00:00.000Z',
  createdAt: '2026-07-20T10:00:01.000Z',
  ...overrides,
});

describe('timeline-service merge', () => {
  it('dedupes events that already have interactions and sorts newest first', () => {
    const events = [
      baseEvent({ id: 'evt-1', eventType: 'message.received', occurredAt: '2026-07-20T10:00:00.000Z' }),
      baseEvent({
        id: 'evt-2',
        eventType: 'message.status',
        occurredAt: '2026-07-20T11:00:00.000Z',
      }),
    ];
    const interactions = [
      baseInteraction({
        id: 'int-1',
        sourceEventId: 'evt-1',
        occurredAt: '2026-07-20T10:00:00.000Z',
        summary: 'Hello',
      }),
    ];

    const entries = mergeTimelineEntriesForTest(events, interactions);
    expect(entries).toHaveLength(2);
    expect(entries[0].kind).toBe('event');
    expect(entries[0].refId).toBe('evt-2');
    expect(entries[1].kind).toBe('interaction');
    expect(entries[1].refId).toBe('int-1');
  });
});
