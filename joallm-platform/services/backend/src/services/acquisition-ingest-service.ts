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
  users,
} from '../database/schema.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

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

async function resolveOwnerUserId(preferredOwnerUserId?: string): Promise<string> {
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
}) {
  const { ownerUserId, phoneNumberId, displayPhoneNumber } = options;

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
    if (byExternal) return byExternal;
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
  if (byOwner) return byOwner;

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
      config: {
        displayPhoneNumber: displayPhoneNumber || null,
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

export async function ingestMetaWhatsAppWebhook(options: {
  payload: MetaWebhookPayload;
  headers?: Record<string, unknown>;
  ownerUserId?: string;
}) {
  const { payload, headers, ownerUserId: preferredOwner } = options;
  const ownerUserId = await resolveOwnerUserId(preferredOwner);

  const firstChange = payload.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId = firstChange?.metadata?.phone_number_id || config.metaPhoneNumberId;
  const displayPhoneNumber = firstChange?.metadata?.display_phone_number;

  const sourceConnection = await ensureMetaSourceConnection({
    ownerUserId,
    phoneNumberId,
    displayPhoneNumber,
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
        }

        for (const status of value.statuses || []) {
          if (!status.id) continue;
          const occurredAt = toDateFromUnixSeconds(status.timestamp);
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
  const accessToken = config.metaAccessToken;
  const phoneNumberId = config.metaPhoneNumberId;
  if (!accessToken || !phoneNumberId) {
    return;
  }

  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      for (const message of change.value?.messages || []) {
        if (!message.from) continue;
        try {
          const response = await fetch(
            `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: message.from,
                type: 'text',
                text: {
                  body: 'Hi! Thanks for reaching out to ATRISI. We will get back to you shortly.',
                },
              }),
            },
          );
          const data = await response.json();
          logger.info('WhatsApp auto-reply sent', data);
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
  const [person] = await db
    .select()
    .from(acquisitionPersons)
    .where(
      and(
        eq(acquisitionPersons.id, personId),
        eq(acquisitionPersons.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);

  if (!person) return null;

  const interactions = await db
    .select()
    .from(acquisitionInteractions)
    .where(
      and(
        eq(acquisitionInteractions.personId, personId),
        eq(acquisitionInteractions.ownerUserId, ownerUserId),
      ),
    )
    .orderBy(desc(acquisitionInteractions.occurredAt))
    .limit(limit);

  return { person, interactions };
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

  return {
    people: peopleCount?.count || 0,
    events: eventCount?.count || 0,
    interactions: interactionCount?.count || 0,
    sources,
  };
}
