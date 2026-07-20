/**
 * Integration Platform — Connector instance service.
 * Technical bindings only. Studio binds Channels to these.
 */

import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { platformConnectors } from '../database/schema.js';
import { config } from '../config/config.js';
import {
  CONNECTOR_REGISTRY,
  defaultCapabilitiesFor,
  getRegistryEntry,
  type ConnectorProvider,
} from './connector-registry.js';

type ConnectorStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'revoked';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapConnector(row: typeof platformConnectors.$inferSelect) {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId ?? null,
    provider: row.provider as ConnectorProvider,
    name: row.name,
    apiVersion: row.apiVersion ?? null,
    status: row.status as ConnectorStatus,
    capabilities: (row.capabilities as string[]) || [],
    config: (row.config as Record<string, unknown>) || {},
    externalAccountId: row.externalAccountId ?? null,
    lastValidatedAt: toIso(row.lastValidatedAt),
    lastErrorAt: toIso(row.lastErrorAt),
    lastErrorMessage: row.lastErrorMessage ?? null,
    createdAt: toIso(row.createdAt) || new Date(0).toISOString(),
    updatedAt: toIso(row.updatedAt) || new Date(0).toISOString(),
  };
}

export function listConnectorRegistry() {
  return CONNECTOR_REGISTRY;
}

export async function listPlatformConnectors(ownerUserId: string) {
  const rows = await db
    .select()
    .from(platformConnectors)
    .where(eq(platformConnectors.ownerUserId, ownerUserId))
    .orderBy(desc(platformConnectors.updatedAt));
  return rows.map(mapConnector);
}

/**
 * Ensure Meta WhatsApp Cloud API connector for this owner.
 * Secrets stay in env / secret store — only non-secret config is persisted.
 */
export async function ensureMetaWhatsAppConnector(options: {
  ownerUserId: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
}) {
  const { ownerUserId, phoneNumberId, displayPhoneNumber } = options;
  const registry = getRegistryEntry('meta_whatsapp');
  const capabilities = defaultCapabilitiesFor('meta_whatsapp');
  const externalAccountId = phoneNumberId || config.metaPhoneNumberId || null;

  if (externalAccountId) {
    const [byAccount] = await db
      .select()
      .from(platformConnectors)
      .where(
        and(
          eq(platformConnectors.ownerUserId, ownerUserId),
          eq(platformConnectors.provider, 'meta_whatsapp'),
          eq(platformConnectors.externalAccountId, externalAccountId),
        ),
      )
      .limit(1);
    if (byAccount) {
      const [updated] = await db
        .update(platformConnectors)
        .set({
          status: 'connected',
          name: registry?.displayName || byAccount.name,
          apiVersion: 'v20.0',
          capabilities,
          config: {
            ...((byAccount.config as Record<string, unknown>) || {}),
            displayPhoneNumber: displayPhoneNumber || null,
            phoneNumberId: externalAccountId,
          },
          lastValidatedAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(platformConnectors.id, byAccount.id))
        .returning();
      return mapConnector(updated);
    }
  }

  const [existing] = await db
    .select()
    .from(platformConnectors)
    .where(
      and(
        eq(platformConnectors.ownerUserId, ownerUserId),
        eq(platformConnectors.provider, 'meta_whatsapp'),
        or(isNull(platformConnectors.externalAccountId), eq(platformConnectors.externalAccountId, '')),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(platformConnectors)
      .set({
        status: 'connected',
        externalAccountId: externalAccountId || existing.externalAccountId,
        name: registry?.displayName || existing.name,
        apiVersion: 'v20.0',
        capabilities,
        config: {
          ...((existing.config as Record<string, unknown>) || {}),
          displayPhoneNumber: displayPhoneNumber || null,
          phoneNumberId: externalAccountId,
        },
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformConnectors.id, existing.id))
      .returning();
    return mapConnector(updated);
  }

  const hasToken = Boolean(config.metaAccessToken);
  const [created] = await db
    .insert(platformConnectors)
    .values({
      ownerUserId,
      provider: 'meta_whatsapp',
      name: registry?.displayName || 'Meta WhatsApp Cloud API',
      apiVersion: 'v20.0',
      status: externalAccountId || hasToken ? 'connected' : 'connecting',
      capabilities,
      externalAccountId,
      config: {
        displayPhoneNumber: displayPhoneNumber || null,
        phoneNumberId: externalAccountId,
        verifyTokenConfigured: Boolean(config.metaVerifyToken),
      },
      lastValidatedAt: new Date(),
    })
    .returning();

  return mapConnector(created);
}

export async function validateConnector(ownerUserId: string, connectorId: string) {
  const [row] = await db
    .select()
    .from(platformConnectors)
    .where(
      and(
        eq(platformConnectors.id, connectorId),
        eq(platformConnectors.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  if (!row) return null;

  if (row.provider === 'meta_whatsapp') {
    const ok = Boolean(config.metaVerifyToken);
    const [updated] = await db
      .update(platformConnectors)
      .set({
        status: ok ? 'connected' : 'error',
        lastValidatedAt: ok ? new Date() : row.lastValidatedAt,
        lastErrorAt: ok ? null : new Date(),
        lastErrorMessage: ok ? null : 'META_VERIFY_TOKEN not configured',
        updatedAt: new Date(),
      })
      .where(eq(platformConnectors.id, row.id))
      .returning();
    return mapConnector(updated);
  }

  return mapConnector(row);
}
