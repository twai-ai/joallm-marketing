/**
 * Growth Intent — durable reason to communicate about a Program.
 * Campaigns are time-bound executions of an Intent.
 * @see docs/04-architecture/INSTITUTION_ACQUISITION_PLATFORM.md
 */

export type GrowthIntentId =
  | 'awareness'
  | 'registration'
  | 'builder-challenge'
  | 'cohort-conversion'
  | 'community'
  | 'events'
  | 'success-stories'
  | 'partnerships'
  | 'hiring';

export type GrowthIntent = {
  id: GrowthIntentId;
  name: string;
  purpose: string;
  examples: string[];
  /** Primary call-to-action label when present */
  cta?: string;
  /** Typical output channels for this intent */
  outputChannels: string[];
  /**
   * Reusable asset template names for Studio scaffolding (later).
   * Not auto-created yet — catalog metadata only.
   */
  assetTemplates: string[];
};
