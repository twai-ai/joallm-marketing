import { describe, expect, it } from 'vitest';
import {
  maxMaturity,
  maturityFromInteractionCount,
  maturityFromObservedContact,
} from '../../../services/relationship-maturity.js';
import { mergeTimelineEntriesForTest } from '../../../services/timeline-service.js';

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

describe('relationship maturity', () => {
  it('upgrades by interaction count and never downgrades via maxMaturity', () => {
    expect(maturityFromInteractionCount(0)).toBe('identified');
    expect(maturityFromInteractionCount(1)).toBe('engaged');
    expect(maturityFromInteractionCount(5)).toBe('participating');
    expect(maturityFromObservedContact()).toBe('observed');
    expect(maxMaturity('engaged', 'observed')).toBe('engaged');
    expect(maxMaturity('identified', 'participating')).toBe('participating');
  });
});

describe('timeline-service merge', () => {
  it('dedupes events that already have interactions and sorts newest first', () => {
    const events = [
      baseEvent({ id: 'evt-1', eventType: 'message.received', occurredAt: '2026-07-20T10:00:00.000Z' }),
      baseEvent({
        id: 'evt-2',
        eventType: 'message.delivered',
        occurredAt: '2026-07-20T11:00:00.000Z',
        attributes: { status: 'delivered' },
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
    expect(entries[0].kind).toBe('communication');
    expect(entries[0].refId).toBe('evt-2');
    expect(entries[0].summary).toBe('WhatsApp message delivered');
    expect(entries[1].kind).toBe('communication');
    expect(entries[1].refId).toBe('int-1');
  });

  it('includes KnowledgeArtifacts as artifact entries', () => {
    const entries = mergeTimelineEntriesForTest([], [], [
      {
        id: 'art-1',
        ownerUserId: 'user-1',
        organizationId: null,
        personId: 'person-1',
        initiativeId: null,
        acquisitionEventId: null,
        interactionId: null,
        artifactType: 'video',
        title: 'Mentor call summary',
        interpretation: {},
        signals: {},
        sourceFileId: 'file-1',
        knowledgeDocumentId: null,
        mediaAssetId: 'file-1',
        occurredAt: '2026-07-20T12:00:00.000Z',
        createdAt: '2026-07-20T12:00:00.000Z',
      },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('artifact');
    expect(entries[0].summary).toBe('Mentor call summary');
  });
});
