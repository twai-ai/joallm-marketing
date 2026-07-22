import { createHash } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../database/connection.js';
import {
  acquisitionEvents,
  acquisitionInteractions,
  acquisitionPersonIdentities,
  acquisitionPersons,
  acquisitionRawRecords,
  acquisitionSourceConnections,
  platformConnectors,
  users,
} from '../database/schema.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';
import {
  maxMaturity,
  maturityFromInteractionCount,
  maturityFromObservedContact,
  isRelationshipMaturity,
  type RelationshipMaturity,
} from './relationship-maturity.js';
import {
  ensureDefaultWhatsAppPublishingProfile,
  ensureMetaWhatsAppChannelStack,
  listStudioChannels,
} from './channel-service.js';
import { listPlatformConnectors } from './connector-service.js';

const META_PROVIDER = 'meta_whatsapp';

export type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: { name?: string };
        }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
        }>;
      };
    }>;
  }>;
};

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function toDateFromUnixSeconds(value?: string): Date {
  if (!value) return new Date();
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return new Date();
  return new Date(parsed * 1000);
}

/**
 * Resolve which JoaLLM user owns inbound Meta events at runtime.
 * Prefer the Studio-connected source for this phone_number_id so
 * ACQUISITION_DEFAULT_OWNER_USER_ID is optional.
 */
async function resolveOwnerUserId(options?: {
  preferredOwnerUserId?: string;
  phoneNumberId?: string;
}): Promise<string> {
  const preferredOwnerUserId = options?.preferredOwnerUserId;
  const phoneNumberId = options?.phoneNumberId || config.metaPhoneNumberId;

  if (phoneNumberId) {
    const [boundSource] = await db
      .select({ ownerUserId: acquisitionSourceConnections.ownerUserId })
      .from(acquisitionSourceConnections)
      .where(
        and(
          eq(acquisitionSourceConnections.provider, META_PROVIDER),
          eq(acquisitionSourceConnections.externalAccountId, phoneNumberId),
        ),
      )
      .limit(1);
    if (boundSource?.ownerUserId) {
      return boundSource.ownerUserId;
    }
  }

  if (preferredOwnerUserId) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, preferredOwnerUserId))
      .limit(1);
    if (existing) return existing.id;
  }

  const envOwner = config.acquisitionDefaultOwnerUserId;
  if (envOwner) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, envOwner))
      .limit(1);
    if (existing) return existing.id;
  }

  // Any previously connected Meta WhatsApp source (most recently updated)
  const [recentSource] = await db
    .select({ ownerUserId: acquisitionSourceConnections.ownerUserId })
    .from(acquisitionSourceConnections)
    .where(eq(acquisitionSourceConnections.provider, META_PROVIDER))
    .orderBy(desc(acquisitionSourceConnections.updatedAt))
    .limit(1);
  if (recentSource?.ownerUserId) {
    return recentSource.ownerUserId;
  }

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'superuser'))
    .limit(1);
  if (admin) return admin.id;

  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (!anyUser) {
    throw new Error('No users available to own Acquisition Intelligence records');
  }
  return anyUser.id;
}

export async function ensureMetaSourceConnection(options: {
  ownerUserId: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  /** When true (Studio Connect), reassign source ownership to the logged-in user. */
  claimOwnership?: boolean;
}) {
  const { ownerUserId, phoneNumberId, displayPhoneNumber, claimOwnership = false } = options;

  // Studio-1: Platform Connector → Studio Channel → Publishing Profile
  let connectorId: string | null = null;
  let channelId: string | null = null;
  try {
    const stack = await ensureMetaWhatsAppChannelStack({
      ownerUserId,
      phoneNumberId,
      displayPhoneNumber,
    });
    connectorId = stack.connector.id;
    channelId = stack.channel.id;
    await ensureDefaultWhatsAppPublishingProfile({
      ownerUserId,
      channelId: stack.channel.id,
    });
  } catch (error) {
    logger.warn('Meta WhatsApp Connector/Channel stack ensure failed (continuing source)', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (phoneNumberId) {
    const [byExternal] = await db
      .select()
      .from(acquisitionSourceConnections)
      .where(
        and(
          eq(acquisitionSourceConnections.provider, META_PROVIDER),
          eq(acquisitionSourceConnections.externalAccountId, phoneNumberId),
        ),
      )
      .limit(1);
    if (byExternal) {
      const shouldClaim = claimOwnership && byExternal.ownerUserId !== ownerUserId;
      if (connectorId || channelId || shouldClaim || displayPhoneNumber) {
        const [linked] = await db
          .update(acquisitionSourceConnections)
          .set({
            ownerUserId: shouldClaim ? ownerUserId : byExternal.ownerUserId,
            connectorId: connectorId || byExternal.connectorId,
            channelId: channelId || byExternal.channelId,
            name: displayPhoneNumber
              ? `WhatsApp (${displayPhoneNumber})`
              : byExternal.name,
            status: 'active',
            config: {
              ...((byExternal.config as Record<string, unknown>) || {}),
              displayPhoneNumber:
                displayPhoneNumber ||
                (byExternal.config as { displayPhoneNumber?: string } | null)?.displayPhoneNumber ||
                null,
              connectorId: connectorId || byExternal.connectorId,
              channelId: channelId || byExternal.channelId,
            },
            updatedAt: new Date(),
          })
          .where(eq(acquisitionSourceConnections.id, byExternal.id))
          .returning();
        return linked;
      }
      return byExternal;
    }
  }

  const [byOwner] = await db
    .select()
    .from(acquisitionSourceConnections)
    .where(
      and(
        eq(acquisitionSourceConnections.ownerUserId, ownerUserId),
        eq(acquisitionSourceConnections.provider, META_PROVIDER),
      ),
    )
    .limit(1);
  if (byOwner) {
    if (connectorId || channelId) {
      const [linked] = await db
        .update(acquisitionSourceConnections)
        .set({
          connectorId: connectorId || byOwner.connectorId,
          channelId: channelId || byOwner.channelId,
          externalAccountId: phoneNumberId || byOwner.externalAccountId,
          updatedAt: new Date(),
        })
        .where(eq(acquisitionSourceConnections.id, byOwner.id))
        .returning();
      return linked;
    }
    return byOwner;
  }

  const [created] = await db
    .insert(acquisitionSourceConnections)
    .values({
      ownerUserId,
      provider: META_PROVIDER,
      name: displayPhoneNumber
        ? `WhatsApp (${displayPhoneNumber})`
        : 'Meta WhatsApp',
      status: 'active',
      externalAccountId: phoneNumberId,
      connectorId,
      channelId,
      config: {
        displayPhoneNumber: displayPhoneNumber || null,
        connectorId,
        channelId,
      },
    })
    .returning();

  return created;
}

async function resolveOrCreatePersonByWhatsApp(options: {
  ownerUserId: string;
  waId: string;
  displayName?: string;
}) {
  const { ownerUserId, waId, displayName } = options;

  const [existingIdentity] = await db
    .select()
    .from(acquisitionPersonIdentities)
    .where(
      and(
        eq(acquisitionPersonIdentities.ownerUserId, ownerUserId),
        eq(acquisitionPersonIdentities.provider, 'whatsapp'),
        eq(acquisitionPersonIdentities.externalId, waId),
      ),
    )
    .limit(1);

  if (existingIdentity) {
    const [person] = await db
      .select()
      .from(acquisitionPersons)
      .where(eq(acquisitionPersons.id, existingIdentity.personId))
      .limit(1);
    return person;
  }

  const [person] = await db
    .insert(acquisitionPersons)
    .values({
      ownerUserId,
      displayName: displayName || waId,
      primaryPhone: waId,
      status: 'identified',
      relationshipMaturity: 'identified',
      metadata: { source: 'meta_whatsapp' },
    })
    .returning();

  await db.insert(acquisitionPersonIdentities).values({
    ownerUserId,
    personId: person.id,
    provider: 'whatsapp',
    externalId: waId,
    confidence: 1,
    isVerified: true,
    verifiedAt: new Date(),
  });

  try {
    await db.insert(acquisitionPersonIdentities).values({
      ownerUserId,
      personId: person.id,
      provider: 'phone',
      externalId: waId,
      confidence: 0.9,
      isVerified: false,
    });
  } catch {
    // Unique constraint — identity already exists
  }

  return person;
}

async function refreshPersonMaturity(
  personId: string,
  floor: RelationshipMaturity = 'unknown',
): Promise<void> {
  const [person] = await db
    .select({
      id: acquisitionPersons.id,
      relationshipMaturity: acquisitionPersons.relationshipMaturity,
    })
    .from(acquisitionPersons)
    .where(eq(acquisitionPersons.id, personId))
    .limit(1);
  if (!person) return;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(acquisitionInteractions)
    .where(eq(acquisitionInteractions.personId, personId));

  const fromCount = maturityFromInteractionCount(countRow?.count || 0);
  const current = isRelationshipMaturity(person.relationshipMaturity)
    ? person.relationshipMaturity
    : 'unknown';
  const next = maxMaturity(maxMaturity(current, fromCount), floor);
  if (next === current) return;

  await db
    .update(acquisitionPersons)
    .set({ relationshipMaturity: next, updatedAt: new Date() })
    .where(eq(acquisitionPersons.id, personId));
}

export async function ingestMetaWhatsAppWebhook(options: {
  payload: MetaWebhookPayload;
  headers?: Record<string, unknown>;
  ownerUserId?: string;
}) {
  const { payload, headers, ownerUserId: preferredOwner } = options;

  const firstChange = payload.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId = firstChange?.metadata?.phone_number_id || config.metaPhoneNumberId;
  const displayPhoneNumber = firstChange?.metadata?.display_phone_number;

  // Runtime owner: bound Meta source for this phone_number_id → preferred → env → fallbacks
  const ownerUserId = await resolveOwnerUserId({
    preferredOwnerUserId: preferredOwner,
    phoneNumberId,
  });

  const sourceConnection = await ensureMetaSourceConnection({
    ownerUserId,
    phoneNumberId,
    displayPhoneNumber,
    claimOwnership: false,
  });

  const payloadHash = hashPayload(payload);
  const [rawRecord] = await db
    .insert(acquisitionRawRecords)
    .values({
      ownerUserId: sourceConnection.ownerUserId,
      sourceConnectionId: sourceConnection.id,
      externalEventId: payload.entry?.[0]?.id,
      eventName: payload.object || 'whatsapp_business_account',
      headers: headers || {},
      payload: payload as Record<string, unknown>,
      payloadHash,
      processingStatus: 'queued',
      occurredAt: new Date(),
    })
    .returning();

  const createdEvents: Array<{ id: string; eventType: string }> = [];
  const createdInteractions: Array<{ id: string; personId: string }> = [];

  try {
    if (payload.object !== 'whatsapp_business_account') {
      await db
        .update(acquisitionRawRecords)
        .set({ processingStatus: 'ignored' })
        .where(eq(acquisitionRawRecords.id, rawRecord.id));
      return { rawRecordId: rawRecord.id, ignored: true, events: [], interactions: [] };
    }

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        const contactNameByWaId = new Map<string, string>();
        for (const contact of value.contacts || []) {
          if (contact.wa_id && contact.profile?.name) {
            contactNameByWaId.set(contact.wa_id, contact.profile.name);
          }
        }

        for (const message of value.messages || []) {
          if (!message.from || !message.id) continue;

          const person = await resolveOrCreatePersonByWhatsApp({
            ownerUserId: sourceConnection.ownerUserId,
            waId: message.from,
            displayName: contactNameByWaId.get(message.from),
          });

          const textBody = message.text?.body || '';
          const occurredAt = toDateFromUnixSeconds(message.timestamp);

          const [event] = await db
            .insert(acquisitionEvents)
            .values({
              ownerUserId: sourceConnection.ownerUserId,
              sourceConnectionId: sourceConnection.id,
              rawRecordId: rawRecord.id,
              source: META_PROVIDER,
              externalEventId: message.id,
              eventType: 'message.received',
              occurredAt,
              personId: person.id,
              channel: 'whatsapp',
              objectType: 'message',
              objectId: message.id,
              attributes: {
                messageType: message.type || 'text',
                text: textBody,
                from: message.from,
              },
              schemaVersion: 1,
            })
            .returning();

          createdEvents.push({ id: event.id, eventType: event.eventType });

          const [interaction] = await db
            .insert(acquisitionInteractions)
            .values({
              ownerUserId: sourceConnection.ownerUserId,
              personId: person.id,
              sourceEventId: event.id,
              kind: 'message',
              direction: 'inbound',
              summary: textBody
                ? `WhatsApp: ${textBody.slice(0, 180)}`
                : `WhatsApp ${message.type || 'message'} received`,
              occurredAt,
            })
            .returning();

          createdInteractions.push({ id: interaction.id, personId: person.id });

          await refreshPersonMaturity(person.id, 'engaged');

          // Sprint 6 — attribute inbound to recent published campaign → Program Interest
          try {
            const { attributeInboundWhatsAppInterest } = await import(
              './program-interest-service.js'
            );
            await attributeInboundWhatsAppInterest({
              ownerUserId: sourceConnection.ownerUserId,
              personId: person.id,
              eventId: event.id,
              textBody,
              occurredAt,
            });
          } catch (attrError) {
            logger.warn('Program Interest attribution skipped', attrError);
          }
        }

        for (const status of value.statuses || []) {
          if (!status.id) continue;
          const occurredAt = toDateFromUnixSeconds(status.timestamp);

          let personId: string | null = null;
          if (status.recipient_id) {
            const person = await resolveOrCreatePersonByWhatsApp({
              ownerUserId: sourceConnection.ownerUserId,
              waId: status.recipient_id,
            });
            personId = person?.id ?? null;
            if (personId) {
              await refreshPersonMaturity(personId, maturityFromObservedContact());
            }
          }

          const [event] = await db
            .insert(acquisitionEvents)
            .values({
              ownerUserId: sourceConnection.ownerUserId,
              sourceConnectionId: sourceConnection.id,
              rawRecordId: rawRecord.id,
              source: META_PROVIDER,
              externalEventId: status.id,
              eventType: `message.${status.status || 'status'}`,
              occurredAt,
              personId,
              channel: 'whatsapp',
              objectType: 'message_status',
              objectId: status.id,
              attributes: {
                status: status.status,
                recipientId: status.recipient_id,
              },
              schemaVersion: 1,
            })
            .returning();

          createdEvents.push({ id: event.id, eventType: event.eventType });
        }
      }
    }

    await db
      .update(acquisitionRawRecords)
      .set({ processingStatus: 'processed', errorMessage: null })
      .where(eq(acquisitionRawRecords.id, rawRecord.id));

    await db
      .update(acquisitionSourceConnections)
      .set({
        lastSuccessAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(acquisitionSourceConnections.id, sourceConnection.id));

    return {
      rawRecordId: rawRecord.id,
      ignored: false,
      events: createdEvents,
      interactions: createdInteractions,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingest error';
    logger.error('Acquisition Meta ingest failed', { error: message, rawRecordId: rawRecord.id });

    await db
      .update(acquisitionRawRecords)
      .set({ processingStatus: 'failed', errorMessage: message })
      .where(eq(acquisitionRawRecords.id, rawRecord.id));

    await db
      .update(acquisitionSourceConnections)
      .set({
        lastErrorAt: new Date(),
        lastErrorMessage: message,
        status: 'error',
        updatedAt: new Date(),
      })
      .where(eq(acquisitionSourceConnections.id, sourceConnection.id));

    throw error;
  }
}

export async function maybeSendWhatsAppAutoReply(payload: MetaWebhookPayload): Promise<void> {
  if (!config.metaAccessToken || !config.metaPhoneNumberId) {
    return;
  }

  if (payload.object !== 'whatsapp_business_account') return;

  const { sendWhatsAppText } = await import('./whatsapp-send-service.js');

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        if (!message.from) continue;
        try {
          const result = await sendWhatsAppText({
            to: message.from,
            body: 'Hi! Thanks for reaching out to ATRISI. We will get back to you shortly.',
          });
          if (result.ok) {
            logger.info('WhatsApp auto-reply sent', { messageId: result.messageId });
          } else {
            logger.error('WhatsApp auto-reply failed', result.error);
          }
        } catch (error) {
          logger.error('WhatsApp auto-reply failed', error);
        }
      }
    }
  }
}

export async function listAcquisitionPeople(ownerUserId: string, limit = 50) {
  return db
    .select()
    .from(acquisitionPersons)
    .where(eq(acquisitionPersons.ownerUserId, ownerUserId))
    .orderBy(desc(acquisitionPersons.updatedAt))
    .limit(limit);
}

export async function getPersonTimeline(ownerUserId: string, personId: string, limit = 100) {
  // Phase A: delegate to Timeline Service (events + interactions → Timeline)
  const { getPersonTimeline: getTimeline } = await import('./timeline-service.js');
  const result = await getTimeline(ownerUserId, personId, limit);
  if (!result) return null;
  // Keep Phase-1 keys for older clients while exposing full Timeline
  return {
    person: result.person,
    interactions: result.interactions,
    timeline: result.timeline,
    entries: result.timeline.entries,
  };
}

export async function listSourceConnections(ownerUserId: string) {
  return db
    .select()
    .from(acquisitionSourceConnections)
    .where(eq(acquisitionSourceConnections.ownerUserId, ownerUserId))
    .orderBy(desc(acquisitionSourceConnections.updatedAt));
}

export async function listRecentEvents(ownerUserId: string, limit = 50) {
  return db
    .select()
    .from(acquisitionEvents)
    .where(eq(acquisitionEvents.ownerUserId, ownerUserId))
    .orderBy(desc(acquisitionEvents.occurredAt))
    .limit(limit);
}

export async function getAcquisitionOverview(ownerUserId: string) {
  const [peopleCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(acquisitionPersons)
    .where(eq(acquisitionPersons.ownerUserId, ownerUserId));

  const [eventCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(acquisitionEvents)
    .where(eq(acquisitionEvents.ownerUserId, ownerUserId));

  const [interactionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(acquisitionInteractions)
    .where(eq(acquisitionInteractions.ownerUserId, ownerUserId));

  const sources = await listSourceConnections(ownerUserId);

  let channels: Awaited<ReturnType<typeof listStudioChannels>> = [];
  let connectors: Awaited<ReturnType<typeof listPlatformConnectors>> = [];
  try {
    channels = await listStudioChannels(ownerUserId);
    connectors = await listPlatformConnectors(ownerUserId);
  } catch {
    // Tables may not exist yet on partially migrated envs
  }

  const metaSource =
    sources.find((s) => s.provider === META_PROVIDER) || null;
  const whatsappChannel =
    channels.find((c) => c.kind === 'whatsapp') || null;
  const metaConnector =
    connectors.find((c) => c.provider === 'meta_whatsapp') || null;

  const { probeMetaWhatsAppConnection } = await import('./whatsapp-send-service.js');
  const probe = await probeMetaWhatsAppConnection({
    phoneNumberId:
      metaSource?.externalAccountId ||
      metaConnector?.externalAccountId ||
      config.metaPhoneNumberId ||
      undefined,
  });

  // Keep connector row honest after live probe
  if (metaConnector) {
    try {
      await db
        .update(platformConnectors)
        .set({
          status: probe.ok ? 'connected' : 'error',
          lastValidatedAt: probe.ok
            ? new Date()
            : metaConnector.lastValidatedAt
              ? new Date(metaConnector.lastValidatedAt)
              : null,
          lastErrorAt: probe.ok ? null : new Date(),
          lastErrorMessage: probe.ok ? null : probe.error,
          updatedAt: new Date(),
        })
        .where(eq(platformConnectors.id, metaConnector.id));
    } catch {
      // Non-fatal — overview still returns probe results
    }
  }

  const metaHealth = {
    boundToUser: Boolean(metaSource || whatsappChannel),
    sourceStatus: metaSource?.status || null,
    channelStatus: whatsappChannel?.status || null,
    connectorStatus: probe.ok ? 'connected' : metaConnector ? 'error' : null,
    tokenConfigured: probe.tokenConfigured,
    phoneNumberIdConfigured: probe.phoneNumberIdConfigured,
    verifyTokenConfigured: probe.verifyTokenConfigured,
    phoneNumberId: probe.phoneNumberId,
    displayPhoneNumber: probe.displayPhoneNumber,
    verifiedName: probe.verifiedName,
    qualityRating: probe.qualityRating,
    graphOk: probe.ok,
    graphError: probe.error,
    webhookPath: '/api/meta/webhook',
    lastWebhookSuccessAt: metaSource?.lastSuccessAt || null,
    lastWebhookErrorAt: metaSource?.lastErrorAt || null,
    lastWebhookError: metaSource?.lastErrorMessage || null,
    inboundEvents: eventCount?.count || 0,
    people: peopleCount?.count || 0,
  };

  // Refresh connectors list status for response if we updated
  if (metaConnector) {
    connectors = connectors.map((c) =>
      c.id === metaConnector.id
        ? {
            ...c,
            status: (probe.ok ? 'connected' : 'error') as typeof c.status,
            lastErrorMessage: probe.ok ? null : probe.error,
          }
        : c,
    );
  }

  return {
    people: peopleCount?.count || 0,
    events: eventCount?.count || 0,
    interactions: interactionCount?.count || 0,
    sources,
    channels,
    connectors,
    metaHealth,
  };
}
