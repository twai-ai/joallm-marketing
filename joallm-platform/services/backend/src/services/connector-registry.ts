/**
 * Integration Platform — static connector registry (catalog).
 * Instances live in platform_connectors; this is the vendor capability catalog.
 */

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

export type ConnectorCapability =
  | 'connect'
  | 'validate'
  | 'publish'
  | 'schedule'
  | 'fetchEvents'
  | 'fetchMetrics'
  | 'disconnect';

export type ConnectorRegistryEntry = {
  provider: ConnectorProvider;
  displayName: string;
  defaultCapabilities: ConnectorCapability[];
  setupNotes?: string;
};

export const CONNECTOR_REGISTRY: ConnectorRegistryEntry[] = [
  {
    provider: 'meta_whatsapp',
    displayName: 'Meta WhatsApp Cloud API',
    defaultCapabilities: ['connect', 'validate', 'publish', 'fetchEvents', 'disconnect'],
    setupNotes: 'Webhook verify token + phone_number_id. Secrets via META_ACCESS_TOKEN / META_VERIFY_TOKEN.',
  },
  {
    provider: 'meta',
    displayName: 'Meta Marketing API',
    defaultCapabilities: ['connect', 'validate', 'publish', 'schedule', 'fetchEvents', 'fetchMetrics', 'disconnect'],
    setupNotes: 'Ads / Pages — bind later to Meta Ads Channel.',
  },
  {
    provider: 'linkedin',
    displayName: 'LinkedIn UGC / Marketing APIs',
    defaultCapabilities: ['connect', 'validate', 'publish', 'schedule', 'fetchEvents', 'fetchMetrics', 'disconnect'],
    setupNotes: 'Organic vs Ads are separate Studio Channels sharing this provider family.',
  },
  {
    provider: 'mailchimp',
    displayName: 'Mailchimp Marketing API',
    defaultCapabilities: ['connect', 'validate', 'publish', 'schedule', 'fetchEvents', 'fetchMetrics', 'disconnect'],
  },
  {
    provider: 'brevo',
    displayName: 'Brevo API',
    defaultCapabilities: ['connect', 'validate', 'publish', 'fetchEvents', 'disconnect'],
  },
  {
    provider: 'youtube',
    displayName: 'YouTube Data API',
    defaultCapabilities: ['connect', 'validate', 'publish', 'fetchMetrics', 'disconnect'],
  },
  {
    provider: 'hubspot',
    displayName: 'HubSpot CRM API',
    defaultCapabilities: ['connect', 'validate', 'fetchEvents', 'fetchMetrics', 'disconnect'],
  },
  {
    provider: 'x',
    displayName: 'X (Twitter) API',
    defaultCapabilities: ['connect', 'validate', 'publish', 'fetchEvents', 'disconnect'],
  },
  {
    provider: 'google',
    displayName: 'Google Workspace APIs',
    defaultCapabilities: ['connect', 'validate', 'fetchEvents', 'disconnect'],
  },
];

export function getRegistryEntry(provider: ConnectorProvider): ConnectorRegistryEntry | undefined {
  return CONNECTOR_REGISTRY.find((entry) => entry.provider === provider);
}

export function defaultCapabilitiesFor(provider: ConnectorProvider): ConnectorCapability[] {
  return getRegistryEntry(provider)?.defaultCapabilities ?? ['connect', 'validate', 'disconnect'];
}
