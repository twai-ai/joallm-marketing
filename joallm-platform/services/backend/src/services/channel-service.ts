/**
 * Marketing Studio — Channel service (business destinations).
 * Channels bind to Platform Connectors; Studio never talks to vendor APIs directly.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { publishingProfiles, studioChannels } from '../database/schema.js';
import { ensureMetaWhatsAppConnector, mapConnector } from './connector-service.js';
import type { ConnectorProvider } from './connector-registry.js';

type ChannelKind =
  | 'meta_ads'
  | 'facebook_organic'
  | 'instagram_organic'
  | 'linkedin_organic'
  | 'linkedin_ads'
  | 'youtube'
  | 'whatsapp'
  | 'email'
  | 'website'
  | 'x_organic'
  | 'other';

type ChannelStatus = 'active' | 'paused' | 'archived';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapChannel(row: typeof studioChannels.$inferSelect) {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId ?? null,
    kind: row.kind as ChannelKind,
    name: row.name,
    status: row.status as ChannelStatus,
    connectorId: row.connectorId ?? null,
    connectorProvider: (row.connectorProvider as ConnectorProvider | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: toIso(row.createdAt) || new Date(0).toISOString(),
    updatedAt: toIso(row.updatedAt) || new Date(0).toISOString(),
  };
}

export async function listStudioChannels(ownerUserId: string) {
  const rows = await db
    .select()
    .from(studioChannels)
    .where(eq(studioChannels.ownerUserId, ownerUserId))
    .orderBy(desc(studioChannels.updatedAt));
  return rows.map(mapChannel);
}

export async function ensureWhatsAppChannel(options: {
  ownerUserId: string;
  connectorId: string;
  connectorProvider?: ConnectorProvider;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
}) {
  const {
    ownerUserId,
    connectorId,
    connectorProvider = 'meta_whatsapp',
    phoneNumberId,
    displayPhoneNumber,
  } = options;

  const [existing] = await db
    .select()
    .from(studioChannels)
    .where(
      and(
        eq(studioChannels.ownerUserId, ownerUserId),
        eq(studioChannels.kind, 'whatsapp'),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(studioChannels)
      .set({
        status: 'active',
        connectorId,
        connectorProvider,
        name: displayPhoneNumber ? `WhatsApp (${displayPhoneNumber})` : existing.name || 'WhatsApp',
        metadata: {
          ...((existing.metadata as Record<string, unknown>) || {}),
          phoneNumberId: phoneNumberId || null,
          displayPhoneNumber: displayPhoneNumber || null,
        },
        updatedAt: new Date(),
      })
      .where(eq(studioChannels.id, existing.id))
      .returning();
    return mapChannel(updated);
  }

  const [created] = await db
    .insert(studioChannels)
    .values({
      ownerUserId,
      kind: 'whatsapp',
      name: displayPhoneNumber ? `WhatsApp (${displayPhoneNumber})` : 'WhatsApp',
      status: 'active',
      connectorId,
      connectorProvider,
      metadata: {
        phoneNumberId: phoneNumberId || null,
        displayPhoneNumber: displayPhoneNumber || null,
      },
    })
    .returning();

  return mapChannel(created);
}

/**
 * Full Studio-1 stack for Meta WhatsApp:
 * Platform Connector → Studio Channel → (caller links acquisition source)
 */
export async function ensureMetaWhatsAppChannelStack(options: {
  ownerUserId: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
}) {
  const connector = await ensureMetaWhatsAppConnector(options);
  const channel = await ensureWhatsAppChannel({
    ownerUserId: options.ownerUserId,
    connectorId: connector.id,
    connectorProvider: 'meta_whatsapp',
    phoneNumberId: options.phoneNumberId || (connector.externalAccountId ?? undefined),
    displayPhoneNumber: options.displayPhoneNumber,
  });
  return { connector, channel };
}

export async function listPublishingProfiles(ownerUserId: string) {
  const rows = await db
    .select()
    .from(publishingProfiles)
    .where(eq(publishingProfiles.ownerUserId, ownerUserId))
    .orderBy(desc(publishingProfiles.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId ?? null,
    name: row.name,
    status: row.status,
    channelId: row.channelId,
    brandKitId: row.brandKitId ?? null,
    defaultHashtags: row.defaultHashtags || [],
    defaultUtm: (row.defaultUtm as Record<string, string>) || {},
    timezone: row.timezone ?? null,
    defaults: (row.defaults as Record<string, unknown>) || {},
    createdAt: toIso(row.createdAt) || new Date(0).toISOString(),
    updatedAt: toIso(row.updatedAt) || new Date(0).toISOString(),
  }));
}

export async function ensureDefaultWhatsAppPublishingProfile(options: {
  ownerUserId: string;
  channelId: string;
}) {
  const { ownerUserId, channelId } = options;
  const [existing] = await db
    .select()
    .from(publishingProfiles)
    .where(
      and(
        eq(publishingProfiles.ownerUserId, ownerUserId),
        eq(publishingProfiles.channelId, channelId),
      ),
    )
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      ownerUserId: existing.ownerUserId,
      organizationId: existing.organizationId ?? null,
      name: existing.name,
      status: existing.status,
      channelId: existing.channelId,
      brandKitId: existing.brandKitId ?? null,
      defaultHashtags: existing.defaultHashtags || [],
      defaultUtm: (existing.defaultUtm as Record<string, string>) || {},
      timezone: existing.timezone ?? null,
      defaults: (existing.defaults as Record<string, unknown>) || {},
      createdAt: toIso(existing.createdAt) || new Date(0).toISOString(),
      updatedAt: toIso(existing.updatedAt) || new Date(0).toISOString(),
    };
  }

  const [created] = await db
    .insert(publishingProfiles)
    .values({
      ownerUserId,
      name: 'ATRISI WhatsApp',
      status: 'active',
      channelId,
      defaultUtm: { utm_source: 'whatsapp', utm_medium: 'acquisition' },
      timezone: 'Asia/Kolkata',
      defaults: {},
    })
    .returning();

  return {
    id: created.id,
    ownerUserId: created.ownerUserId,
    organizationId: created.organizationId ?? null,
    name: created.name,
    status: created.status,
    channelId: created.channelId,
    brandKitId: created.brandKitId ?? null,
    defaultHashtags: created.defaultHashtags || [],
    defaultUtm: (created.defaultUtm as Record<string, string>) || {},
    timezone: created.timezone ?? null,
    defaults: (created.defaults as Record<string, unknown>) || {},
    createdAt: toIso(created.createdAt) || new Date(0).toISOString(),
    updatedAt: toIso(created.updatedAt) || new Date(0).toISOString(),
  };
}

const CHANNEL_KIND_LABELS: Record<ChannelKind, string> = {
  meta_ads: 'Meta Ads',
  facebook_organic: 'Facebook Organic',
  instagram_organic: 'Instagram Organic',
  linkedin_organic: 'LinkedIn Organic',
  linkedin_ads: 'LinkedIn Ads',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  email: 'Email',
  website: 'Website',
  x_organic: 'X Organic',
  other: 'Other',
};

/** Ensure a Studio Channel exists for a kind (no connector required — Sprint 4 jobs). */
export async function ensureStudioChannelByKind(options: {
  ownerUserId: string;
  kind: ChannelKind;
  name?: string;
}) {
  const { ownerUserId, kind } = options;
  const [existing] = await db
    .select()
    .from(studioChannels)
    .where(
      and(
        eq(studioChannels.ownerUserId, ownerUserId),
        eq(studioChannels.kind, kind),
      ),
    )
    .limit(1);

  if (existing) {
    return mapChannel(existing);
  }

  const [created] = await db
    .insert(studioChannels)
    .values({
      ownerUserId,
      kind,
      name: options.name || CHANNEL_KIND_LABELS[kind] || kind,
      status: 'active',
      metadata: { provisional: true },
    })
    .returning();

  return mapChannel(created);
}

export type { ChannelKind };

/** Re-export for tests */
export { mapConnector };
