export const MEDIA_INTELLIGENCE_MODES = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'General-purpose media understanding across recap, moments, topics, and actions.',
  },
  {
    id: 'conversation',
    label: 'Conversation',
    description: 'Prioritize speaker flow, decisions, action items, and discussion pivots.',
  },
  {
    id: 'sales',
    label: 'Sales',
    description: 'Focus on objections, buying signals, commitments, pricing, and negotiation moments.',
  },
  {
    id: 'creator',
    label: 'Creator',
    description: 'Prioritize hooks, clip-worthiness, quotable lines, and repurposing value.',
  },
] as const;

export type MediaIntelligenceMode = (typeof MEDIA_INTELLIGENCE_MODES)[number]['id'];

export const DEFAULT_MEDIA_INTELLIGENCE_MODE: MediaIntelligenceMode = 'balanced';

export interface MediaIntelligenceResultsProfile {
  overviewTitle: string;
  guidedTitle: string;
  timelineTitle: string;
  chaptersTitle: string;
  momentsTitle: string;
  clipsTitle: string;
  topicsTitle: string;
  actionsTitle: string;
  summaryLabel: string;
  topMomentLabel: string;
  topClipLabel: string;
  nextStepLabel: string;
  showChapters: boolean;
  showClips: boolean;
  showTopics: boolean;
  showActionItems: boolean;
  showVisionAnalysis: boolean;
  exportSummaryLabel: string;
  exportSheetLabel: string;
  exportSheetFormat: 'csv';
  conversationMomentPatterns?: {
    decisions: RegExp[];
    pivots: RegExp[];
  };
  salesMomentPatterns?: {
    buyingSignals: RegExp[];
    objections: RegExp[];
    pricing: RegExp[];
    commitments: RegExp[];
  };
}

const MEDIA_INTELLIGENCE_RESULT_PROFILES: Record<MediaIntelligenceMode, MediaIntelligenceResultsProfile> = {
  balanced: {
    overviewTitle: 'Long-form recap',
    guidedTitle: 'Balanced view',
    timelineTitle: 'Timeline navigator',
    chaptersTitle: 'Chaptered results',
    momentsTitle: 'Ranked key moments',
    clipsTitle: 'Suggested clips',
    topicsTitle: 'Topic cloud',
    actionsTitle: 'Action items',
    summaryLabel: 'Balanced summary',
    topMomentLabel: 'Top moment',
    topClipLabel: 'Suggested clip',
    nextStepLabel: 'Immediate next step',
    showChapters: true,
    showClips: true,
    showTopics: true,
    showActionItems: true,
    showVisionAnalysis: true,
    exportSummaryLabel: 'Export balanced summary pack',
    exportSheetLabel: 'Export insight sheet',
    exportSheetFormat: 'csv',
  },
  conversation: {
    overviewTitle: 'Conversation recap',
    guidedTitle: 'Decision and follow-up view',
    timelineTitle: 'Conversation navigator',
    chaptersTitle: 'Discussion chapters',
    momentsTitle: 'Speaker and decision moments',
    clipsTitle: 'Suggested clips',
    topicsTitle: 'Discussion themes',
    actionsTitle: 'Follow-ups',
    summaryLabel: 'Conversation summary',
    topMomentLabel: 'Decision moment',
    topClipLabel: 'Suggested clip',
    nextStepLabel: 'Follow-up',
    showChapters: true,
    showClips: true,
    showTopics: true,
    showActionItems: true,
    showVisionAnalysis: true,
    exportSummaryLabel: 'Export conversation brief',
    exportSheetLabel: 'Export follow-up ledger',
    exportSheetFormat: 'csv',
    conversationMomentPatterns: {
      decisions: [/\b(decision|decide|decided|agreed|agreement|approved|resolved|final call|conclusion)\b/i],
      pivots: [/\b(question|shift|change|clarify|discussion|concern|risk|issue)\b/i],
    },
  },
  sales: {
    overviewTitle: 'Sales call recap',
    guidedTitle: 'Deal and objection view',
    timelineTitle: 'Deal timeline',
    chaptersTitle: 'Deal chapters',
    momentsTitle: 'Objections and buying signals',
    clipsTitle: 'Suggested clips',
    topicsTitle: 'Pricing and deal themes',
    actionsTitle: 'Commitments',
    summaryLabel: 'Deal summary',
    topMomentLabel: 'Strongest sales signal',
    topClipLabel: 'Suggested clip',
    nextStepLabel: 'Commitment',
    showChapters: false,
    showClips: true,
    showTopics: true,
    showActionItems: true,
    showVisionAnalysis: false,
    exportSummaryLabel: 'Export deal brief',
    exportSheetLabel: 'Export deal signal sheet',
    exportSheetFormat: 'csv',
    salesMomentPatterns: {
      buyingSignals: [/\b(interested|timeline|budget|pilot|proposal|next step|follow up|want to|move forward|purchase|buy)\b/i],
      objections: [/\b(concern|risk|issue|objection|challenge|problem|hesitant|expensive|budget|timeline)\b/i],
      pricing: [/\b(price|pricing|cost|budget|discount|contract|proposal|seat|license)\b/i],
      commitments: [/\b(will send|will share|proposal|follow up|next step|schedule|commit|agreed)\b/i],
    },
  },
  creator: {
    overviewTitle: 'Creator recap',
    guidedTitle: 'Hook and clip view',
    timelineTitle: 'Clip timeline',
    chaptersTitle: 'Content chapters',
    momentsTitle: 'Hooks and quotable moments',
    clipsTitle: 'Clip-ready suggestions',
    topicsTitle: 'Repurposing themes',
    actionsTitle: 'Production follow-through',
    summaryLabel: 'Content summary',
    topMomentLabel: 'Best hook',
    topClipLabel: 'Best clip',
    nextStepLabel: 'Immediate next step',
    showChapters: true,
    showClips: true,
    showTopics: false,
    showActionItems: false,
    showVisionAnalysis: false,
    exportSummaryLabel: 'Export creator brief',
    exportSheetLabel: 'Export clip sheet',
    exportSheetFormat: 'csv',
  },
};

export function getMediaIntelligenceModeLabel(mode?: string): string {
  return MEDIA_INTELLIGENCE_MODES.find((item) => item.id === mode)?.label || 'Balanced';
}

export function getMediaIntelligenceResultsProfile(mode?: string): MediaIntelligenceResultsProfile {
  return MEDIA_INTELLIGENCE_RESULT_PROFILES[(mode as MediaIntelligenceMode) || DEFAULT_MEDIA_INTELLIGENCE_MODE] || MEDIA_INTELLIGENCE_RESULT_PROFILES.balanced;
}

export function getSuggestedMediaIntelligenceMode(mediaType?: string): {
  mode: MediaIntelligenceMode;
  reason: string;
} | null {
  switch (mediaType) {
    case 'video_call':
    case 'meeting':
    case 'interview':
      return {
        mode: 'conversation',
        reason: 'This looks discussion-heavy, so Conversation mode should surface decisions, pivots, and follow-ups more cleanly.',
      };
    case 'podcast':
      return {
        mode: 'creator',
        reason: 'This looks clip-friendly, so Creator mode should do a better job on hooks, quotable moments, and repurposing.',
      };
    case 'presentation':
    case 'webinar':
      return {
        mode: 'sales',
        reason: 'This looks presentation- or pitch-oriented, so Sales mode may do a better job on objections, commitments, and commercial signals.',
      };
    default:
      return null;
  }
}
