/**
 * Integration Platform — Platform-owned connector contracts.
 *
 * Studio owns publishing intent (Channels, Profiles, Jobs).
 * Platform owns execution capability (Connectors, OAuth, Secrets, Webhooks).
 *
 * @see ../../docs/04-architecture/PLATFORM_CONSTITUTION.md
 * @see ../../docs/04-architecture/MARKETING_STUDIO_DIRECTION.md
 */

/** Vendor / protocol family — technical, not a marketing Channel. */
export type ConnectorProvider =
  | 'meta'
  | 'meta_whatsapp'
  | 'linkedin'
  | 'youtube'
  | 'mailchimp'
  | 'brevo'
  | 'hubspot'
  | 'x'
  | 'google'
  | 'custom';

export type ConnectorStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'revoked';

/**
 * Capability surface every connector implements conceptually.
 * Studio never calls these directly — Channels / Publishing Jobs do via Platform.
 */
export type ConnectorCapability =
  | 'connect'
  | 'validate'
  | 'publish'
  | 'schedule'
  | 'fetchEvents'
  | 'fetchMetrics'
  | 'disconnect';

/**
 * Technical integration binding (e.g. "Meta Marketing API v23").
 * Channels bind to Connectors; API version churn stays here.
 */
export interface Connector {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  provider: ConnectorProvider;
  /** Human-readable technical name, e.g. "Meta Marketing API v23" */
  name: string;
  /** Optional vendor API / SDK version label */
  apiVersion?: string | null;
  status: ConnectorStatus;
  capabilities: ConnectorCapability[];
  /** Non-secret config (account ids, default page ids). Secrets live in Platform secret store. */
  config?: Record<string, unknown>;
  externalAccountId?: string | null;
  lastValidatedAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorRegistryEntry {
  provider: ConnectorProvider;
  displayName: string;
  defaultCapabilities: ConnectorCapability[];
  /** Docs / setup hints for Integration Platform admins — not Studio marketers */
  setupNotes?: string;
}
