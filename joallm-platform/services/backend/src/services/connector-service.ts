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
import {
  buildOrgDualReadScope,
  orgMetaConnectorConfig,
  resolveOrganizationIdForUser,
} from './organization-ownership.js';

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

export async function listPlatformConnectors(
  ownerUserId: string,
  organizationId?: string | null,
) {
  const orgId =
    organizationId === undefined
      ? await resolveOrganizationIdForUser(ownerUserId)
      : organizationId;
  const scope = buildOrgDualReadScope({
    organizationId: orgId,
    ownerUserId,
    organizationColumn: platformConnectors.organizationId,
    ownerColumn: platformConnectors.ownerUserId,
  });
  const rows = await db
    .select()
    .from(platformConnectors)
    .where(scope)
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
  organizationId?: string | null;
}) {
  const { ownerUserId, phoneNumberId, displayPhoneNumber } = options;
  const organizationId =
    options.organizationId ?? (await resolveOrganizationIdForUser(ownerUserId));
  const registry = getRegistryEntry('meta_whatsapp');
  const capabilities = defaultCapabilitiesFor('meta_whatsapp');
  const externalAccountId = phoneNumberId || config.metaPhoneNumberId || null;

  const { probeMetaWhatsAppConnection } = await import('./whatsapp-send-service.js');
  const probe = await probeMetaWhatsAppConnection({
    phoneNumberId: externalAccountId || undefined,
  });
  const liveStatus = probe.ok
    ? 'connected'
    : externalAccountId || probe.tokenConfigured
      ? 'error'
      : 'connecting';
  const sharedConfig = orgMetaConnectorConfig(null, {
    boundByUserId: ownerUserId,
    extra: {
      displayPhoneNumber: displayPhoneNumber || probe.displayPhoneNumber || null,
      phoneNumberId: externalAccountId,
      verifiedName: probe.verifiedName,
      qualityRating: probe.qualityRating,
      verifyTokenConfigured: probe.verifyTokenConfigured,
      lastProbeAt: new Date().toISOString(),
    },
  });

  if (externalAccountId) {
    const orgMatch = organizationId
      ? await db
          .select()
          .from(platformConnectors)
          .where(
            and(
              eq(platformConnectors.organizationId, organizationId),
              eq(platformConnectors.provider, 'meta_whatsapp'),
              eq(platformConnectors.externalAccountId, externalAccountId),
            ),
          )
          .limit(1)
      : [];
    const [byAccount] =
      orgMatch[0]
        ? orgMatch
        : await db
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
          organizationId: organizationId || byAccount.organizationId,
          status: liveStatus,
          name: registry?.displayName || byAccount.name,
          apiVersion: 'v20.0',
          capabilities,
          config: orgMetaConnectorConfig(
            byAccount.config as Record<string, unknown>,
            { boundByUserId: ownerUserId, extra: sharedConfig },
          ),
          lastValidatedAt: probe.ok ? new Date() : byAccount.lastValidatedAt,
          lastErrorAt: probe.ok ? null : new Date(),
          lastErrorMessage: probe.ok ? null : probe.error,
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
        organizationId: organizationId || existing.organizationId,
        status: liveStatus,
        externalAccountId: externalAccountId || existing.externalAccountId,
        name: registry?.displayName || existing.name,
        apiVersion: 'v20.0',
        capabilities,
        config: orgMetaConnectorConfig(
          existing.config as Record<string, unknown>,
          { boundByUserId: ownerUserId, extra: sharedConfig },
        ),
        lastValidatedAt: probe.ok ? new Date() : existing.lastValidatedAt,
        lastErrorAt: probe.ok ? null : new Date(),
        lastErrorMessage: probe.ok ? null : probe.error,
        updatedAt: new Date(),
      })
      .where(eq(platformConnectors.id, existing.id))
      .returning();
    return mapConnector(updated);
  }

  const [created] = await db
    .insert(platformConnectors)
    .values({
      ownerUserId,
      organizationId: organizationId || null,
      provider: 'meta_whatsapp',
      name: registry?.displayName || 'Meta WhatsApp Cloud API',
      apiVersion: 'v20.0',
      status: liveStatus,
      capabilities,
      externalAccountId,
      config: sharedConfig,
      lastValidatedAt: probe.ok ? new Date() : null,
      lastErrorAt: probe.ok ? null : new Date(),
      lastErrorMessage: probe.ok ? null : probe.error,
    })
    .returning();

  return mapConnector(created);
}

/**
 * Ensure Meta Marketing / Pages connector for Facebook + Instagram messaging.
 */
export async function ensureMetaPageConnector(options: {
  ownerUserId: string;
  pageId?: string;
  organizationId?: string | null;
}) {
  const { ownerUserId } = options;
  const organizationId =
    options.organizationId ?? (await resolveOrganizationIdForUser(ownerUserId));
  const registry = getRegistryEntry('meta');
  const capabilities = defaultCapabilitiesFor('meta');
  const externalAccountId = options.pageId || config.metaPageId || null;

  const { probeMetaPageConnection } = await import('./meta-graph-service.js');
  const probe = await probeMetaPageConnection({
    pageId: externalAccountId || undefined,
  });
  const liveStatus = probe.ok
    ? 'connected'
    : externalAccountId || probe.tokenConfigured
      ? 'error'
      : 'connecting';
  const sharedConfig = orgMetaConnectorConfig(null, {
    boundByUserId: ownerUserId,
    extra: {
      pageId: probe.pageId || externalAccountId,
      pageName: probe.pageName,
      igAccountId: probe.igAccountId,
      igUsername: probe.igUsername,
      verifyTokenConfigured: probe.verifyTokenConfigured,
      lastProbeAt: new Date().toISOString(),
    },
  });

  if (externalAccountId) {
    const orgMatch = organizationId
      ? await db
          .select()
          .from(platformConnectors)
          .where(
            and(
              eq(platformConnectors.organizationId, organizationId),
              eq(platformConnectors.provider, 'meta'),
              eq(platformConnectors.externalAccountId, externalAccountId),
            ),
          )
          .limit(1)
      : [];
    const [byAccount] =
      orgMatch[0]
        ? orgMatch
        : await db
            .select()
            .from(platformConnectors)
            .where(
              and(
                eq(platformConnectors.ownerUserId, ownerUserId),
                eq(platformConnectors.provider, 'meta'),
                eq(platformConnectors.externalAccountId, externalAccountId),
              ),
            )
            .limit(1);
    if (byAccount) {
      const [updated] = await db
        .update(platformConnectors)
        .set({
          organizationId: organizationId || byAccount.organizationId,
          status: liveStatus,
          name: probe.pageName
            ? `Meta Page (${probe.pageName})`
            : registry?.displayName || byAccount.name,
          apiVersion: 'v20.0',
          capabilities,
          config: orgMetaConnectorConfig(
            byAccount.config as Record<string, unknown>,
            { boundByUserId: ownerUserId, extra: sharedConfig },
          ),
          lastValidatedAt: probe.ok ? new Date() : byAccount.lastValidatedAt,
          lastErrorAt: probe.ok ? null : new Date(),
          lastErrorMessage: probe.ok ? null : probe.error,
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
        eq(platformConnectors.provider, 'meta'),
        or(isNull(platformConnectors.externalAccountId), eq(platformConnectors.externalAccountId, '')),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(platformConnectors)
      .set({
        organizationId: organizationId || existing.organizationId,
        status: liveStatus,
        externalAccountId: externalAccountId || existing.externalAccountId,
        name: probe.pageName
          ? `Meta Page (${probe.pageName})`
          : registry?.displayName || existing.name,
        apiVersion: 'v20.0',
        capabilities,
        config: orgMetaConnectorConfig(
          existing.config as Record<string, unknown>,
          { boundByUserId: ownerUserId, extra: sharedConfig },
        ),
        lastValidatedAt: probe.ok ? new Date() : existing.lastValidatedAt,
        lastErrorAt: probe.ok ? null : new Date(),
        lastErrorMessage: probe.ok ? null : probe.error,
        updatedAt: new Date(),
      })
      .where(eq(platformConnectors.id, existing.id))
      .returning();
    return mapConnector(updated);
  }

  const [created] = await db
    .insert(platformConnectors)
    .values({
      ownerUserId,
      organizationId: organizationId || null,
      provider: 'meta',
      name: probe.pageName
        ? `Meta Page (${probe.pageName})`
        : registry?.displayName || 'Meta Marketing API',
      apiVersion: 'v20.0',
      status: liveStatus,
      capabilities,
      externalAccountId,
      config: sharedConfig,
      lastValidatedAt: probe.ok ? new Date() : null,
      lastErrorAt: probe.ok ? null : new Date(),
      lastErrorMessage: probe.ok ? null : probe.error,
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
    const { probeMetaWhatsAppConnection } = await import('./whatsapp-send-service.js');
    const phoneNumberId =
      row.externalAccountId ||
      (row.config as { phoneNumberId?: string } | null)?.phoneNumberId ||
      config.metaPhoneNumberId;
    const probe = await probeMetaWhatsAppConnection({ phoneNumberId: phoneNumberId || undefined });
    const [updated] = await db
      .update(platformConnectors)
      .set({
        status: probe.ok ? 'connected' : 'error',
        lastValidatedAt: probe.ok ? new Date() : row.lastValidatedAt,
        lastErrorAt: probe.ok ? null : new Date(),
        lastErrorMessage: probe.ok ? null : probe.error,
        config: {
          ...((row.config as Record<string, unknown>) || {}),
          phoneNumberId: probe.phoneNumberId,
          displayPhoneNumber: probe.displayPhoneNumber,
          verifiedName: probe.verifiedName,
          qualityRating: probe.qualityRating,
          lastProbeAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(platformConnectors.id, row.id))
      .returning();
    return mapConnector(updated);
  }

  if (row.provider === 'meta') {
    const { probeMetaPageConnection } = await import('./meta-graph-service.js');
    const pageId =
      row.externalAccountId ||
      (row.config as { pageId?: string } | null)?.pageId ||
      config.metaPageId;
    const probe = await probeMetaPageConnection({ pageId: pageId || undefined });
    const [updated] = await db
      .update(platformConnectors)
      .set({
        status: probe.ok ? 'connected' : 'error',
        lastValidatedAt: probe.ok ? new Date() : row.lastValidatedAt,
        lastErrorAt: probe.ok ? null : new Date(),
        lastErrorMessage: probe.ok ? null : probe.error,
        config: {
          ...((row.config as Record<string, unknown>) || {}),
          pageId: probe.pageId,
          pageName: probe.pageName,
          igAccountId: probe.igAccountId,
          igUsername: probe.igUsername,
          lastProbeAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(platformConnectors.id, row.id))
      .returning();
    return mapConnector(updated);
  }

  return mapConnector(row);
}
