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
