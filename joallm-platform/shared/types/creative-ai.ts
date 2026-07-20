/**
 * Creative AI Platform — generative media contracts (Platform-owned).
 *
 * Studio owns creative intent (Generation Profiles).
 * Platform owns generative capability (Image / Video / Audio providers).
 *
 * @see ../../docs/04-architecture/CREATIVE_AI_DIRECTION.md
 * @see ../../docs/04-architecture/PLATFORM_CONSTITUTION.md
 */

/** Technical image backends — never the primary Studio UI surface. */
export type ImageGenerationProviderId =
  | 'openai'
  | 'google_imagen'
  | 'flux'
  | 'ideogram'
  | 'stability'
  | 'adobe_firefly'
  | 'auto'
  | 'custom';

export type CreativeMediaModality = 'image' | 'video' | 'audio' | 'voice' | 'ocr';

/**
 * Capability surface providers may implement.
 * Creative AI negotiates; Studios do not call vendors directly.
 */
export type CreativeAICapability =
  | 'generateImage'
  | 'editImage'
  | 'upscale'
  | 'removeBackground'
  | 'expandCanvas'
  | 'generateVariants'
  | 'generateVideo'
  | 'generateAudio'
  | 'tts'
  | 'ocr'
  | 'styleTransfer';

export type ImageGenerationQuality = 'draft' | 'standard' | 'premium';

/**
 * Business-facing style — what Studio users pick instead of model names.
 */
export type ImageGenerationStyle =
  | 'marketing_poster'
  | 'social_media'
  | 'product_mockup'
  | 'hero_banner'
  | 'illustration'
  | 'infographic'
  | 'logo'
  | 'photo_realistic'
  | 'other';

export type GenerationProfileStatus = 'active' | 'paused' | 'archived';

/**
 * Studio-facing creative intent. Provider defaults to Auto.
 */
export interface GenerationProfile {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  /** Studio that owns this profile (marketing, learning, research, …) */
  studioKind: 'marketing' | 'learning' | 'research' | 'communications' | 'grant' | 'other';
  name: string;
  status: GenerationProfileStatus;
  style: ImageGenerationStyle;
  quality: ImageGenerationQuality;
  /** Default Auto; optional hard override for power users / org policy */
  preferredProvider?: ImageGenerationProviderId | null;
  brandKitId?: string | null;
  /** Aspect ratio, safety, negative prompts, locale — opaque per style */
  defaults?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ImageProviderStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'disabled';

/**
 * Technical provider binding (Platform Creative AI).
 * Secrets live in Platform secret store — not on this record.
 */
export interface ImageGenerationProvider {
  id: string;
  ownerUserId?: string | null;
  organizationId?: string | null;
  provider: ImageGenerationProviderId;
  name: string;
  status: ImageProviderStatus;
  capabilities: CreativeAICapability[];
  /** Model / API version label, e.g. gpt-image-1, imagen-3 */
  modelId?: string | null;
  apiVersion?: string | null;
  config?: Record<string, unknown>;
  lastValidatedAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImageProviderRegistryEntry {
  provider: ImageGenerationProviderId;
  displayName: string;
  defaultCapabilities: CreativeAICapability[];
  strengths: string[];
  setupNotes?: string;
}

export type CreativeJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

/**
 * Durable generation / edit request (audit + cost + outputs).
 */
export interface CreativeJob {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  modality: CreativeMediaModality;
  status: CreativeJobStatus;
  capability: CreativeAICapability;
  generationProfileId?: string | null;
  style?: ImageGenerationStyle | null;
  quality?: ImageGenerationQuality | null;
  /** Resolved provider after Auto routing */
  provider?: ImageGenerationProviderId | null;
  providerInstanceId?: string | null;
  prompt?: string | null;
  brandKitId?: string | null;
  /** Input file ids (edit / upscale / variants) */
  inputFileIds?: string[];
  /** Output file ids in Platform storage */
  outputFileIds?: string[];
  errorMessage?: string | null;
  usage?: {
    costUsd?: number;
    latencyMs?: number;
    modelId?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

/** Studio → Creative AI request (never vendor-shaped). */
export interface GenerateImageRequest {
  ownerUserId: string;
  organizationId?: string | null;
  generationProfileId?: string | null;
  style?: ImageGenerationStyle;
  quality?: ImageGenerationQuality;
  prompt: string;
  brandKitId?: string | null;
  /** Power-user override; prefer Auto via profile */
  providerOverride?: ImageGenerationProviderId | null;
  aspectRatio?: string | null;
  n?: number;
  metadata?: Record<string, unknown>;
}

export interface GenerateImageResult {
  job: CreativeJob;
  fileIds: string[];
  provider: ImageGenerationProviderId;
}
