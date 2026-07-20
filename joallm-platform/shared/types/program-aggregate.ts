/**
 * Program aggregate — Core state vs attached Capabilities.
 * Constitutional: docs/04-architecture/PROGRAM_AGGREGATE_DIRECTION.md
 * Pattern: docs/04-architecture/INSTITUTION_CAPABILITY_PATTERN.md
 *
 * Stabilize these types before Growth CRUD or Workspace features.
 */

export type ProgramFamily = 'academic' | 'institutional_career' | 'enterprise' | 'custom';

export type ProgramStatus = 'draft' | 'active' | 'paused' | 'archived';

/** Capability ids attached to a Program — not Core fields */
export type ProgramCapabilityId =
  | 'growth'
  | 'admissions'
  | 'learning'
  | 'assessment'
  | 'credentialing'
  | 'placement'
  | 'alumni'
  | 'intelligence';

/**
 * Internal shape every capability must expose (Strategy → Analytics).
 */
export type CapabilityShape = {
  strategy: unknown;
  operations: unknown;
  timeline: unknown;
  intelligence: unknown;
  analytics: unknown;
};

/** Program.Core — what the Program *is* */
export type ProgramCore = {
  identity: {
    name: string;
    slug: string;
    family: ProgramFamily;
    summary?: string;
    status: ProgramStatus;
  };
  positioning: {
    tagline?: string;
    valueProps?: string[];
    differentiation?: string;
  };
  audience: {
    eligibility?: string[];
    segments?: string[];
    bestFor?: string[];
  };
  pricing: {
    model?: string;
    notes?: string;
  };
  schedule: {
    duration?: string;
    mode?: 'in_person' | 'online' | 'hybrid' | string;
  };
  cohorts: Array<{
    id?: string;
    name: string;
    startsAt?: string;
    capacity?: number;
  }>;
  outcomesDefinition: {
    outcomes?: string[];
    successMetrics?: string[];
  };
};

/**
 * Program aggregate root.
 * Capabilities are bounded contexts keyed by programId — not embedded ops blobs.
 */
export type Program = {
  id: string;
  institutionId: string;
  core: ProgramCore;
  /** Which capabilities are enabled for this Program */
  enabledCapabilities: ProgramCapabilityId[];
  createdAt?: string;
  updatedAt?: string;
};

/** Growth capability aggregate (attached — not Program Core) */
export type GrowthAggregate = {
  programId: string;
  strategy?: unknown;
  campaigns: unknown[];
  creativeProjects: unknown[];
  assets: unknown[];
  publishing: unknown[];
  engagement: unknown[];
  applications: unknown[];
  attribution?: unknown;
  intelligence?: unknown;
};

/**
 * Handoff: Growth produces application intent on this platform.
 * education.atrisi.org PULLS — do not sync Program Core from Education.
 */
export type GrowthApplicationHandoff = {
  programId: string;
  personId?: string;
  campaignId?: string;
  source?: string;
  payload?: Record<string, unknown>;
};

/**
 * Program ids here are Growth targeting context (aligned with atrisi.org catalog).
 * education.atrisi.org already loads Program + job definitions from atrisi.org.
 * This platform owns student acquisition from the market — not program/job SoR.
 */
export type ProgramCatalogSource = 'atrisi_catalog_reference' | 'institution_manual';
