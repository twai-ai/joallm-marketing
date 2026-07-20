/**
 * Marketing Studio — publishing intent contracts (Channels, Profiles, Jobs).
 *
 * Studio thinks in Channels ("LinkedIn Organic"), never in Graph/REST/SDK details.
 * Platform Connectors perform execution. See integration-platform.ts.
 *
 * @see ../../docs/04-architecture/MARKETING_STUDIO_DIRECTION.md
 * @see ../../docs/04-architecture/PLATFORM_CONSTITUTION.md
 */

import type { ConnectorProvider } from './integration-platform.js';

/** Business destination — stable across vendor API version changes. */
export type ChannelKind =
  | 'meta_ads'
  | 'facebook_organic'
  | 'instagram_organic'
  | 'linkedin_organic'
  | 'linkedin_ads'
  | 'youtube'
  | 'whatsapp'
  | 'email'
  | 'website'
  | 'x_organic'
  | 'other';

export type ChannelStatus = 'active' | 'paused' | 'archived';

/**
 * Domain Channel (Studio-owned). Binds to a Platform Connector for execution.
 * Example: Channel "LinkedIn Organic" → Connector "LinkedIn UGC API".
 */
export interface Channel {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  kind: ChannelKind;
  name: string;
  status: ChannelStatus;
  /** Platform Connector that executes against this channel */
  connectorId?: string | null;
  connectorProvider?: ConnectorProvider | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type PublishingProfileStatus = 'active' | 'paused' | 'archived';

/**
 * Reusable publish defaults — marketers pick a profile, not raw destinations.
 */
export interface PublishingProfile {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  name: string;
  status: PublishingProfileStatus;
  channelId: string;
  brandKitId?: string | null;
  defaultHashtags?: string[];
  defaultUtm?: Record<string, string>;
  timezone?: string | null;
  /** Audience / tracking / landing defaults (opaque per channel) */
  defaults?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type PublishingJobStatus =
  | 'draft'
  | 'queued'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

/**
 * Durable execution request / audit trail.
 * Studio intent → Channel → Platform Connector → external system.
 */
export interface PublishingJob {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  initiativeId?: string | null;
  campaignId?: string | null;
  marketingAssetId: string;
  publishingProfileId?: string | null;
  channelId: string;
  connectorId?: string | null;
  status: PublishingJobStatus;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  externalPostId?: string | null;
  errorMessage?: string | null;
  /** Payload snapshot sent (or to be sent) — no secrets */
  payload?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Approval {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  subjectType: 'marketing_asset' | 'publishing_job' | 'creative' | 'campaign_brief';
  subjectId: string;
  status: ApprovalStatus;
  requestedByUserId: string;
  decidedByUserId?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandKit {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  name: string;
  colors?: Record<string, string>;
  fonts?: Record<string, string>;
  logos?: Record<string, unknown>[];
  voiceGuidelines?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignBrief {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  initiativeId?: string | null;
  campaignId?: string | null;
  title: string;
  objective?: string | null;
  audienceSummary?: string | null;
  keyMessages?: string[];
  constraints?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Creative {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  marketingAssetId?: string | null;
  brandKitId?: string | null;
  title: string;
  format?: string | null;
  body?: string | null;
  mediaFileIds?: string[];
  localization?: Record<string, unknown>;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  name: string;
  channelKind?: ChannelKind | null;
  body?: string | null;
  variables?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Studio-facing audience definition (Brain may hold operational audience separately). */
export interface AudienceSegment {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  name: string;
  definition?: Record<string, unknown>;
  estimatedSize?: number | null;
  createdAt: string;
  updatedAt: string;
}
