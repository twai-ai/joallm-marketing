export type StoryArcRole = 'context' | 'proof' | 'ask' | 'other';
export type StoryStatus = 'draft' | 'ready' | 'archived';

export type StoryBeatVision = {
  fileId: string;
  what: string;
  onImageText: string | null;
  signals: string[];
  mood: string;
  confidence: number;
  model: string;
  analyzedAt: string;
  promptVersion?: string;
  audienceHint?: string | null;
  claimHint?: string | null;
  narrativeFit?: 'context' | 'proof' | 'ask' | 'other' | null;
};

export type StoryBeat = {
  id: string;
  fileId: string | null;
  title: string;
  caption: string;
  notes: string;
  order: number;
  arcRole?: StoryArcRole;
  vision?: StoryBeatVision | null;
};

export type StorySession = {
  id: string;
  title: string;
  status: StoryStatus;
  programId: string | null;
  campaignId: string | null;
  arc: string;
  tone: string;
  beats: StoryBeat[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  attached: boolean;
};

export type StoryBrandKit = {
  logoFileId?: string | null;
  styleFileIds?: string[];
  /** Burn logo onto Brand / Similar + exports (default true when logo set) */
  watermark?: boolean;
};

export type StoryBrandTextMode = 'none' | 'title';

export type StoryFormatId = 'deck' | 'carousel' | 'feed' | 'story';

export const STORY_FORMAT_OPTIONS: Array<{
  id: StoryFormatId;
  label: string;
  hint: string;
  aspect: string;
}> = [
  { id: 'deck', label: 'Deck', hint: '16:9 presentation', aspect: '16:9' },
  { id: 'carousel', label: 'Carousel', hint: '1:1 feed carousel', aspect: '1:1' },
  { id: 'feed', label: 'Feed', hint: '4:5 portrait post', aspect: '4:5' },
  { id: 'story', label: 'Stories', hint: '9:16 Reels / Stories', aspect: '9:16' },
];

export function readStoryFormat(metadata?: Record<string, unknown> | null): StoryFormatId {
  const raw = metadata?.format;
  if (raw === 'deck' || raw === 'carousel' || raw === 'feed' || raw === 'story') return raw;
  const aspect = typeof metadata?.aspectRatio === 'string'
    ? metadata.aspectRatio.replace(':', 'x').toLowerCase()
    : '';
  if (aspect === '1x1') return 'carousel';
  if (aspect === '4x5') return 'feed';
  if (aspect === '9x16') return 'story';
  return 'deck';
}

export function readStoryBrandKit(metadata?: Record<string, unknown> | null): StoryBrandKit {
  const raw = metadata?.brandKit;
  if (!raw || typeof raw !== 'object') return { logoFileId: null, styleFileIds: [], watermark: true };
  const kit = raw as Record<string, unknown>;
  return {
    logoFileId: typeof kit.logoFileId === 'string' ? kit.logoFileId : null,
    styleFileIds: Array.isArray(kit.styleFileIds)
      ? kit.styleFileIds.filter((id): id is string => typeof id === 'string').slice(0, 3)
      : [],
    watermark: kit.watermark !== false,
  };
}
