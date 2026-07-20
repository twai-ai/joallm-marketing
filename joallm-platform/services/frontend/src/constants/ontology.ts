/**
 * ATRISI product ontology — user-facing vocabulary.
 *
 * Philosophy: Institution Capability.
 * Aggregate: Program (not Campaign, not Marketing).
 * Growth / Marketing is one capability under Program.
 *
 * See docs/04-architecture/PROGRAM_AGGREGATE_DIRECTION.md
 */

export const ONTOLOGY = {
  constitution: 'Studio creates. Products operate. Platform remembers.',
  philosophy: 'Institution Capability — Programs are how institutions deliver outcomes.',
  product: {
    name: 'ATRISI Marketing',
    shortName: 'ATRISI',
    role: 'Brain',
    capability: 'Program Growth',
    tagline: 'Programs first — Growth to Learning',
    meaning:
      'Cross-program Brain for Growth intelligence. Day-to-day work happens in Program Workspaces (Growth, Admissions, Learning, …).',
  },
  studio: {
    name: 'Studio',
    role: 'Create',
    meaning:
      'Entry to Program catalog and capability workspaces. Growth starts from a Program — never a blank campaign canvas.',
  },
  platform: {
    name: 'Platform',
    role: 'Remember & execute',
    meaning:
      'Shared Identity, Timeline, Knowledge, Integration (Connectors), and Creative AI.',
  },
  terms: {
    institution: 'Operating context / buyer — owns many Programs.',
    program:
      'Primary aggregate — course, bootcamp, workshop, event, or initiative (see atrisi.org/programs).',
    capability:
      'Workspace under a Program: Growth, Admissions, Learning, Assessment, Placement, Alumni.',
    growth: 'Program capability for campaigns, creatives, channels, applications (Program Growth).',
    campaign: 'Growth intent under a Program (Launch, Deadline, Scholarship, …).',
    creativeProject: 'Work unit under a Campaign that produces Marketing Assets.',
    marketingAsset: 'Creative content ready to publish via Channels for a Program Campaign.',
    channel: 'Business destination for publish/acquire (e.g. WhatsApp, LinkedIn Organic).',
    connector: 'Technical integration owned by Platform (OAuth, secrets, API client).',
    publishingProfile: 'Studio defaults for publishing to a Channel.',
    generationProfile: 'Studio creative intent (style + quality); Platform routes providers.',
    person: 'Institutional relationship entity with a Timeline (prospect → applicant → learner).',
    timeline: 'Chronological spine — attributable to Program / Campaign / capability.',
    knowledgeArtifact: 'Interpreted knowledge derived from media, documents, or acquisition.',
    application: 'Handoff from Growth toward Admissions → Enrollment → Learning.',
  },
  programCapabilities: [
    'Overview',
    'Growth',
    'Admissions',
    'Learning',
    'Assessment',
    'Analytics',
    'Settings',
  ] as const,
  growthWorkspace: [
    'Overview',
    'Campaigns',
    'Creative Projects',
    'Assets',
    'Publishing',
    'Channels',
    'Applications',
    'Analytics',
    'Intelligence',
  ] as const,
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
