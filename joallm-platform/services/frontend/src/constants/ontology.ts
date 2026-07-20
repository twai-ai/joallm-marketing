/**
 * Stabilized ontology for ATRISI Institution Operating System.
 *
 * Philosophy: Institution Capability
 * Aggregates: Institution · Program · Person
 * Pattern: Core (owned state) vs Capability (attached workspace)
 *
 * docs/04-architecture/INSTITUTION_CAPABILITY_PATTERN.md
 * docs/04-architecture/PROGRAM_AGGREGATE_DIRECTION.md
 */

export const ONTOLOGY = {
  constitution: 'Studio creates. Products operate. Platform remembers.',
  philosophy: 'Institution Capability — capabilities plug into durable aggregates.',
  product: {
    name: 'ATRISI Marketing',
    shortName: 'ATRISI',
    role: 'Brain',
    capability: 'Growth',
    tagline: 'Programs first — capabilities plug in',
    meaning:
      'Cross-program Growth Brain. Operations live in Program Capability Workspaces (Growth, Admissions, Learning, …).',
  },
  studio: {
    name: 'Studio',
    role: 'Create',
    meaning:
      'Capability Workspaces on Programs. Marketing Studio is the transitional entry to Program → Growth.',
  },
  platform: {
    name: 'Platform',
    role: 'Remember & execute',
    meaning:
      'Timeline, Knowledge, Identity, Connectors, Creative AI — consumed by every Capability Workspace.',
  },

  /** Durable roots — capabilities never invent a new root */
  aggregates: ['Institution', 'Program', 'Person'] as const,

  /** Program.Core — what the Program *is* (not Growth data) */
  programCore: [
    'Identity',
    'Positioning',
    'Audience',
    'Pricing',
    'Schedule',
    'Cohorts',
    'Outcomes Definition',
  ] as const,

  /** Attached capabilities — how the Program *runs* */
  programCapabilities: [
    'Growth',
    'Admissions',
    'Learning',
    'Assessment',
    'Credentialing',
    'Placement',
    'Alumni',
    'Intelligence',
  ] as const,

  /** Internal shape of every capability */
  capabilityShape: ['Strategy', 'Operations', 'Timeline', 'Intelligence', 'Analytics'] as const,

  /** Growth capability aggregate */
  growthAggregate: [
    'Strategy',
    'Campaigns',
    'Creative Projects',
    'Assets',
    'Publishing',
    'Engagement',
    'Applications',
    'Attribution',
    'Intelligence',
  ] as const,

  /** Program Workspace shell tabs (UI) */
  programWorkspaceTabs: [
    'Overview',
    'Growth',
    'Admissions',
    'Learning',
    'Assessment',
    'Analytics',
    'Settings',
  ] as const,

  /** Growth Workspace IA */
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

  terms: {
    institution: 'Operating context / buyer — owns many Programs.',
    program: 'Primary delivery aggregate — Core state + attached Capabilities.',
    programCore: 'Definitional state of a Program (identity, pricing, cohorts, …).',
    capability:
      'Attached operating system under Program (Growth, Admissions, Learning, …) — not Core fields.',
    growth: 'Capability: attract participants via campaigns, creatives, channels, applications.',
    admissions: 'Capability: who gets in — applications, evaluations, offers, enrollment.',
    learning: 'Capability: how participants learn — curriculum, evidence, progress.',
    campaign: 'Growth operations object under a Program — never a root aggregate.',
    creativeProject: 'Growth work unit under a Campaign producing Assets.',
    marketingAsset: 'Publishable creative under Growth.',
    channel: 'Business destination (WhatsApp, LinkedIn Organic, …).',
    connector: 'Platform technical integration.',
    person: 'Relationship aggregate with Timeline (prospect → learner → alumnus).',
    timeline: 'Platform spine — events attributed to Program · Person · Capability.',
    application: 'Handoff port Growth → Admissions.',
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

export const CHROME_SECTIONS = {
  brain: 'Brain',
  brainHint: 'Operate',
  studio: 'Studio',
  studioHint: 'Create',
  platform: 'Platform',
  platformHint: 'Tooling',
  utilities: 'Utilities',
} as const;
