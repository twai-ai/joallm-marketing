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
};

export function readStoryBrandKit(metadata?: Record<string, unknown> | null): StoryBrandKit {
  const raw = metadata?.brandKit;
  if (!raw || typeof raw !== 'object') return { logoFileId: null, styleFileIds: [] };
  const kit = raw as Record<string, unknown>;
  return {
    logoFileId: typeof kit.logoFileId === 'string' ? kit.logoFileId : null,
    styleFileIds: Array.isArray(kit.styleFileIds)
      ? kit.styleFileIds.filter((id): id is string => typeof id === 'string').slice(0, 3)
      : [],
  };
}
