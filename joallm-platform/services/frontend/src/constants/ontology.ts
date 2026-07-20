/**
 * ATRISI product ontology — user-facing vocabulary.
 * Constitutional: Studio creates. Products operate. Platform remembers.
 *
 * ATRISI Marketing solves Program Growth: institutions market Programs
 * (bootcamps, degrees, workshops), not generic campaigns.
 * See docs/04-architecture/PROGRAM_GROWTH_DIRECTION.md
 */

export const ONTOLOGY = {
  constitution: 'Studio creates. Products operate. Platform remembers.',
  product: {
    name: 'ATRISI Marketing',
    shortName: 'ATRISI',
    role: 'Brain',
    capability: 'Program Growth',
    tagline: 'Grow programs — awareness to enrollment',
    meaning:
      'Program Growth brain: strategy, acquisition, timelines, and outcomes under Programs — not a generic campaign suite.',
  },
  studio: {
    name: 'Studio',
    role: 'Create',
    meaning:
      'Program-scoped workspaces: Campaign → Creative → Assets → Publish. Never start from a blank canvas.',
  },
  platform: {
    name: 'Platform',
    role: 'Remember & execute',
    meaning:
      'Shared Identity, Timeline, Knowledge, Integration (Connectors), and Creative AI.',
  },
  terms: {
    program:
      'Primary object — course, bootcamp, workshop, event, or initiative that needs growth.',
    campaign:
      'Program-scoped growth intent (Launch, Deadline, Scholarship, …) — never orphaned from a Program.',
    creativeProject: 'Work unit under a Campaign that produces Marketing Assets.',
    marketingAsset: 'Creative content ready to publish via Channels for a Program Campaign.',
    channel: 'Business destination for publish/acquire (e.g. WhatsApp, LinkedIn Organic).',
    connector: 'Technical integration owned by Platform (OAuth, secrets, API client).',
    publishingProfile: 'Studio defaults for publishing to a Channel.',
    generationProfile: 'Studio creative intent (style + quality); Platform routes providers.',
    person: 'Institutional relationship entity with a Timeline (prospect → applicant → learner).',
    timeline: 'Chronological spine of acquisition and knowledge events — attributable to Program/Campaign.',
    knowledgeArtifact: 'Interpreted knowledge derived from media, documents, or acquisition.',
    application: 'Handoff toward Admissions / Enrollment / Learning (Education Brain).',
  },
  layers: {
    operate: 'Brain',
    create: 'Studio',
    tooling: 'Platform',
  },
  analyticsNorthStar: [
    'Program Awareness',
    'Applications',
    'Admissions',
    'Enrollments',
    'Cost per Enrollment',
  ] as const,
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
