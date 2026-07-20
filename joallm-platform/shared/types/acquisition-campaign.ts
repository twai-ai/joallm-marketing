/**
 * Program-scoped acquisition campaigns (Sprint 2).
 * Initiative rows are internal program buckets — UI talks Programs + Campaigns only.
 * @see docs/04-architecture/INSTITUTION_ACQUISITION_PLATFORM.md
 */

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
  name: string;
  channel: string | null;
  status: AcquisitionCampaignStatus;
  intentTemplate?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateAcquisitionCampaignInput = {
  name: string;
  programName?: string;
  channel?: string;
  status?: AcquisitionCampaignStatus;
  intentTemplate?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateAcquisitionCampaignInput = {
  name?: string;
  channel?: string | null;
  status?: AcquisitionCampaignStatus;
  intentTemplate?: string;
  metadata?: Record<string, unknown>;
};
