import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
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
  ensureMetaPageChannelStack,
  ensureMetaWhatsAppChannelStack,
  listStudioChannels,
} from './channel-service.js';
import { listPlatformConnectors } from './connector-service.js';

const META_PROVIDER = 'meta_whatsapp';
const META_FB_PROVIDER = 'meta_facebook_page';
const META_IG_PROVIDER = 'meta_instagram';
const META_LEAD_PROVIDER = 'meta_lead_ads';
const META_ADS_PROVIDER = 'meta_ads';
const PAGE_SOURCE_PROVIDERS = [META_FB_PROVIDER, META_IG_PROVIDER] as const;

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
 * Prefer the Studio-connected source for this phone_number_id / page_id so
 * ACQUISITION_DEFAULT_OWNER_USER_ID is optional.
 */
async function resolveOwnerUserId(options?: {
  preferredOwnerUserId?: string;
  phoneNumberId?: string;
  pageId?: string;
}): Promise<string> {
  const preferredOwnerUserId = options?.preferredOwnerUserId;
  const phoneNumberId = options?.phoneNumberId || config.metaPhoneNumberId;
  const pageId = options?.pageId || config.metaPageId;

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

  if (pageId) {
    for (const provider of PAGE_SOURCE_PROVIDERS) {
      const [boundSource] = await db
        .select({ ownerUserId: acquisitionSourceConnections.ownerUserId })
        .from(acquisitionSourceConnections)
        .where(
          and(
            eq(acquisitionSourceConnections.provider, provider),
            eq(acquisitionSourceConnections.externalAccountId, pageId),
          ),
        )
        .limit(1);
      if (boundSource?.ownerUserId) {
        return boundSource.ownerUserId;
      }
    }
    // IG source may use IG account id as externalAccountId
    const igId = config.metaInstagramAccountId;
    if (igId) {
      const [igSource] = await db
        .select({ ownerUserId: acquisitionSourceConnections.ownerUserId })
        .from(acquisitionSourceConnections)
        .where(
          and(
            eq(acquisitionSourceConnections.provider, META_IG_PROVIDER),
            eq(acquisitionSourceConnections.externalAccountId, igId),
          ),
        )
        .limit(1);
      if (igSource?.ownerUserId) return igSource.ownerUserId;
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

  const [recentSource] = await db
    .select({ ownerUserId: acquisitionSourceConnections.ownerUserId })
    .from(acquisitionSourceConnections)
    .where(
      inArray(acquisitionSourceConnections.provider, [
        META_PROVIDER,
        META_FB_PROVIDER,
        META_IG_PROVIDER,
      ]),
    )
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

async function upsertPageSourceConnection(options: {
  ownerUserId: string;
  provider:
    | typeof META_FB_PROVIDER
    | typeof META_IG_PROVIDER
    | typeof META_LEAD_PROVIDER
    | typeof META_ADS_PROVIDER;
  externalAccountId: string;
  name: string;
  connectorId?: string | null;
  channelId?: string | null;
  claimOwnership?: boolean;
  config?: Record<string, unknown>;
}) {
  const {
    ownerUserId,
    provider,
    externalAccountId,
    name,
    connectorId,
    channelId,
    claimOwnership = false,
    config: extraConfig,
  } = options;

  const [byExternal] = await db
    .select()
    .from(acquisitionSourceConnections)
    .where(
      and(
        eq(acquisitionSourceConnections.provider, provider),
        eq(acquisitionSourceConnections.externalAccountId, externalAccountId),
      ),
    )
    .limit(1);

  if (byExternal) {
    const shouldClaim = claimOwnership && byExternal.ownerUserId !== ownerUserId;
    const [linked] = await db
      .update(acquisitionSourceConnections)
      .set({
        ownerUserId: shouldClaim ? ownerUserId : byExternal.ownerUserId,
        connectorId: connectorId || byExternal.connectorId,
        channelId: channelId || byExternal.channelId,
        name,
        status: 'active',
        config: {
          ...((byExternal.config as Record<string, unknown>) || {}),
          ...(extraConfig || {}),
        },
        updatedAt: new Date(),
      })
      .where(eq(acquisitionSourceConnections.id, byExternal.id))
      .returning();
    return linked;
  }

  const [byOwner] = await db
    .select()
    .from(acquisitionSourceConnections)
    .where(
      and(
        eq(acquisitionSourceConnections.ownerUserId, ownerUserId),
        eq(acquisitionSourceConnections.provider, provider),
      ),
    )
    .limit(1);

  if (byOwner) {
    const [linked] = await db
      .update(acquisitionSourceConnections)
      .set({
        externalAccountId,
        connectorId: connectorId || byOwner.connectorId,
        channelId: channelId || byOwner.channelId,
        name,
        status: 'active',
        config: {
          ...((byOwner.config as Record<string, unknown>) || {}),
          ...(extraConfig || {}),
        },
        updatedAt: new Date(),
      })
      .where(eq(acquisitionSourceConnections.id, byOwner.id))
      .returning();
    return linked;
  }

  const [created] = await db
    .insert(acquisitionSourceConnections)
    .values({
      ownerUserId,
      provider,
      name,
      status: 'active',
      externalAccountId,
      connectorId: connectorId || null,
      channelId: channelId || null,
      config: extraConfig || {},
    })
    .returning();

  return created;
}

/** Bind Facebook Page + Instagram acquisition sources to the logged-in user. */
export async function ensureMetaPageSourceConnections(options: {
  ownerUserId: string;
  pageId?: string;
  claimOwnership?: boolean;
}) {
  const { ownerUserId, claimOwnership = false } = options;
  const stack = await ensureMetaPageChannelStack({
    ownerUserId,
    pageId: options.pageId,
  });

  const pageId =
    stack.pageId || options.pageId || config.metaPageId || stack.connector.externalAccountId;
  if (!pageId) {
    throw new Error('META_PAGE_ID is required to connect Facebook + Instagram');
  }

  const igExternalId = stack.igAccountId || config.metaInstagramAccountId || pageId;

  const facebookSource = await upsertPageSourceConnection({
    ownerUserId,
    provider: META_FB_PROVIDER,
    externalAccountId: pageId,
    name: stack.pageName ? `Facebook (${stack.pageName})` : 'Facebook Page',
    connectorId: stack.connector.id,
    channelId: stack.facebookChannel.id,
    claimOwnership,
    config: {
      pageId,
      pageName: stack.pageName,
      surface: 'facebook',
    },
  });

  const instagramSource = await upsertPageSourceConnection({
    ownerUserId,
    provider: META_IG_PROVIDER,
    externalAccountId: igExternalId,
    name: stack.igUsername
      ? `Instagram (@${stack.igUsername})`
      : 'Instagram',
    connectorId: stack.connector.id,
    channelId: stack.instagramChannel.id,
    claimOwnership,
    config: {
      pageId,
      pageName: stack.pageName,
      igAccountId: stack.igAccountId,
      igUsername: stack.igUsername,
      surface: 'instagram',
    },
  });

  return {
    connector: stack.connector,
    facebookChannel: stack.facebookChannel,
    instagramChannel: stack.instagramChannel,
    facebookSource,
    instagramSource,
    pageId,
    pageName: stack.pageName,
    igAccountId: stack.igAccountId,
  };
}

/** Bind Meta Ads + Lead Ads acquisition sources (Marketing API lifecycle). */
export async function ensureMetaMarketingSources(options: {
  ownerUserId: string;
  pageId?: string;
  adAccountId?: string;
  claimOwnership?: boolean;
}) {
  const { ownerUserId, claimOwnership = false } = options;
  const {
    normalizeAdAccountId,
    probeMetaAdAccount,
    probeMetaPageConnection,
  } = await import('./meta-graph-service.js');

  const pageId = options.pageId || config.metaPageId || undefined;
  const adAccountId =
    normalizeAdAccountId(options.adAccountId || config.metaAdAccountId || null) ||
    undefined;

  let connectorId: string | null = null;
  let adsChannelId: string | null = null;
  try {
    const stack = await ensureMetaPageChannelStack({
      ownerUserId,
      pageId,
    });
    connectorId = stack.connector.id;
    const { ensureStudioChannelByKind } = await import('./channel-service.js');
    const adsChannel = await ensureStudioChannelByKind({
      ownerUserId,
      kind: 'meta_ads',
      name: 'Meta Ads',
    });
    adsChannelId = adsChannel.id;
  } catch (error) {
    logger.warn('Meta marketing channel stack partial failure', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const pageProbe = await probeMetaPageConnection({ pageId });
  const adProbe = await probeMetaAdAccount({ adAccountId });

  const leadExternalId = pageId || pageProbe.pageId || 'meta-leads';
  const adsExternalId = adAccountId || adProbe.adAccountId || 'meta-ads';

  const leadSource = await upsertPageSourceConnection({
    ownerUserId,
    provider: META_LEAD_PROVIDER,
    externalAccountId: leadExternalId,
    name: pageProbe.pageName
      ? `Lead Ads (${pageProbe.pageName})`
      : 'Meta Lead Ads',
    connectorId,
    channelId: adsChannelId,
    claimOwnership,
    config: {
      pageId: pageProbe.pageId || pageId || null,
      pageName: pageProbe.pageName,
      surface: 'lead_ads',
      webhookField: 'leadgen',
    },
  });

  const adsSource = await upsertPageSourceConnection({
    ownerUserId,
    provider: META_ADS_PROVIDER,
    externalAccountId: adsExternalId,
    name: adProbe.accountName
      ? `Meta Ads (${adProbe.accountName})`
      : 'Meta Ads',
    connectorId,
    channelId: adsChannelId,
    claimOwnership,
    config: {
      adAccountId: adProbe.adAccountId || adAccountId || null,
      currency: adProbe.currency,
      surface: 'ads',
    },
  });

  return {
    leadSource,
    adsSource,
    pageProbe,
    adProbe,
    adsChannelId,
  };
}

async function resolveOrCreatePersonByWhatsApp(options: {
  ownerUserId: string;
  waId: string;
  displayName?: string;
}): Promise<typeof acquisitionPersons.$inferSelect | undefined> {
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
          if (!person) continue;

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

export type MetaPageWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    messaging?: Array<{
      sender?: { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
      message?: {
        mid?: string;
        text?: string;
        is_echo?: boolean;
      };
      postback?: { payload?: string; title?: string };
    }>;
    changes?: Array<{
      field?: string;
      value?: {
        leadgen_id?: string;
        page_id?: string;
        form_id?: string;
        ad_id?: string;
        adgroup_id?: string;
        created_time?: number | string;
      };
    }>;
  }>;
};

async function resolveOrCreatePersonByMetaMessaging(options: {
  ownerUserId: string;
  externalId: string;
  displayName?: string;
  surface: 'facebook' | 'instagram';
}) {
  const { ownerUserId, externalId, displayName, surface } = options;
  const identityExternalId = `${surface}:${externalId}`;

  const [existingIdentity] = await db
    .select()
    .from(acquisitionPersonIdentities)
    .where(
      and(
        eq(acquisitionPersonIdentities.ownerUserId, ownerUserId),
        eq(acquisitionPersonIdentities.provider, 'meta'),
        eq(acquisitionPersonIdentities.externalId, identityExternalId),
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
      displayName: displayName || `${surface} ${externalId.slice(-6)}`,
      status: 'identified',
      relationshipMaturity: 'identified',
      metadata: { source: surface === 'facebook' ? META_FB_PROVIDER : META_IG_PROVIDER, surface },
    })
    .returning();

  await db.insert(acquisitionPersonIdentities).values({
    ownerUserId,
    personId: person.id,
    provider: 'meta',
    externalId: identityExternalId,
    confidence: 1,
    isVerified: true,
    verifiedAt: new Date(),
  });

  return person;
}

async function resolveOrCreatePersonFromLead(options: {
  ownerUserId: string;
  identityKey: string;
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
}) {
  const { ownerUserId, identityKey, email, phone, displayName } = options;

  if (email) {
    const [byEmail] = await db
      .select()
      .from(acquisitionPersonIdentities)
      .where(
        and(
          eq(acquisitionPersonIdentities.ownerUserId, ownerUserId),
          eq(acquisitionPersonIdentities.provider, 'email'),
          eq(acquisitionPersonIdentities.externalId, email.toLowerCase()),
        ),
      )
      .limit(1);
    if (byEmail) {
      const [person] = await db
        .select()
        .from(acquisitionPersons)
        .where(eq(acquisitionPersons.id, byEmail.personId))
        .limit(1);
      return person;
    }
  }

  if (phone) {
    const normalized = phone.replace(/\D/g, '');
    const [byPhone] = await db
      .select()
      .from(acquisitionPersonIdentities)
      .where(
        and(
          eq(acquisitionPersonIdentities.ownerUserId, ownerUserId),
          eq(acquisitionPersonIdentities.provider, 'phone'),
          eq(acquisitionPersonIdentities.externalId, normalized),
        ),
      )
      .limit(1);
    if (byPhone) {
      const [person] = await db
        .select()
        .from(acquisitionPersons)
        .where(eq(acquisitionPersons.id, byPhone.personId))
        .limit(1);
      return person;
    }
  }

  const metaExternalId = `lead:${identityKey}`;
  const [existingMeta] = await db
    .select()
    .from(acquisitionPersonIdentities)
    .where(
      and(
        eq(acquisitionPersonIdentities.ownerUserId, ownerUserId),
        eq(acquisitionPersonIdentities.provider, 'meta'),
        eq(acquisitionPersonIdentities.externalId, metaExternalId),
      ),
    )
    .limit(1);
  if (existingMeta) {
    const [person] = await db
      .select()
      .from(acquisitionPersons)
      .where(eq(acquisitionPersons.id, existingMeta.personId))
      .limit(1);
    return person;
  }

  const [person] = await db
    .insert(acquisitionPersons)
    .values({
      ownerUserId,
      displayName: displayName || email || phone || identityKey,
      primaryEmail: email || null,
      primaryPhone: phone || null,
      status: 'identified',
      relationshipMaturity: 'identified',
      metadata: { source: META_LEAD_PROVIDER },
    })
    .returning();

  await db.insert(acquisitionPersonIdentities).values({
    ownerUserId,
    personId: person.id,
    provider: 'meta',
    externalId: metaExternalId,
    confidence: 1,
    isVerified: true,
    verifiedAt: new Date(),
  });

  if (email) {
    try {
      await db.insert(acquisitionPersonIdentities).values({
        ownerUserId,
        personId: person.id,
        provider: 'email',
        externalId: email.toLowerCase(),
        confidence: 1,
        isVerified: true,
        verifiedAt: new Date(),
      });
    } catch {
      // unique
    }
  }
  if (phone) {
    try {
      await db.insert(acquisitionPersonIdentities).values({
        ownerUserId,
        personId: person.id,
        provider: 'phone',
        externalId: phone.replace(/\D/g, ''),
        confidence: 0.9,
        isVerified: false,
      });
    } catch {
      // unique
    }
  }

  return person;
}

export async function ingestMetaPageWebhook(options: {
  payload: MetaPageWebhookPayload;
  headers?: Record<string, unknown>;
  ownerUserId?: string;
}) {
  const { payload, headers, ownerUserId: preferredOwner } = options;
  const objectType = payload.object;
  if (objectType !== 'page' && objectType !== 'instagram') {
    return { rawRecordId: null, ignored: true, events: [], interactions: [] };
  }

  const surface: 'facebook' | 'instagram' =
    objectType === 'instagram' ? 'instagram' : 'facebook';
  const pageId =
    payload.entry?.[0]?.id ||
    payload.entry?.[0]?.messaging?.[0]?.recipient?.id ||
    config.metaPageId;

  const ownerUserId = await resolveOwnerUserId({
    preferredOwnerUserId: preferredOwner,
    pageId: pageId || undefined,
  });

  // Ensure sources exist (without claiming) so webhook traffic has a home
  let sources;
  try {
    sources = await ensureMetaPageSourceConnections({
      ownerUserId,
      pageId: pageId || undefined,
      claimOwnership: false,
    });
  } catch (error) {
    logger.warn('Meta Page source ensure failed during ingest', {
      error: error instanceof Error ? error.message : String(error),
    });
    sources = null;
  }

  const sourceConnection =
    surface === 'instagram'
      ? sources?.instagramSource
      : sources?.facebookSource;

  if (!sourceConnection) {
    // Fallback: create minimal FB source row
    const fallback = await upsertPageSourceConnection({
      ownerUserId,
      provider: surface === 'instagram' ? META_IG_PROVIDER : META_FB_PROVIDER,
      externalAccountId: pageId || config.metaPageId || 'unknown-page',
      name: surface === 'instagram' ? 'Instagram' : 'Facebook Page',
      claimOwnership: false,
      config: { pageId, surface },
    });
    sources = {
      facebookSource: fallback,
      instagramSource: fallback,
      connector: null as any,
      facebookChannel: null as any,
      instagramChannel: null as any,
      pageId: pageId || '',
      pageName: null,
      igAccountId: null,
    };
  }

  const activeSource =
    (surface === 'instagram' ? sources?.instagramSource : sources?.facebookSource) ||
    sources!.facebookSource;

  const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const [rawRecord] = await db
    .insert(acquisitionRawRecords)
    .values({
      ownerUserId: activeSource.ownerUserId,
      sourceConnectionId: activeSource.id,
      externalEventId: payload.entry?.[0]?.id,
      eventName: objectType,
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
    for (const entry of payload.entry || []) {
      for (const messaging of entry.messaging || []) {
        const message = messaging.message;
        if (!message || message.is_echo) continue;
        const senderId = messaging.sender?.id;
        if (!senderId) continue;
        // Skip page-as-sender echoes
        if (pageId && senderId === pageId) continue;

        const mid = message.mid || `${senderId}-${messaging.timestamp || Date.now()}`;
        const textBody = message.text || messaging.postback?.title || '';
        const occurredAt = messaging.timestamp
          ? new Date(messaging.timestamp)
          : new Date();

        const person = await resolveOrCreatePersonByMetaMessaging({
          ownerUserId: activeSource.ownerUserId,
          externalId: senderId,
          surface,
        });
        if (!person) continue;

        const [event] = await db
          .insert(acquisitionEvents)
          .values({
            ownerUserId: activeSource.ownerUserId,
            sourceConnectionId: activeSource.id,
            rawRecordId: rawRecord.id,
            source: surface === 'instagram' ? META_IG_PROVIDER : META_FB_PROVIDER,
            externalEventId: mid,
            eventType: 'message.received',
            occurredAt,
            personId: person.id,
            channel: surface,
            objectType: 'message',
            objectId: mid,
            attributes: {
              messageType: message.text ? 'text' : 'message',
              text: textBody,
              from: senderId,
              surface,
            },
            schemaVersion: 1,
          })
          .returning();

        createdEvents.push({ id: event.id, eventType: event.eventType });

        const [interaction] = await db
          .insert(acquisitionInteractions)
          .values({
            ownerUserId: activeSource.ownerUserId,
            personId: person.id,
            sourceEventId: event.id,
            kind: 'message',
            direction: 'inbound',
            summary: textBody
              ? `${surface === 'instagram' ? 'Instagram' : 'Facebook'}: ${textBody.slice(0, 180)}`
              : `${surface === 'instagram' ? 'Instagram' : 'Facebook'} message received`,
            occurredAt,
          })
          .returning();

        createdInteractions.push({ id: interaction.id, personId: person.id });
        await refreshPersonMaturity(person.id, 'engaged');
      }

      // Lead Ads (Marketing API) — field: leadgen on Page webhook
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen' || !change.value?.leadgen_id) continue;

        const leadgenId = change.value.leadgen_id;
        const { fetchMetaLeadById } = await import('./meta-graph-service.js');
        const leadResult = await fetchMetaLeadById(leadgenId);
        if (!leadResult.ok) {
          logger.warn('Lead Ads fetch failed', { leadgenId, error: leadResult.error });
          continue;
        }
        const lead = leadResult.lead;

        let leadSource = (
          await db
            .select()
            .from(acquisitionSourceConnections)
            .where(
              and(
                eq(acquisitionSourceConnections.ownerUserId, activeSource.ownerUserId),
                eq(acquisitionSourceConnections.provider, META_LEAD_PROVIDER),
              ),
            )
            .limit(1)
        )[0];

        if (!leadSource) {
          leadSource = await upsertPageSourceConnection({
            ownerUserId: activeSource.ownerUserId,
            provider: META_LEAD_PROVIDER,
            externalAccountId: pageId || change.value.page_id || leadgenId,
            name: 'Meta Lead Ads',
            claimOwnership: false,
            config: { pageId, surface: 'lead_ads' },
          });
        }

        const identityKey =
          lead.email ||
          lead.phone ||
          `lead:${lead.id}`;
        const person = await resolveOrCreatePersonFromLead({
          ownerUserId: activeSource.ownerUserId,
          identityKey,
          email: lead.email,
          phone: lead.phone,
          displayName: lead.fullName,
        });
        if (!person) continue;

        const occurredAt = lead.createdTime
          ? new Date(lead.createdTime)
          : typeof change.value.created_time === 'number'
            ? new Date(change.value.created_time * 1000)
            : new Date();

        const [event] = await db
          .insert(acquisitionEvents)
          .values({
            ownerUserId: activeSource.ownerUserId,
            sourceConnectionId: leadSource.id,
            rawRecordId: rawRecord.id,
            source: META_LEAD_PROVIDER,
            externalEventId: lead.id,
            eventType: 'lead.submitted',
            occurredAt,
            personId: person.id,
            channel: 'meta_ads',
            objectType: 'lead',
            objectId: lead.id,
            attributes: {
              formId: lead.formId || change.value.form_id || null,
              adId: lead.adId || change.value.ad_id || null,
              adsetId: lead.adsetId || change.value.adgroup_id || null,
              campaignId: lead.campaignId || null,
              fieldData: lead.fieldData,
              email: lead.email,
              phone: lead.phone,
            },
            schemaVersion: 1,
          })
          .returning();

        createdEvents.push({ id: event.id, eventType: event.eventType });

        const [interaction] = await db
          .insert(acquisitionInteractions)
          .values({
            ownerUserId: activeSource.ownerUserId,
            personId: person.id,
            sourceEventId: event.id,
            kind: 'submission',
            direction: 'inbound',
            summary: `Lead Ads: ${lead.fullName || lead.email || lead.phone || lead.id}`,
            occurredAt,
          })
          .returning();

        createdInteractions.push({ id: interaction.id, personId: person.id });
        await refreshPersonMaturity(person.id, 'engaged');

        try {
          const { sendMetaCapiLeadEvent } = await import('./meta-graph-service.js');
          const capi = await sendMetaCapiLeadEvent({
            leadId: lead.id,
            email: lead.email,
            phone: lead.phone,
            eventTime: occurredAt,
            formId: lead.formId || change.value.form_id || null,
          });
          if (capi.ok) {
            await db
              .update(acquisitionSourceConnections)
              .set({
                config: {
                  ...((leadSource.config as Record<string, unknown>) || {}),
                  lastCapi: {
                    ok: true,
                    eventsReceived: capi.eventsReceived,
                    at: new Date().toISOString(),
                    leadId: lead.id,
                  },
                },
                updatedAt: new Date(),
              })
              .where(eq(acquisitionSourceConnections.id, leadSource.id));
          } else if (!capi.skipped) {
            logger.warn('CAPI Lead event failed', {
              leadId: lead.id,
              error: capi.error,
            });
            await db
              .update(acquisitionSourceConnections)
              .set({
                config: {
                  ...((leadSource.config as Record<string, unknown>) || {}),
                  lastCapi: {
                    ok: false,
                    error: capi.error,
                    at: new Date().toISOString(),
                    leadId: lead.id,
                  },
                },
                updatedAt: new Date(),
              })
              .where(eq(acquisitionSourceConnections.id, leadSource.id));
          }
        } catch (capiError) {
          logger.warn('CAPI Lead event threw', {
            error: capiError instanceof Error ? capiError.message : String(capiError),
          });
        }

        await db
          .update(acquisitionSourceConnections)
          .set({
            lastSuccessAt: new Date(),
            lastErrorAt: null,
            lastErrorMessage: null,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(acquisitionSourceConnections.id, leadSource.id));
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
      .where(eq(acquisitionSourceConnections.id, activeSource.id));

    return {
      rawRecordId: rawRecord.id,
      ignored: false,
      events: createdEvents,
      interactions: createdInteractions,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown page ingest error';
    logger.error('Acquisition Meta Page ingest failed', {
      error: message,
      rawRecordId: rawRecord.id,
    });

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
      .where(eq(acquisitionSourceConnections.id, activeSource.id));

    throw error;
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

  const [whatsappEventCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(acquisitionEvents)
    .where(
      and(
        eq(acquisitionEvents.ownerUserId, ownerUserId),
        eq(acquisitionEvents.channel, 'whatsapp'),
      ),
    );

  const [pageEventCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(acquisitionEvents)
    .where(
      and(
        eq(acquisitionEvents.ownerUserId, ownerUserId),
        inArray(acquisitionEvents.channel, ['facebook', 'instagram']),
      ),
    );

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
    inboundEvents: whatsappEventCount?.count || 0,
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

  const fbSource = sources.find((s) => s.provider === META_FB_PROVIDER) || null;
  const igSource = sources.find((s) => s.provider === META_IG_PROVIDER) || null;
  const facebookChannel = channels.find((c) => c.kind === 'facebook_organic') || null;
  const instagramChannel = channels.find((c) => c.kind === 'instagram_organic') || null;
  const pageConnector = connectors.find((c) => c.provider === 'meta') || null;

  const { probeMetaPageConnection } = await import('./meta-graph-service.js');
  const pageProbe = await probeMetaPageConnection({
    pageId:
      fbSource?.externalAccountId ||
      pageConnector?.externalAccountId ||
      config.metaPageId ||
      undefined,
  });

  if (pageConnector) {
    try {
      await db
        .update(platformConnectors)
        .set({
          status: pageProbe.ok ? 'connected' : 'error',
          lastValidatedAt: pageProbe.ok
            ? new Date()
            : pageConnector.lastValidatedAt
              ? new Date(pageConnector.lastValidatedAt)
              : null,
          lastErrorAt: pageProbe.ok ? null : new Date(),
          lastErrorMessage: pageProbe.ok ? null : pageProbe.error,
          updatedAt: new Date(),
        })
        .where(eq(platformConnectors.id, pageConnector.id));
    } catch {
      // non-fatal
    }
    connectors = connectors.map((c) =>
      c.id === pageConnector.id
        ? {
            ...c,
            status: (pageProbe.ok ? 'connected' : 'error') as typeof c.status,
            lastErrorMessage: pageProbe.ok ? null : pageProbe.error,
          }
        : c,
    );
  }

  const pageHealth = {
    boundToUser: Boolean(fbSource || igSource || facebookChannel || instagramChannel),
    facebookSourceStatus: fbSource?.status || null,
    instagramSourceStatus: igSource?.status || null,
    connectorStatus: pageProbe.ok ? 'connected' : pageConnector ? 'error' : null,
    tokenConfigured: pageProbe.tokenConfigured,
    pageIdConfigured: pageProbe.pageIdConfigured,
    verifyTokenConfigured: pageProbe.verifyTokenConfigured,
    pageId: pageProbe.pageId,
    pageName: pageProbe.pageName,
    igAccountId: pageProbe.igAccountId,
    igUsername: pageProbe.igUsername,
    graphOk: pageProbe.ok,
    graphError: pageProbe.error,
    webhookPath: '/api/meta/page/webhook',
    lastWebhookSuccessAt:
      fbSource?.lastSuccessAt || igSource?.lastSuccessAt || null,
    lastWebhookErrorAt: fbSource?.lastErrorAt || igSource?.lastErrorAt || null,
    lastWebhookError: fbSource?.lastErrorMessage || igSource?.lastErrorMessage || null,
    inboundEvents: pageEventCount?.count || 0,
    people: peopleCount?.count || 0,
  };

  const leadSource = sources.find((s) => s.provider === META_LEAD_PROVIDER) || null;
  const adsSource = sources.find((s) => s.provider === META_ADS_PROVIDER) || null;
  const adsChannel = channels.find((c) => c.kind === 'meta_ads') || null;

  const {
    probeMetaAdAccount,
    normalizeAdAccountId,
  } = await import('./meta-graph-service.js');
  const adProbe = await probeMetaAdAccount({
    adAccountId:
      adsSource?.externalAccountId ||
      config.metaAdAccountId ||
      undefined,
  });

  const [leadEventCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(acquisitionEvents)
    .where(
      and(
        eq(acquisitionEvents.ownerUserId, ownerUserId),
        eq(acquisitionEvents.source, META_LEAD_PROVIDER),
      ),
    );

  const lastInsights =
    adsSource?.config &&
    typeof adsSource.config === 'object' &&
    (adsSource.config as { lastInsights?: unknown }).lastInsights
      ? (adsSource.config as { lastInsights: Record<string, unknown> }).lastInsights
      : null;

  const lastCapi =
    leadSource?.config &&
    typeof leadSource.config === 'object' &&
    (leadSource.config as { lastCapi?: unknown }).lastCapi
      ? (leadSource.config as { lastCapi: Record<string, unknown> }).lastCapi
      : null;

  const pixelConfigured = Boolean(config.metaPixelId);
  const defaultAdsetConfigured = Boolean(config.metaDefaultAdsetId);
  const websiteConfigured = Boolean(config.metaWebsiteUrl);

  const marketingHealth = {
    boundToUser: Boolean(leadSource || adsSource || adsChannel),
    leadSourceStatus: leadSource?.status || null,
    adsSourceStatus: adsSource?.status || null,
    tokenConfigured: adProbe.tokenConfigured,
    adAccountConfigured: adProbe.adAccountConfigured,
    pageIdConfigured: Boolean(config.metaPageId || pageProbe.pageId),
    pixelConfigured,
    defaultAdsetConfigured,
    websiteConfigured,
    adAccountId: adProbe.adAccountId || normalizeAdAccountId(config.metaAdAccountId) || null,
    adAccountName: adProbe.accountName,
    currency: adProbe.currency,
    graphOk: adProbe.ok,
    graphError: adProbe.error,
    webhookPath: '/api/meta/page/webhook',
    webhookField: 'leadgen',
    lastLeadSuccessAt: leadSource?.lastSuccessAt || null,
    lastLeadError: leadSource?.lastErrorMessage || null,
    leadsIngested: leadEventCount?.count || 0,
    lastInsights,
    lastCapi,
    developerSetup: [
      {
        id: 'app',
        label: 'Meta App + products',
        detail: 'WhatsApp, Messenger, Instagram, Marketing API, Webhooks',
        done: adProbe.tokenConfigured,
      },
      {
        id: 'token',
        label: 'Long-lived System User token',
        detail: 'ads_management, ads_read, leads_retrieval, pages_*, whatsapp',
        done: adProbe.tokenConfigured && adProbe.ok,
      },
      {
        id: 'webhooks',
        label: 'Webhooks subscribed',
        detail: 'messages + leadgen on Page; messages on WhatsApp',
        done:
          (pageEventCount?.count || 0) > 0 ||
          (whatsappEventCount?.count || 0) > 0 ||
          (leadEventCount?.count || 0) > 0,
      },
      {
        id: 'ad_account',
        label: 'Ad account linked',
        detail: 'META_AD_ACCOUNT_ID on Railway',
        done: adProbe.adAccountConfigured && adProbe.ok,
      },
      {
        id: 'adset',
        label: 'Default ad set (optional)',
        detail: 'META_DEFAULT_ADSET_ID to create PAUSED ads from Assets',
        done: defaultAdsetConfigured,
      },
      {
        id: 'pixel',
        label: 'Pixel / CAPI dataset',
        detail: 'META_PIXEL_ID for Lead conversion events',
        done: pixelConfigured,
      },
    ],
    lifecycle: [
      { id: 'create', label: 'Create creatives', status: 'ready' as const },
      {
        id: 'reach',
        label: 'Reach via Meta Ads',
        status: adProbe.ok
          ? defaultAdsetConfigured
            ? ('live' as const)
            : ('partial' as const)
          : ('setup' as const),
      },
      {
        id: 'engage',
        label: 'Engage DMs',
        status:
          (pageEventCount?.count || 0) > 0 || (whatsappEventCount?.count || 0) > 0
            ? ('live' as const)
            : ('setup' as const),
      },
      {
        id: 'capture',
        label: 'Capture Lead Ads',
        status: (leadEventCount?.count || 0) > 0 ? ('live' as const) : ('setup' as const),
      },
      {
        id: 'convert',
        label: 'CAPI Lead events',
        status: lastCapi && lastCapi.ok === true
          ? ('live' as const)
          : pixelConfigured
            ? ('partial' as const)
            : ('setup' as const),
      },
      { id: 'nurture', label: 'Nurture on WhatsApp/IG', status: 'partial' as const },
      {
        id: 'measure',
        label: 'Measure insights',
        status: lastInsights ? ('live' as const) : ('setup' as const),
      },
    ],
  };

  return {
    people: peopleCount?.count || 0,
    events: eventCount?.count || 0,
    interactions: interactionCount?.count || 0,
    sources,
    channels,
    connectors,
    metaHealth,
    pageHealth,
    marketingHealth,
  };
}

/** Pull Marketing API insights and persist on the meta_ads source. */
export async function syncMetaMarketingInsights(options: {
  ownerUserId: string;
  datePreset?: string;
}) {
  const bound = await ensureMetaMarketingSources({
    ownerUserId: options.ownerUserId,
    claimOwnership: true,
  });

  const { fetchMetaAdAccountInsights } = await import('./meta-graph-service.js');
  const result = await fetchMetaAdAccountInsights({
    adAccountId: bound.adProbe.adAccountId || undefined,
    datePreset: options.datePreset || 'last_7d',
  });

  if (!result.ok) {
    await db
      .update(acquisitionSourceConnections)
      .set({
        lastErrorAt: new Date(),
        lastErrorMessage: result.error,
        status: 'error',
        updatedAt: new Date(),
      })
      .where(eq(acquisitionSourceConnections.id, bound.adsSource.id));
    return { ok: false as const, error: result.error };
  }

  const [updated] = await db
    .update(acquisitionSourceConnections)
    .set({
      status: 'active',
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      config: {
        ...((bound.adsSource.config as Record<string, unknown>) || {}),
        adAccountId: bound.adProbe.adAccountId,
        accountName: result.accountName,
        lastInsights: result.insights,
      },
      updatedAt: new Date(),
    })
    .where(eq(acquisitionSourceConnections.id, bound.adsSource.id))
    .returning();

  return {
    ok: true as const,
    insights: result.insights,
    accountName: result.accountName,
    source: updated,
  };
}
