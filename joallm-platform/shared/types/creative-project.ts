/**
 * Growth Creative Projects + Marketing Assets (Sprint 3).
 * Creative Project = work unit under a Campaign that produces Assets.
 * Binary blobs reuse Platform files (/api/files/upload) via fileIds.
 * @see docs/04-architecture/INSTITUTION_ACQUISITION_PLATFORM.md
 */

export type CreativeProjectStatus = 'draft' | 'active' | 'archived';

export type CreativeProject = {
  id: string;
  programId: string;
  campaignId: string;
  name: string;
  status: CreativeProjectStatus;
  /** Optional Intent asset-template label this project scaffolds (e.g. Poster) */
  templateKey?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GrowthAssetKind =
  | 'image'
  | 'video'
  | 'poster'
  | 'linkedin_post'
  | 'instagram_caption'
  | 'whatsapp_broadcast'
  | 'email'
  | 'landing_hero'
  | 'brochure'
  | 'other';

export type GrowthAssetStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived';

export type GrowthMarketingAsset = {
  id: string;
  programId: string;
  campaignId: string;
  creativeProjectId: string;
  kind: GrowthAssetKind;
  title: string;
  status: GrowthAssetStatus;
  body?: string | null;
  /** Platform file ids from /api/files/upload */
  fileIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateCreativeProjectInput = {
  name: string;
  status?: CreativeProjectStatus;
  templateKey?: string;
  metadata?: Record<string, unknown>;
};

export type CreateGrowthAssetInput = {
  title: string;
  kind?: GrowthAssetKind;
  status?: GrowthAssetStatus;
  body?: string;
  fileIds?: string[];
  metadata?: Record<string, unknown>;
};
