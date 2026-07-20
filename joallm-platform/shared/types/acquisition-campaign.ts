/**
 * Program-scoped acquisition campaigns (Sprint 2).
 * Campaigns are time-bound executions of a Growth Intent under a Program.
 * Initiative rows are internal program buckets — UI talks Programs + Intents + Campaigns.
 * @see docs/04-architecture/INSTITUTION_ACQUISITION_PLATFORM.md
 */

import type { GrowthIntentId } from './growth-intent.js';

export type AcquisitionCampaignStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

export type AcquisitionCampaign = {
  id: string;
  /** Targeting id aligned with atrisi.org programs catalog */
  programId: string;
  /** Durable Growth Intent this campaign executes */
  intentId?: GrowthIntentId;
  name: string;
  channel: string | null;
  status: AcquisitionCampaignStatus;
  /** @deprecated Prefer intentId — legacy free-text label */
  intentTemplate?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateAcquisitionCampaignInput = {
  name: string;
  programName?: string;
  /** Required for Intent-first create — which durable intent this campaign executes */
  intentId?: GrowthIntentId;
  channel?: string;
  status?: AcquisitionCampaignStatus;
  intentTemplate?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateAcquisitionCampaignInput = {
  name?: string;
  intentId?: GrowthIntentId;
  channel?: string | null;
  status?: AcquisitionCampaignStatus;
  intentTemplate?: string;
  metadata?: Record<string, unknown>;
};
