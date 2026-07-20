export type MediaIntelligenceMode = 'balanced' | 'conversation' | 'sales' | 'creator';

export const DEFAULT_MEDIA_INTELLIGENCE_MODE: MediaIntelligenceMode = 'balanced';

export interface MediaChunkingPolicy {
  targetDurationSec: number;
  maxDurationSec: number;
  minNaturalChunkDurationSec: number;
  naturalBreakGapSec: number;
  transcriptBreakGapSec: number;
  overlapAudioSegments: number;
  favorSpeakerTransitions: boolean;
  favorTopicShiftPhrases: boolean;
  favorVisualTransitions: boolean;
  topicShiftPatterns: RegExp[];
  visualBoundaryPatterns: RegExp[];
}

export interface MediaIntelligenceProfile {
  id: MediaIntelligenceMode;
  label: string;
  description: string;
  objective: string;
  analysisMode: string;
  evidenceRules: string[];
  outputInstructions: string[];
  chunking: MediaChunkingPolicy;
}

const COMMON_TOPIC_SHIFT_PATTERNS = [
  /\b(moving on|next up|next topic|let'?s talk about|switching to|to summarize|in conclusion|on the other hand|another thing)\b/i,
];

const COMMON_VISUAL_BOUNDARY_PATTERNS = [
  /\b(chart|graph|slide|screen share|shared screen|dashboard|table|comparison|demo|ui|roadmap|agenda)\b/i,
];

export const MEDIA_INTELLIGENCE_PROFILES: Record<MediaIntelligenceMode, MediaIntelligenceProfile> = {
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'General-purpose media understanding across recap, moments, topics, and actions.',
    objective: 'Extract grounded, timestamped media insights that are useful for review, search, and downstream clip creation.',
    analysisMode: 'balanced_media_intelligence',
    evidenceRules: [
      'Balance recap value, strong moments, reusable insights, and operational follow-ups.',
    ],
    outputInstructions: [
      'Balanced mode output preferences:',
      '- Summary: provide the clearest grounded recap of the content.',
      '- Highlights: balance usefulness, memorability, and retrieval value.',
      '- Key moments: prefer structural pivots and important takeaways.',
      '- Topics: keep them broad enough for search but specific enough to be useful.',
      '- Action items: include only grounded next steps.',
    ],
    chunking: {
      targetDurationSec: 240,
      maxDurationSec: 360,
      minNaturalChunkDurationSec: 75,
      naturalBreakGapSec: 18,
      transcriptBreakGapSec: 12,
      overlapAudioSegments: 2,
      favorSpeakerTransitions: true,
      favorTopicShiftPhrases: true,
      favorVisualTransitions: true,
      topicShiftPatterns: COMMON_TOPIC_SHIFT_PATTERNS,
      visualBoundaryPatterns: COMMON_VISUAL_BOUNDARY_PATTERNS,
    },
  },
  conversation: {
    id: 'conversation',
    label: 'Conversation',
    description: 'Prioritize speaker flow, decisions, action items, and discussion pivots.',
    objective: 'Extract grounded, speaker-aware conversation intelligence with emphasis on decisions, follow-ups, discussion pivots, and attributed takeaways.',
    analysisMode: 'conversation_intelligence',
    evidenceRules: [
      'Prefer discussion pivots, explicit decisions, follow-ups, unresolved questions, and attributable quotes.',
      'Preserve who said what whenever the evidence supports speaker attribution.',
      'When selecting highlights, favor moments that change the direction of the conversation, resolve ambiguity, or assign ownership.',
      'Topics should reflect discussion threads, not generic nouns or broad categories.',
      'Action items should read like concrete follow-ups with an owner, deliverable, or next-step signal whenever evidence allows.',
    ],
    outputInstructions: [
      'Conversation mode output preferences:',
      '- Summary: describe the discussion arc, major decisions, and open questions.',
      '- Highlights: choose moments with speaker exchange, clarification, decision, disagreement, or follow-up assignment value.',
      '- Key moments: prefer pivots, resolutions, decision points, and ownership changes.',
      '- Topics: phrase topics as discussion threads such as "deployment risk discussion" or "timeline clarification".',
      '- Action items: include only concrete follow-ups grounded in the timeline.',
    ],
    chunking: {
      targetDurationSec: 240,
      maxDurationSec: 360,
      minNaturalChunkDurationSec: 75,
      naturalBreakGapSec: 18,
      transcriptBreakGapSec: 12,
      overlapAudioSegments: 2,
      favorSpeakerTransitions: true,
      favorTopicShiftPhrases: true,
      favorVisualTransitions: true,
      topicShiftPatterns: COMMON_TOPIC_SHIFT_PATTERNS,
      visualBoundaryPatterns: COMMON_VISUAL_BOUNDARY_PATTERNS,
    },
  },
  sales: {
    id: 'sales',
    label: 'Sales',
    description: 'Focus on objections, buying signals, commitments, pricing, and negotiation moments.',
    objective: 'Extract grounded sales and negotiation intelligence with emphasis on objections, buying signals, pricing moments, commitments, and risks.',
    analysisMode: 'sales_intelligence',
    evidenceRules: [
      'Prioritize objections, buying signals, pricing moments, competitor mentions, and explicit commitments.',
      'Do not label a moment as a buying signal or objection unless the timeline clearly supports it.',
      'Highlights should focus on deal movement: interest, hesitation, budget, evaluation, procurement, security, timeline, or next-step moments.',
      'Topics should emphasize commercial themes such as pricing, packaging, rollout, objections, ROI, approvals, and adoption.',
      'Action items should preserve commitments, owners, and next meeting or proposal steps whenever supported by evidence.',
    ],
    outputInstructions: [
      'Sales mode output preferences:',
      '- Summary: explain deal status, buyer interest, concerns, and next-step momentum.',
      '- Highlights: choose objection handling, buying signals, pricing reactions, proof points, and commitment moments.',
      '- Key moments: prefer pricing turns, risk discussions, procurement/security mentions, stakeholder alignment, and close-next-step moments.',
      '- Topics: phrase topics as commercial themes such as "pricing pressure", "security review", or "pilot timeline".',
      '- Action items: focus on proposal, follow-up, scheduling, material sharing, approvals, and commercial commitments.',
    ],
    chunking: {
      targetDurationSec: 180,
      maxDurationSec: 300,
      minNaturalChunkDurationSec: 60,
      naturalBreakGapSec: 14,
      transcriptBreakGapSec: 10,
      overlapAudioSegments: 3,
      favorSpeakerTransitions: true,
      favorTopicShiftPhrases: true,
      favorVisualTransitions: false,
      topicShiftPatterns: [
        ...COMMON_TOPIC_SHIFT_PATTERNS,
        /\b(pricing|budget|cost|commercials|timeline|security review|next step|proposal|pilot|contract)\b/i,
      ],
      visualBoundaryPatterns: [
        /\b(pricing|proposal|roi|dashboard|comparison|plan|timeline)\b/i,
      ],
    },
  },
  creator: {
    id: 'creator',
    label: 'Creator',
    description: 'Prioritize hooks, clip-worthiness, quotable lines, and repurposing value.',
    objective: 'Extract grounded creator intelligence with emphasis on hook strength, clip-worthiness, quotable moments, topical chapters, and repurposing value.',
    analysisMode: 'creator_intelligence',
    evidenceRules: [
      'Prioritize hook strength, stand-alone clarity, quotability, and short-form clip value.',
      'Prefer moments that would still make sense to a new viewer in isolation.',
      'Highlights should bias toward lines or moments that have emotional pull, novelty, tension, or strong stand-alone context.',
      'Topics should help with repurposing and packaging, not just content taxonomy.',
      'Action items should only survive if they are useful for production or publishing follow-through.',
    ],
    outputInstructions: [
      'Creator mode output preferences:',
      '- Summary: explain what makes the content compelling and reusable.',
      '- Highlights: choose the most quotable, emotionally strong, surprising, or clip-ready moments.',
      '- Key moments: prefer hook moments, reveals, punchy insights, clear demonstrations, and strong closers.',
      '- Topics: phrase topics in a way that helps packaging, titling, or content repurposing.',
      '- Action items: keep only production- or publishing-relevant follow-through.',
    ],
    chunking: {
      targetDurationSec: 90,
      maxDurationSec: 180,
      minNaturalChunkDurationSec: 40,
      naturalBreakGapSec: 10,
      transcriptBreakGapSec: 8,
      overlapAudioSegments: 1,
      favorSpeakerTransitions: false,
      favorTopicShiftPhrases: true,
      favorVisualTransitions: true,
      topicShiftPatterns: [
        ...COMMON_TOPIC_SHIFT_PATTERNS,
        /\b(wait for it|here'?s the thing|the point is|that'?s why|and then|suddenly|the reveal)\b/i,
      ],
      visualBoundaryPatterns: [
        /\b(chart|slide|demo|screen share|scene change|reaction|close up|product shot|dashboard|ui)\b/i,
      ],
    },
  },
};

export function resolveMediaIntelligenceMode(mode?: MediaIntelligenceMode): MediaIntelligenceMode {
  return mode || DEFAULT_MEDIA_INTELLIGENCE_MODE;
}

export function getMediaIntelligenceProfile(mode?: MediaIntelligenceMode): MediaIntelligenceProfile {
  return MEDIA_INTELLIGENCE_PROFILES[resolveMediaIntelligenceMode(mode)];
}
