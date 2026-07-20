/**
 * ATRISI Marketing product ontology — user-facing vocabulary.
 * Constitutional: Studio creates. Products operate. Platform remembers.
 *
 * Prefer these terms in UI copy. Do not invent synonyms (e.g. "workflow family"
 * for Studio workspace, "CRM" for Acquisition Intelligence).
 */

export const ONTOLOGY = {
  constitution: 'Studio creates. Products operate. Platform remembers.',
  product: {
    name: 'ATRISI Marketing',
    shortName: 'ATRISI',
    role: 'Brain',
    tagline: 'Institutional knowledge and relationship intelligence',
    meaning:
      'The operating surface for strategy, campaigns, acquisition intelligence, and timelines.',
  },
  studio: {
    name: 'Studio',
    role: 'Create',
    meaning:
      'Guided workspaces to create, edit, review, and express publish / creative intent — not a second CRM.',
  },
  platform: {
    name: 'Platform',
    role: 'Remember & execute',
    meaning:
      'Shared Identity, Timeline, Knowledge, Integration (Connectors), and Creative AI.',
  },
  terms: {
    channel: 'Business destination for publish/acquire (e.g. WhatsApp, LinkedIn Organic).',
    connector: 'Technical integration owned by Platform (OAuth, secrets, API client).',
    publishingProfile: 'Studio defaults for publishing to a Channel.',
    generationProfile: 'Studio creative intent (style + quality); Platform routes providers.',
    person: 'Institutional relationship entity with a Timeline.',
    timeline: 'Chronological spine of acquisition and knowledge events.',
    knowledgeArtifact: 'Interpreted knowledge derived from media, documents, or acquisition.',
    marketingAsset: 'Creative or campaign content ready to publish via Channels.',
  },
  layers: {
    operate: 'Brain',
    create: 'Studio',
    tooling: 'Platform',
  },
} as const;

/** Short section labels for app chrome */
export const CHROME_SECTIONS = {
  brain: 'Brain',
  brainHint: 'Operate',
  studio: 'Studio',
  studioHint: 'Create',
  platform: 'Platform',
  platformHint: 'Tooling',
  utilities: 'Utilities',
} as const;
