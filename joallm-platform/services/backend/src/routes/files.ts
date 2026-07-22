import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../database/connection.js';
import { files, documentChunks, ragSearchSessions, transcriptSegments, mediaInsights, frameAnalyses, editPlans, renderOutputs } from '../database/schema.js';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { documentProcessingQueue, mediaProcessingQueue, isQueueAvailable } from '../services/queue.js';
import { storageProvider } from '../services/file-storage.js';
import { LocalFileStorage } from '../services/local-file-storage.js';
import { DocumentProcessor } from '../services/document-processor.js';
import { EmbeddingService } from '../services/embedding-service.js';
import { logger } from '../utils/logger.js';
import { auditLog } from '../utils/audit.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { config } from '../config/config.js';
import { renderMediaClip } from '../services/render-service.js';
import type { MediaIntelligenceMode } from '../services/media-insight-service.js';
import { resolveMediaIntelligenceMode } from '../services/media-intelligence-profiles.js';

type TranscriptSegmentRow = typeof transcriptSegments.$inferSelect;
type MediaInsightRow = typeof mediaInsights.$inferSelect;
type FrameAnalysisRow = typeof frameAnalyses.$inferSelect;

const FileUploadSchema = z.object({
  filename: z.string(),
  mimetype: z.string(),
  size: z.number(),
  buffer: z.instanceof(Buffer)
});

const FileMetadataSchema = z.object({
  id: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimetype: z.string(),
  size: z.number(),
  status: z.enum(['uploaded', 'processing', 'processed', 'failed']),
  uploadDate: z.string(),
  processingDate: z.string().optional(),
  chunks: z.number().optional(),
  storageUrl: z.string().optional(),
  storageKey: z.string().optional(),
  storageProvider: z.string().optional(),
  error: z.string().optional(),
  processingStage: z.string().optional(),
  indexingStatus: z.string().optional(),
  keywordSearchAvailable: z.boolean().optional(),
  vectorSearchAvailable: z.boolean().optional(),
});

const CreateClipSchema = z.object({
  startTime: z.number().min(0),
  endTime: z.number().gt(0),
  title: z.string().min(1).max(160).optional(),
  sourceInsightId: z.string().optional(),
});

const AnalyzeMediaSchema = z.object({
  intelligenceMode: z.enum(['balanced', 'conversation', 'sales', 'creator']).default('balanced'),
});

// Helper function to check if file is allowed by extension
// Updated to match frontend validation - removed unsupported formats
function isFileAllowedByExtension(filename: string): { allowed: boolean; status?: 'supported' | 'beta' | 'coming-soon'; warning?: string } {
  const ext = filename.toLowerCase().split('.').pop();
  
  // Fully supported formats
  const supportedExtensions = [
    // Documents (fully supported)
    'doc', 'docx',
    // Text files (fully supported)
    'txt', 'md', 'markdown', 'csv', 'html', 'xml', 'rtf',
    // Images (metadata only - fully supported)
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg',
    // Data formats (fully supported)
    'json', 'yaml', 'yml',
    // Code files (plain text - fully supported)
    'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'cc', 'cxx', 'cs', 'php', 'rb', 'go', 'rs', 'sql',
    'css', 'scss', 'sass', 'less'
  ];
  
  // Beta formats (limited support)
  const betaExtensions = ['pdf'];
  
  // Video/audio formats — media intelligence pipeline
  const mediaVideoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv', 'wmv'];
  const mediaAudioExtensions = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma'];

  if (ext && (mediaVideoExtensions.includes(ext) || mediaAudioExtensions.includes(ext))) {
    return { allowed: true, status: 'supported' };
  }

  // Coming soon formats (blocked - tell user to convert)
  const comingSoonExtensions = [
    'xls', 'xlsx', 'ppt', 'pptx',  // Excel, PowerPoint
    'odt', 'ods', 'odp',            // OpenDocument
    'zip', 'rar', '7z',             // Archives
    'epub', 'mobi',                 // Ebooks
    'vcf', 'msg', 'eml'            // Other formats
  ];
  
  if (!ext) {
    return { allowed: false };
  }
  
  if (supportedExtensions.includes(ext)) {
    return { allowed: true, status: 'supported' };
  }
  
  if (betaExtensions.includes(ext)) {
    return { 
      allowed: true, 
      status: 'beta', 
      warning: 'PDF text extraction is in beta. Search results may be incomplete.' 
    };
  }
  
  if (comingSoonExtensions.includes(ext)) {
    return { 
      allowed: false, 
      status: 'coming-soon', 
      warning: `${ext.toUpperCase()} format is in development. Please convert to .docx or .txt for now.` 
    };
  }
  
  return { allowed: false };
}

// Enhanced chunking strategy for better semantic search results
function createTextChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  // Clean and normalize text
  const cleanText = text
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')  // Reduce excessive line breaks
    .trim();
  
  while (start < cleanText.length) {
    const end = Math.min(start + chunkSize, cleanText.length);
    let chunk = cleanText.slice(start, end);
    
    // Enhanced boundary detection for better semantic coherence
    if (end < cleanText.length) {
      // Priority order for break points (best to worst)
      const breakPoints = [
        { pattern: /\.\s+[A-Z]/g, lastIndex: -1 },  // End of sentence followed by capital
        { pattern: /\.\s*\n/g, lastIndex: -1 },     // End of sentence with newline
        { pattern: /\n\n/g, lastIndex: -1 },        // Paragraph break
        { pattern: /\n/g, lastIndex: -1 },          // Line break
        { pattern: /\.\s+/g, lastIndex: -1 },       // End of sentence
        { pattern: /;\s+/g, lastIndex: -1 },        // Semicolon
        { pattern: /,\s+/g, lastIndex: -1 },        // Comma
        { pattern: /\s+/g, lastIndex: -1 }          // Space (fallback)
      ];
      
      let bestBreakPoint = -1;
      let bestScore = 0;
      
      // Find the best break point within the chunk
      for (const breakPoint of breakPoints) {
        const matches = [...chunk.matchAll(breakPoint.pattern)];
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          const position = lastMatch.index! + lastMatch[0].length;
          const score = getBreakPointScore(breakPoint.pattern, position, chunk.length);
          
          if (score > bestScore && position > chunk.length * 0.3) {
            bestScore = score;
            bestBreakPoint = position;
          }
        }
      }
      
      // Apply the best break point if found
      if (bestBreakPoint > 0) {
        chunk = cleanText.slice(start, start + bestBreakPoint);
        start = start + bestBreakPoint - overlap;
      } else {
        // Fallback: break at word boundary
        const lastSpace = chunk.lastIndexOf(' ');
        if (lastSpace > chunk.length * 0.5) {
          chunk = chunk.slice(0, lastSpace);
          start = start + lastSpace - overlap;
        } else {
          start = end - overlap;
        }
      }
    } else {
      start = end;
    }
    
    // Clean and validate chunk
    const cleanChunk = chunk.trim();
    if (cleanChunk.length > 50) { // Minimum meaningful chunk size
      chunks.push(cleanChunk);
    }
  }
  
  return chunks;
}

// Helper function to score break points for semantic coherence
function getBreakPointScore(pattern: RegExp, position: number, chunkLength: number): number {
  const relativePosition = position / chunkLength;
  
  // Prefer break points that are:
  // 1. Not too close to the beginning (avoid tiny chunks)
  // 2. Not too close to the end (avoid tiny remainders)
  // 3. Closer to the middle for better balance
  
  let score = 1;
  
  // Position-based scoring
  if (relativePosition < 0.3 || relativePosition > 0.9) {
    score *= 0.5; // Penalize extreme positions
  } else if (relativePosition > 0.4 && relativePosition < 0.8) {
    score *= 1.5; // Reward good positions
  }
  
  // Pattern-based scoring (semantic importance)
  if (pattern.source.includes('\\.\\s+[A-Z]')) score *= 3;  // Sentence boundary
  else if (pattern.source.includes('\\.\\s*\\n')) score *= 2.5;  // Sentence + newline
  else if (pattern.source.includes('\\n\\n')) score *= 2;  // Paragraph
  else if (pattern.source.includes('\\n')) score *= 1.5;  // Line break
  else if (pattern.source.includes('\\.\\s+')) score *= 1.2;  // Sentence
  else if (pattern.source.includes(';\\s+')) score *= 1.1;  // Semicolon
  else if (pattern.source.includes(',\\s+')) score *= 1.05; // Comma
  else score *= 1; // Space (fallback)
  
  return score;
}

function pickMediaChapterWindow(durationSec: number): number {
  if (durationSec <= 12 * 60) return 120;
  if (durationSec <= 30 * 60) return 300;
  return 600;
}

function clipText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return value;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function sentenceSummary(text: string, maxSentences = 2): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(part => part.trim())
    .filter(Boolean);
  return clipText(sentences.slice(0, maxSentences).join(' '), 240) || clipText(text, 240) || '';
}

function chapterTitle(index: number, startTime: number, topics: string[]): string {
  if (topics.length > 0) {
    return `Chapter ${index + 1}: ${topics.slice(0, 2).join(' & ')}`;
  }
  return `Chapter ${index + 1} · ${Math.floor(startTime / 60)}m`;
}

function summarizeFrameContext(frames: FrameAnalysisRow[], limit: number = 2): string[] {
  return frames
    .slice(0, limit)
    .map(frame => {
      const text = frame.detectedText ? `${frame.description} (on-screen: "${frame.detectedText}")` : frame.description;
      return clipText(text, 140) || text;
    })
    .filter(Boolean);
}

function detectResultsMediaType(
  segments: TranscriptSegmentRow[],
  frames: FrameAnalysisRow[],
): 'podcast' | 'interview' | 'meeting' | 'video_call' | 'webinar' | 'tutorial' | 'presentation' | 'general_video' {
  const transcriptText = segments.map(segment => segment.text).join(' ').toLowerCase();
  const visualText = frames.map(frame => [frame.description, frame.detectedText || ''].join(' ')).join(' ').toLowerCase();
  const speakers = new Set(segments.map(segment => segment.speaker).filter(Boolean)).size;

  if (/\bsubscribe\b|\bepisode\b|\bpodcast\b|\bhost\b/.test(transcriptText)) return 'podcast';
  if (/\b(zoom|google meet|microsoft teams|participant|gallery view|speaker view|waiting room|mute|unmute|screen share|shared screen|recording in progress)\b/.test(visualText)
    || (/\b(can you hear me|you re on mute|you are on mute|sharing my screen|drop in the chat|put it in the chat|thanks everyone for joining)\b/.test(transcriptText) && speakers >= 2)) {
    return 'video_call';
  }
  if ((/\binterview\b|\bguest\b|\bquestion\b/.test(transcriptText) && speakers >= 2) || /\bq and a\b/.test(transcriptText)) return 'interview';
  if (/\baction item\b|\bnext step\b|\bowner\b|\bfollow up\b|\bdeadline\b/.test(transcriptText)) return 'meeting';
  if (/\bwebinar\b|\battendees\b|\bthank you for joining\b/.test(transcriptText)) return 'webinar';
  if (/\bhow to\b|\btutorial\b|\bstep by step\b|\bwalkthrough\b/.test(transcriptText)) return 'tutorial';
  if (/\bslide\b|\bchart\b|\bdashboard\b|\broadmap\b/.test(visualText) || /\bpresentation\b|\bdeck\b/.test(transcriptText)) return 'presentation';
  return 'general_video';
}

function normalizeInsightText(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lexicalOverlapScore(a: string, b: string): number {
  const aTerms = new Set(normalizeInsightText(a).split(' ').filter(term => term.length > 2));
  const bTerms = new Set(normalizeInsightText(b).split(' ').filter(term => term.length > 2));

  if (aTerms.size === 0 || bTerms.size === 0) return 0;

  let matches = 0;
  for (const term of aTerms) {
    if (bTerms.has(term)) matches += 1;
  }

  return matches / aTerms.size;
}

function inferInsightTimeline(
  insight: Pick<MediaInsightRow, 'title' | 'description' | 'startTime' | 'endTime'>,
  segments: TranscriptSegmentRow[],
): { startTime?: number; endTime?: number } {
  if (insight.startTime !== null && insight.startTime !== undefined) {
    return {
      startTime: insight.startTime,
      endTime: insight.endTime ?? insight.startTime,
    };
  }

  const evidence = [insight.title, insight.description].filter(Boolean).join(' ');
  if (!evidence.trim() || segments.length === 0) {
    return {};
  }

  let bestSegment: TranscriptSegmentRow | null = null;
  let bestScore = 0;

  for (const segment of segments) {
    const score = lexicalOverlapScore(evidence, segment.text);
    if (score > bestScore) {
      bestScore = score;
      bestSegment = segment;
    }
  }

  if (!bestSegment || bestScore < 0.2) {
    return {};
  }

  return {
    startTime: bestSegment.startTime,
    endTime: bestSegment.endTime,
  };
}

function pickByKeywords<T>(
  items: T[],
  extractText: (item: T) => string,
  patterns: RegExp[],
  fallbackCount: number,
): T[] {
  const matched = items.filter(item => patterns.some(pattern => pattern.test(extractText(item))));
  return matched.length > 0 ? matched : items.slice(0, fallbackCount);
}

function textFromInsightLike(item: { title?: string | null; description?: string | null; tags?: string[] | null }): string {
  return `${item.title || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
}

function getModeMomentPool(
  intelligenceMode: MediaIntelligenceMode,
  highlights: MediaInsightRow[],
  keyMoments: MediaInsightRow[],
): MediaInsightRow[] {
  switch (intelligenceMode) {
    case 'conversation': {
      const combined = [...keyMoments, ...highlights];
      const decisions = pickByKeywords(combined, textFromInsightLike, [/\b(decision|decide|decided|agreed|agreement|approved|resolved|final call|conclusion)\b/i], 4);
      const pivots = pickByKeywords(combined, textFromInsightLike, [/\b(question|shift|change|clarify|discussion|concern|risk|issue)\b/i], 4);
      return [...decisions, ...pivots.filter(item => !decisions.some(existing => existing.id === item.id))];
    }
    case 'sales': {
      const combined = [...highlights, ...keyMoments];
      const signals = pickByKeywords(combined, textFromInsightLike, [/\b(interested|timeline|budget|pilot|proposal|next step|follow up|want to|move forward|purchase|buy)\b/i], 4);
      const objections = pickByKeywords(combined, textFromInsightLike, [/\b(concern|risk|issue|objection|challenge|problem|hesitant|expensive|budget|timeline)\b/i], 4);
      return [...signals, ...objections.filter(item => !signals.some(existing => existing.id === item.id))];
    }
    case 'creator':
      return [...highlights, ...keyMoments];
    default:
      return [...highlights, ...keyMoments];
  }
}

function getModeTopics(
  intelligenceMode: MediaIntelligenceMode,
  topics: MediaInsightRow[],
): MediaInsightRow[] {
  switch (intelligenceMode) {
    case 'sales':
      return pickByKeywords(topics, textFromInsightLike, [/\b(price|pricing|cost|budget|discount|contract|proposal|seat|license|security|pilot|roi|timeline)\b/i], 6);
    case 'conversation':
      return pickByKeywords(topics, textFromInsightLike, [/\b(decision|timeline|risk|question|clarification|follow up|discussion)\b/i], 6);
    default:
      return topics;
  }
}

function getModeActionItems(
  intelligenceMode: MediaIntelligenceMode,
  actionItems: MediaInsightRow[],
): MediaInsightRow[] {
  switch (intelligenceMode) {
    case 'sales':
      return pickByKeywords(actionItems, textFromInsightLike, [/\b(will send|will share|proposal|follow up|next step|schedule|commit|agreed|pilot|contract|pricing)\b/i], 6);
    case 'conversation':
      return pickByKeywords(actionItems, textFromInsightLike, [/\b(next step|follow up|owner|deadline|send|share|schedule|prepare|review|assign)\b/i], 6);
    default:
      return actionItems;
  }
}

function buildWhyItMatters(
  intelligenceMode: MediaIntelligenceMode,
  insight: MediaInsightRow,
): string {
  if (insight.description) {
    return insight.description;
  }

  switch (intelligenceMode) {
    case 'conversation':
      return insight.insightType === 'highlight'
        ? 'This moment captures a meaningful discussion turn, clarification, or participant exchange.'
        : 'This moment marks a decision, pivot, or ownership change in the conversation.';
    case 'sales':
      return insight.insightType === 'highlight'
        ? 'This moment shows buyer interest, hesitation, or commercial movement worth tracking.'
        : 'This moment changes deal momentum through pricing, risk, timeline, or commitment discussion.';
    case 'creator':
      return insight.insightType === 'highlight'
        ? 'This moment is quotable, punchy, or emotionally strong enough to stand alone.'
        : 'This moment has strong hook or packaging value for clips and repurposing.';
    default:
      return insight.insightType === 'highlight'
        ? 'A strong, reusable moment that can anchor the recap.'
        : 'A structural moment that changes the direction of the conversation.';
  }
}

function buildClipWhyItWorks(
  intelligenceMode: MediaIntelligenceMode,
  insight: MediaInsightRow,
): string {
  switch (intelligenceMode) {
    case 'creator':
      return insight.insightType === 'highlight'
        ? 'This moment has stand-alone hook value and is already shaped like a short-form beat.'
        : 'This moment has a clear reveal or transition, which makes it easy to package into a clip.';
    case 'sales':
      return 'This moment captures a commercial signal, objection, or next-step beat that is easy to revisit and share.';
    case 'conversation':
      return 'This moment cleanly captures a decision, pivot, or follow-up in the conversation.';
    default:
      return insight.insightType === 'highlight'
        ? 'This moment is concise, quotable, and already stands out from the rest of the conversation.'
        : 'This moment marks a clear shift or decision, which makes it easy to package as a short clip.';
  }
}

function buildMediaResultsPayload(
  segments: TranscriptSegmentRow[],
  insights: MediaInsightRow[],
  frames: FrameAnalysisRow[] = [],
  intelligenceMode: MediaIntelligenceMode = 'balanced',
) {
  const orderedSegments = [...segments].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const durationSec = orderedSegments.length > 0 ? Math.max(...orderedSegments.map(segment => segment.endTime)) : 0;
  const chapterWindowSec = pickMediaChapterWindow(durationSec);

  const summaries = insights.filter(insight => insight.insightType === 'summary');
  const highlights = insights
    .filter(insight => insight.insightType === 'highlight')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const keyMoments = insights
    .filter(insight => insight.insightType === 'key_moment')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const topics = getModeTopics(intelligenceMode, insights.filter(insight => insight.insightType === 'topic'));
  const actionItems = getModeActionItems(intelligenceMode, insights.filter(insight => insight.insightType === 'action_item'));
  const prioritizedMoments = getModeMomentPool(intelligenceMode, highlights, keyMoments);

  const chapters = Array.from({ length: Math.max(1, Math.ceil(durationSec / chapterWindowSec)) }, (_, index) => {
    const startTime = index * chapterWindowSec;
    const endTime = Math.min(durationSec || chapterWindowSec, startTime + chapterWindowSec);
    const chapterSegments = orderedSegments.filter(
      segment => segment.startTime < endTime && segment.endTime >= startTime,
    );
    const chapterInsights = insights.filter(insight => {
      if (insight.startTime === null || insight.startTime === undefined) return false;
      const insightEnd = insight.endTime ?? insight.startTime;
      return insight.startTime < endTime && insightEnd >= startTime;
    });
    const chapterFrames = frames.filter(frame => frame.timestampSec >= startTime && frame.timestampSec < endTime);
    const chapterTopics = [
      ...new Set(
        chapterInsights
          .filter(insight => insight.insightType === 'topic')
          .map(insight => insight.title)
          .filter(Boolean),
      ),
    ].slice(0, 4);
    const notableQuotes = chapterSegments
      .filter(segment => segment.text.trim().length > 60)
      .slice(0, 3)
      .map(segment => ({
        id: segment.id,
        text: clipText(segment.text, 180) || segment.text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        speaker: segment.speaker ?? undefined,
      }));

    const chapterText = chapterSegments.map(segment => segment.text).join(' ');
    const keyMoment = chapterInsights.find(insight => prioritizedMoments.some(moment => moment.id === insight.id))
      || chapterInsights.find(insight => insight.insightType === 'key_moment');
    const visualHighlights = summarizeFrameContext(chapterFrames);
    const chapterSummaryBase = keyMoment?.description || sentenceSummary(chapterText);
    const modeSummaryPrefix =
      intelligenceMode === 'sales'
        ? 'Deal thread: '
        : intelligenceMode === 'conversation'
          ? 'Discussion thread: '
          : intelligenceMode === 'creator'
            ? 'Content beat: '
            : '';

    return {
      id: `chapter-${index + 1}`,
      title: chapterTitle(index, startTime, chapterTopics),
      startTime,
      endTime,
      summary: [modeSummaryPrefix ? `${modeSummaryPrefix}${chapterSummaryBase}` : chapterSummaryBase, visualHighlights[0] ? `Visual cue: ${visualHighlights[0]}` : ''].filter(Boolean).join(' '),
      topics: chapterTopics,
      visualHighlights,
      notableQuotes,
      keyMoment: keyMoment
        ? {
            title: keyMoment.title,
            description: keyMoment.description,
            startTime: keyMoment.startTime,
            endTime: keyMoment.endTime,
            score: keyMoment.score,
          }
        : null,
    };
  }).filter(chapter => chapter.notableQuotes.length > 0 || chapter.summary || chapter.topics.length > 0);

  const moments = prioritizedMoments
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8)
    .map((insight, index) => {
      const timeline = inferInsightTimeline(insight, orderedSegments);
      return {
      id: insight.id,
      rank: index + 1,
      type: insight.insightType,
      title: insight.title,
      description: insight.description,
      startTime: timeline.startTime,
      endTime: timeline.endTime,
      confidence: insight.score ?? 0.7,
      whyItMatters: buildWhyItMatters(intelligenceMode, insight),
      tags: insight.tags,
    };
    });

  const clipCandidates = intelligenceMode === 'creator' ? [...highlights, ...keyMoments] : prioritizedMoments;
  const clipSuggestions = clipCandidates
    .filter(insight => insight.startTime !== null && insight.startTime !== undefined)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 6)
    .map((insight, index) => {
      const startTime = insight.startTime ?? 0;
      const desiredMinDuration = intelligenceMode === 'creator' ? 15 : 20;
      const rawEndTime = insight.endTime ?? startTime + desiredMinDuration;
      const endTime = Math.max(rawEndTime, startTime + desiredMinDuration);
      return {
        id: `clip-${insight.id}`,
        rank: index + 1,
        title: insight.title,
        hook: clipText(insight.description || insight.title, 110) || insight.title,
        startTime,
        endTime,
        duration: Number((endTime - startTime).toFixed(1)),
        whyItWorks: buildClipWhyItWorks(intelligenceMode, insight),
        confidence: insight.score ?? 0.7,
        tags: insight.tags,
      };
    });

  return {
    overview: {
      mediaType: detectResultsMediaType(orderedSegments, frames),
      summary: summaries[0]
        ? {
          title: summaries[0].title,
          description: [
            summaries[0].description,
            frames.length > 0 ? `Visual context from ${frames.length} sampled frame${frames.length !== 1 ? 's' : ''} has been blended into the recap.` : '',
          ].filter(Boolean).join(' '),
          tags: summaries[0].tags,
        }
        : null,
      durationSec,
      chapterCount: chapters.length,
      keyMomentCount: moments.length,
      clipSuggestionCount: clipSuggestions.length,
      topicCount: topics.length,
      actionItemCount: actionItems.length,
      frameAnalysisCount: frames.length,
    },
    chapters,
    moments,
    clipSuggestions,
    topics: topics.slice(0, 10).map((topic, index) => {
      const timeline = inferInsightTimeline(topic, orderedSegments);
      return {
        id: topic.id,
        rank: index + 1,
        title: topic.title,
        description: topic.description,
        tags: topic.tags,
        startTime: timeline.startTime,
        endTime: timeline.endTime,
      };
    }),
    actionItems: actionItems.slice(0, 10).map((item, index) => {
      const timeline = inferInsightTimeline(item, orderedSegments);
      return {
        id: item.id,
        rank: index + 1,
        title: item.title,
        description: item.description,
        tags: item.tags,
        startTime: timeline.startTime,
        endTime: timeline.endTime,
      };
    }),
    frameAnalyses: frames
      .sort((a, b) => a.timestampSec - b.timestampSec)
      .map(f => ({
        id: f.id,
        timestampSec: f.timestampSec,
        description: f.description,
        objects: f.objects,
        detectedText: f.detectedText,
        confidence: f.confidence,
      })),
  };
}

export async function filesRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Upload file
  fastify.post('/upload', {
    preHandler: [authenticateToken, requirePermission('knowledge.write')],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour'
      }
    },
    schema: {
      description: 'Upload a file for processing and RAG indexing',
      tags: ['files'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            fileId: { type: 'string' },
            filename: { type: 'string' },
            size: { type: 'number' },
            status: { type: 'string' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = await request.file();
      const userId = (request as any).user?.id;
      
      if (!data) {
        return reply.status(400).send({
          error: 'No file provided',
          message: 'Please provide a file to upload'
        });
      }

      // Get storeOriginal flag from form fields (defaults to false)
      const fields = data.fields;
      const storeOriginal = fields && (fields as any).storeOriginal?.value === 'true';
      
      // Debug logging
      logger.info('File upload received:', {
        filename: data.filename,
        mimetype: data.mimetype,
        encoding: data.encoding,
        fieldname: data.fieldname,
        size: data.file.bytesRead,
        storeOriginal
      });

      // Validate file - Comprehensive document type support
      const allowedTypes = [
        // PDF documents
        'application/pdf',
        
        // Text documents
        'text/plain',
        'text/markdown',
        'text/x-markdown',
        'application/markdown',
        'text/x-markdown; charset=utf-8',
        'text/csv',
        'text/html',
        'text/xml',
        'application/xml',
        'text/rtf',
        
        // Microsoft Office documents
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/vnd.ms-powerpoint', // .ppt
        
        // OpenDocument formats
        'application/vnd.oasis.opendocument.text', // .odt
        'application/vnd.oasis.opendocument.spreadsheet', // .ods
        'application/vnd.oasis.opendocument.presentation', // .odp
        
        // Images
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'image/svg+xml',
        
        // Archives (for processing)
        'application/zip',
        'application/x-zip-compressed',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        
        // JSON and data formats
        'application/json',
        'application/xml',
        'text/xml',
        'application/yaml',
        'text/yaml',
        'application/x-yaml',
        
        // Code files
        'text/javascript',
        'application/javascript',
        'text/typescript',
        'application/typescript',
        'text/python',
        'text/x-python',
        'text/x-java-source',
        'text/x-c',
        'text/x-c++',
        'text/x-csharp',
        'text/x-php',
        'text/x-ruby',
        'text/x-go',
        'text/x-rust',
        'text/x-sql',
        
        // Other common formats
        'application/epub+zip', // EPUB books
        'application/x-mobipocket-ebook', // MOBI books
        'text/vcard', // Contact files
        'application/vnd.ms-outlook', // Outlook files
        'message/rfc822', // Email files

        // Video — media intelligence pipeline
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
        'video/webm',
        'video/x-m4v',
        'video/x-flv',
        'video/x-ms-wmv',

        // Audio — transcription pipeline
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/flac',
        'audio/x-flac',
        'audio/mp4',
        'audio/m4a',
        'audio/x-m4a',
        'audio/aac',
        'audio/ogg',
        'audio/opus',
        'audio/x-ms-wma',
      ];

      // Case-insensitive check and also check for files by extension
      const mimetype = data.mimetype.toLowerCase();
      const filename = data.filename.toLowerCase();

      const MEDIA_MIME_TYPES = new Set([
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
        'video/webm', 'video/x-m4v', 'video/x-flv', 'video/x-ms-wmv',
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/flac',
        'audio/x-flac', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac',
        'audio/ogg', 'audio/opus', 'audio/x-ms-wma',
      ]);
      const MEDIA_EXTENSIONS = new Set([
        'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv', 'wmv',
        'mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma',
      ]);
      const IMAGE_EXTENSIONS = new Set([
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'svg',
      ]);
      const fileExt = filename.split('.').pop() ?? '';
      const isMediaFile = MEDIA_MIME_TYPES.has(mimetype) || MEDIA_EXTENSIONS.has(fileExt);
      const isImageFile = mimetype.startsWith('image/') || IMAGE_EXTENSIONS.has(fileExt);
      const isMarkdownByExtension = filename.endsWith('.md') || filename.endsWith('.markdown');
      const isAllowedMimeType = allowedTypes.some(type => type.toLowerCase() === mimetype);
      
      // Check if file is allowed by extension (fallback for when MIME type detection fails)
      const extensionCheck = isFileAllowedByExtension(filename);
      
      logger.info('File validation:', {
        originalMimetype: data.mimetype,
        normalizedMimetype: mimetype,
        filename: filename,
        isMarkdownByExtension,
        isAllowedMimeType,
        extensionCheck,
        allowedTypes: allowedTypes.map(t => t.toLowerCase())
      });
      
      // Check if file is not allowed
      if (!isAllowedMimeType && !isMarkdownByExtension && !extensionCheck.allowed) {
        // Provide specific error message for coming soon formats
        if (extensionCheck.status === 'coming-soon') {
          return reply.status(400).send({
            error: 'Format in development',
            message: extensionCheck.warning || `This file format is not yet supported. Please convert to .docx or .txt format.`,
            status: 'coming-soon'
          });
        }
        
        // Generic unsupported format message
        return reply.status(400).send({
          error: 'Unsupported file type',
          message: `File type ${data.mimetype} is not supported. Supported formats: Documents (TXT, MD, DOC, DOCX, CSV, HTML, XML, RTF), Images (JPEG, PNG, GIF, WebP, BMP, TIFF, SVG), Code files (JS, TS, PY, Java, C++, etc.), Data (JSON, YAML), and PDF (Beta).`,
          supportedFormats: 'TXT, MD, DOC, DOCX, CSV, HTML, XML, RTF, Images, Code files, JSON, YAML, PDF (Beta)'
        });
      }

      const maxSize = isMediaFile ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
      const maxSizeLabel = isMediaFile ? '500MB' : '50MB';
      if (data.file.bytesRead > maxSize) {
        return reply.status(400).send({
          error: 'File too large',
          message: `File size must be less than ${maxSizeLabel}`
        });
      }

      // Read file buffer
      const buffer = await data.toBuffer();
      
      // Create file record in database
      const newFile = await db.insert(files).values({
        filename: data.filename,
        originalName: data.filename,
        mimetype: data.mimetype,
        size: data.file.bytesRead,
        status: 'uploaded',
        userId: userId || null,
        storageProvider: config.storageProvider as 'volume' | 'cloudflare-r2' | 'aws-s3',
        metadata: {
          storeOriginal: storeOriginal
        } as any
      }).returning({ id: files.id });

      const fileId = newFile[0].id;
      await auditLog('file_upload', {
        userId: userId ?? null,
        resource: 'file',
        resourceId: fileId,
        metadata: { filename: data.filename, size: data.file.bytesRead, mimetype: data.mimetype },
        request,
      });

      // Always retain original bytes for media/images (Creative AI refs, previews, downloads).
      // Document uploads only keep originals when storeOriginal=true.
      const shouldPersistOriginal = isMediaFile || isImageFile || storeOriginal;
      let persistedStorageKey: string | undefined;
      if (shouldPersistOriginal) {
        const ext = data.filename.split('.').pop() || (isImageFile ? 'png' : 'bin');
        const folder = isMediaFile ? 'media' : isImageFile ? 'images' : 'originals';
        persistedStorageKey = `${folder}/${userId}/${fileId}/original.${ext}`;
        const objectMeta: Record<string, string> = {
          'user-id': userId,
          'file-id': fileId,
          'original-filename': encodeURIComponent(data.filename),
          'uploaded-at': new Date().toISOString(),
        };
        const storageUrl = await storageProvider.uploadFile(
          buffer,
          persistedStorageKey,
          data.mimetype,
          objectMeta,
        );
        await db.update(files)
          .set({
            storageKey: persistedStorageKey,
            storageUrl,
            storageProvider: config.storageProvider as 'volume' | 'cloudflare-r2' | 'aws-s3',
            metadata: {
              storeOriginal: true,
              retainedFor: isImageFile ? 'creative_ai_or_preview' : isMediaFile ? 'media' : 'original',
            } as any,
          })
          .where(eq(files.id, fileId));
        logger.info(`Persisted original bytes for file ${fileId} at ${persistedStorageKey}`);
      }

      // Queue file for background processing if queue is available
      if (isQueueAvailable() && (documentProcessingQueue || mediaProcessingQueue)) {
        try {
          if (isMediaFile) {
            // Media pipeline: original already stored above; enqueue metadata extraction.
            logger.info(`Queuing media file ${fileId} for metadata extraction`);
            await db.update(files)
              .set({ status: 'processing' })
              .where(eq(files.id, fileId));

            if (mediaProcessingQueue) {
              await mediaProcessingQueue.add('extract-metadata' as any, {
                fileId,
                userId,
                jobType: 'extract_metadata',
              });
            }
          } else if (isImageFile) {
            // Images are retained for Creative AI / assets — no RAG pipeline required.
            await db.update(files)
              .set({ status: 'processed' })
              .where(eq(files.id, fileId));
          } else {
            logger.info(`Queuing file ${fileId} for background processing`);
            await documentProcessingQueue!.add('process-document' as any, {
              fileId,
              userId,
              buffer,
              filename: data.filename,
              mimetype: data.mimetype,
              size: data.file.bytesRead,
              storeOriginal: shouldPersistOriginal,
            });
          }
          
          logger.info(`File ${fileId} queued successfully`);
          
          const response = {
            fileId,
            id: fileId, // For compatibility with frontend
            filename: data.filename,
            name: data.filename, // For compatibility
            size: data.file.bytesRead,
            status: isImageFile ? 'processed' : 'processing',
            url: `/api/files/${fileId}/download`, // URL for attachment reference
            message: isImageFile
              ? 'Image uploaded and retained for creatives'
              : 'File uploaded and queued for processing',
            // Include format support information
            supported: extensionCheck.status || 'supported',
            warning: extensionCheck.warning,
            storageKey: persistedStorageKey,
          };

          reply.send(response);
        } catch (queueError) {
          logger.error(`Failed to queue file ${fileId}:`, queueError);
          
          // Update status to failed
          await db.update(files)
            .set({ 
              status: 'failed',
              processingError: queueError instanceof Error ? queueError.message : 'Failed to queue for processing'
            })
            .where(eq(files.id, fileId));
          
          const response = {
            fileId,
            id: fileId, // For compatibility with frontend
            filename: data.filename,
            size: data.file.bytesRead,
            status: 'failed',
            url: `/api/files/${fileId}/download`, // URL for attachment reference
            message: 'File uploaded but failed to queue for processing'
          };

          reply.send(response);
        }
      } else {
        // Queue not available — originals for images/media already persisted above.
        if (isImageFile && persistedStorageKey) {
          await db.update(files)
            .set({ status: 'processed' })
            .where(eq(files.id, fileId));
        }
        logger.warn(`Queue not available for file ${fileId} - document will need manual processing`);
        
        const response = {
          fileId,
          id: fileId, // For compatibility with frontend
          filename: data.filename,
          size: data.file.bytesRead,
          status: isImageFile && persistedStorageKey ? 'processed' : 'uploaded',
          url: `/api/files/${fileId}/download`, // URL for attachment reference
          message: isImageFile && persistedStorageKey
            ? 'Image uploaded and retained for creatives'
            : 'File uploaded successfully. Background processing unavailable - use reprocess endpoint.',
          storageKey: persistedStorageKey,
        };

        reply.send(response);
      }
      
    } catch (error) {
      logger.error('File upload error:', error);
      reply.status(500).send({
        error: 'Upload failed',
        message: 'An error occurred while uploading the file'
      });
    }
  });

  // Download file
  fastify.get('/:fileId/download', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Download an uploaded file',
      tags: ['files'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' }
        },
        required: ['fileId']
      }
    }
  }, async (request, reply) => {
    try {
      const { fileId } = request.params as { fileId: string };
      
      const userId = (request as any).user.id;

      // Get file record from database
      const fileRecord = await db.query.files.findFirst({
        where: eq(files.id, fileId)
      });

      if (!fileRecord) {
        return reply.status(404).send({
          error: 'File not found',
          message: 'The requested file does not exist'
        });
      }

      if (fileRecord.userId && fileRecord.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied', message: 'You do not own this file' });
      }

      const storageKey = (fileRecord as any).storageKey as string | null | undefined;

      if (!storageKey) {
        return reply.status(404).send({
          error: 'File not available',
          message: 'The original file was not retained during processing. Only extracted text and embeddings are stored.',
        });
      }

      // If the storage provider supports presigned URLs (R2 / S3), redirect the client
      // directly — avoids proxying large files through Railway.
      if (typeof storageProvider.getPresignedUrl === 'function') {
        const presignedUrl = await storageProvider.getPresignedUrl(storageKey, 900); // 15-minute URL
        return reply.redirect(302, presignedUrl);
      }

      // Volume storage — stream the file through the backend
      const fileBuffer = await storageProvider.downloadFile(storageKey);
      reply
        .header('Content-Type', fileRecord.mimetype)
        .header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.originalName ?? fileRecord.filename)}"`)
        .header('Content-Length', String(fileBuffer.length))
        .send(fileBuffer);

    } catch (error) {
      logger.error('File download error:', error);
      reply.status(500).send({
        error: 'Download failed',
        message: 'An error occurred while retrieving the file'
      });
    }
  });

  // Inline preview (gallery thumbnails) — always stream through backend so browser fetch works with R2/S3
  fastify.get('/:fileId/preview', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Inline preview of an uploaded image (proxied, no redirect)',
      tags: ['files'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
        },
        required: ['fileId'],
      },
    },
  }, async (request, reply) => {
    try {
      const { fileId } = request.params as { fileId: string };
      const userId = (request as any).user.id;

      const fileRecord = await db.query.files.findFirst({
        where: eq(files.id, fileId),
      });

      if (!fileRecord) {
        return reply.status(404).send({
          error: 'File not found',
          message: 'The requested file does not exist',
        });
      }

      if (fileRecord.userId && fileRecord.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied', message: 'You do not own this file' });
      }

      const storageKey = (fileRecord as any).storageKey as string | null | undefined;
      if (!storageKey) {
        return reply.status(404).send({
          error: 'File not available',
          message: 'Original bytes were not retained. Re-generate or re-upload this creative.',
        });
      }

      const fileBuffer = await storageProvider.downloadFile(storageKey);
      const mime = fileRecord.mimetype?.startsWith('image/')
        ? fileRecord.mimetype
        : 'image/png';

      reply
        .header('Content-Type', mime)
        .header('Content-Disposition', 'inline')
        .header('Cache-Control', 'private, max-age=3600')
        .header('Content-Length', String(fileBuffer.length))
        .send(fileBuffer);
    } catch (error) {
      logger.error('File preview error:', error);
      reply.status(500).send({
        error: 'Preview failed',
        message: 'An error occurred while retrieving the preview',
      });
    }
  });

  // Get file status
  fastify.get('/:fileId/status', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get processing status of an uploaded file',
      tags: ['files'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' }
        },
        required: ['fileId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            filename: { type: 'string' },
            originalName: { type: 'string' },
            mimetype: { type: 'string' },
            size: { type: 'number' },
            status: { type: 'string' },
            uploadDate: { type: 'string' },
            processingDate: { type: 'string' },
            chunks: { type: 'number' },
            storageUrl: { type: 'string' },
            storageKey: { type: 'string' },
            storageProvider: { type: 'string' },
            error: { type: 'string' },
            processingStage: { type: 'string' },
            indexingStatus: { type: 'string' },
            keywordSearchAvailable: { type: 'boolean' },
            vectorSearchAvailable: { type: 'boolean' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const userId = (request as any).user.id;

    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) {
      return reply.status(404).send({ error: 'Not found', message: 'File not found' });
    }

    if (file.userId && file.userId !== userId) {
      return reply.status(403).send({ error: 'Access denied', message: 'You do not own this file' });
    }

    // Count chunks for this file
    const [chunkCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks)
      .where(eq(documentChunks.fileId, fileId));

    return reply.send(FileMetadataSchema.parse({
      id: file.id,
      filename: file.originalName,
      originalName: file.originalName,
      mimetype: file.mimetype,
      size: file.size,
      status: file.status,
      uploadDate: file.createdAt.toISOString(),
      processingDate: file.updatedAt?.toISOString(),
      chunks: Number(chunkCount?.count ?? 0),
      storageUrl: file.storageUrl ?? undefined,
      storageKey: file.storageKey ?? undefined,
      storageProvider: file.storageProvider ?? undefined,
      error: file.processingError ?? undefined,
      processingStage: (file.metadata as any)?.processingStage,
      indexingStatus: (file.metadata as any)?.indexingStatus,
      keywordSearchAvailable: (file.metadata as any)?.keywordSearchAvailable,
      vectorSearchAvailable: (file.metadata as any)?.vectorSearchAvailable,
    }));
  });

  // List uploaded files
  fastify.get('/', {
    preHandler: [authenticateToken],
    schema: {
      description: 'List all uploaded files',
      tags: ['files'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 100 },
          status: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  filename: { type: 'string' },
                  originalName: { type: 'string' },
                  mimetype: { type: 'string' },
                  size: { type: 'number' },
                  status: { type: 'string' },
                  uploadDate: { type: 'string' },
                  processingDate: { type: 'string' },
                  chunks: { type: 'number' },
                  storageUrl: { type: 'string' },
                  storageKey: { type: 'string' },
                  storageProvider: { type: 'string' },
                  processingStage: { type: 'string' },
                  indexingStatus: { type: 'string' },
                  keywordSearchAvailable: { type: 'boolean' },
                  vectorSearchAvailable: { type: 'boolean' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                pages: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 100, status } = request.query as {
      page?: number;
      limit?: number;
      status?: string
    };
    const userId = (request as any).user.id;

    try {
      // Query actual database with pagination
      const offset = (page - 1) * limit;

      // Build query conditions — always scoped to this user
      const userFilter = eq(files.userId, userId);
      const whereCondition = (status && ['uploaded', 'processing', 'processed', 'failed'].includes(status))
        ? and(userFilter, eq(files.status, status as 'uploaded' | 'processing' | 'processed' | 'failed'))
        : userFilter;

      // Get total count
      const totalResult = await db.select().from(files).where(whereCondition);
      const total = totalResult.length;

      // Get paginated files
      const filesList = await db
        .select()
        .from(files)
        .where(whereCondition)
        .orderBy(desc(files.createdAt))
        .limit(limit)
        .offset(offset);
      
      // Get chunk counts for all files and correct status for documents with chunks
      const fileIds = filesList.map(f => f.id);
      
      // Create a map of fileId -> chunk count using efficient query
      const chunkCountMap = new Map<string, number>();
      if (fileIds.length > 0) {
        try {
          // Get chunk counts for all files in one query
          const chunkCounts = await db
            .select({
              fileId: documentChunks.fileId,
              count: sql<number>`count(*)`.as('count')
            })
            .from(documentChunks)
            .where(inArray(documentChunks.fileId, fileIds))
            .groupBy(documentChunks.fileId);
          
          // Populate the map
          chunkCounts.forEach(result => {
            if (result.fileId) {
              chunkCountMap.set(result.fileId, Number(result.count));
            }
          });
        } catch (chunkCountError) {
          logger.error('Failed to get chunk counts:', chunkCountError);
          // Continue without chunk counts - set all to 0
        }
      }
      
      // Transform files to match expected format and correct status
      const transformedFiles = await Promise.all(filesList.map(async (file) => {
        const chunkCount = chunkCountMap.get(file.id) || 0;
        
        // CRITICAL FIX: If document has chunks but status is "failed", correct it to "processed"
        // This handles cases where indexing failed but chunks were created successfully
        let correctedStatus = file.status;
        if (file.status === 'failed' && chunkCount > 0) {
          logger.info(`Correcting status for file ${file.id}: has ${chunkCount} chunks but status is "failed", changing to "processed"`);
          correctedStatus = 'processed';
          
          // Update database to reflect correct status
          try {
            await db
              .update(files)
              .set({ 
                status: 'processed',
                processingError: null // Clear processing error since document is actually usable
              })
              .where(eq(files.id, file.id));
            logger.info(`Status corrected in database for file ${file.id}`);
          } catch (updateError) {
            logger.error(`Failed to update status in database for file ${file.id}:`, updateError);
            // Continue anyway - we'll return corrected status in API response
          }
        }
        
        return {
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          mimetype: file.mimetype,
          size: file.size,
          status: correctedStatus,
          uploadDate: file.createdAt?.toISOString(),
          processingDate: file.updatedAt?.toISOString(),
          chunks: chunkCount,
          storageUrl: file.storageUrl,
          storageKey: file.storageKey,
          storageProvider: file.storageProvider,
          processingStage: (file.metadata as any)?.processingStage,
          indexingStatus: (file.metadata as any)?.indexingStatus,
          keywordSearchAvailable: (file.metadata as any)?.keywordSearchAvailable,
          vectorSearchAvailable: (file.metadata as any)?.vectorSearchAvailable,
        };
      }));
      
      reply.send({
        files: transformedFiles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Failed to fetch files:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Error details:', { errorMessage, errorStack });
      reply.status(500).send({
        error: 'Failed to fetch files',
        message: errorMessage
      });
    }
  });

  // Reprocess file (generate embeddings for uploaded files)
  fastify.post('/:fileId/reprocess', {
    preHandler: [authenticateToken],
    schema: {
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' }
        },
        required: ['fileId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            fileId: { type: 'string' },
            status: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const userId = (request as any).user.id;

    try {
      // Get the file from database
      const file = await db.select().from(files).where(eq(files.id, fileId)).limit(1);

      if (file.length === 0) {
        return reply.status(404).send({
          error: 'File not found',
          message: `File with ID ${fileId} not found`
        });
      }

      const fileData = file[0];

      if (fileData.userId && fileData.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied', message: 'You do not own this file' });
      }

      if (fileData.status === 'processed') {
        return reply.status(400).send({
          error: 'File already processed',
          message: `File ${fileData.filename} is already processed`
        });
      }
      
      logger.info(`Reprocessing file ${fileId}: ${fileData.filename}`);
      
      // Update status to processing
      await db.update(files)
        .set({ status: 'processing' })
        .where(eq(files.id, fileId));
      
      // Get the actual file content from storage and extract real text
      let extractedText;
      
      try {
        // Try to get the file from storage
        const buffer = await storageProvider.downloadFile(fileData.storageKey || fileId);
        
        // Use the document processor to extract real text content
        const documentProcessor = new DocumentProcessor();
        extractedText = await documentProcessor.extractText(buffer, fileData.mimetype, fileData.filename);
        
        logger.info(`Successfully extracted text from ${fileData.filename}: ${extractedText.content.length} characters`);
      } catch (storageError) {
        logger.warn(`Could not access file storage for ${fileData.filename}, using filename-based content:`, storageError);
        
        // Fallback: create content based on filename for searchability
        if (fileData.mimetype.startsWith('text/') || fileData.filename.endsWith('.md') || fileData.filename.endsWith('.txt')) {
          extractedText = {
            content: `Document: ${fileData.filename} - Text file content not accessible for reprocessing.`,
            metadata: {
              pages: 1,
              language: 'en',
              wordCount: 10,
              characterCount: 80,
              originalFormat: fileData.mimetype
            }
          };
        } else {
          extractedText = {
            content: `File: ${fileData.filename} (${fileData.mimetype}) - Binary file uploaded to knowledge base.`,
            metadata: {
              pages: 1,
              language: 'en',
              wordCount: 8,
              characterCount: 60,
              originalFormat: fileData.mimetype
            }
          };
        }
      }
      
      // Create chunks from the extracted text
      const textChunks = createTextChunks(extractedText.content, 1000, 200);
      logger.info(`Created ${textChunks.length} chunks from ${fileData.filename}`);
      
      // Generate embeddings for each chunk using Cohere
      const embeddingService = new EmbeddingService();
      const chunkEmbeddings = await embeddingService.generateEmbeddings(textChunks);
      
      // Delete existing chunks for this file
      await db.delete(documentChunks).where(eq(documentChunks.fileId, fileId));
      
      // Store new chunks in database
      const chunkInserts = textChunks.map((chunk, index) => ({
        fileId: fileId,
        content: chunk,
        chunkIndex: index,
        metadata: {
          startChar: index * 800, // Approximate start position
          endChar: (index * 800) + chunk.length,
          section: `chunk-${index + 1}`,
          heading: index === 0 ? 'Introduction' : undefined
        },
        embedding: chunkEmbeddings[index].embedding
      }));
      
      await db.insert(documentChunks).values(chunkInserts);
      
      // Update file with processing results
      await db.update(files)
        .set({ 
          status: 'processed',
          metadata: {
            pages: extractedText.metadata.pages,
            language: extractedText.metadata.language,
            wordCount: extractedText.metadata.wordCount,
            characterCount: extractedText.metadata.characterCount,
            originalFormat: extractedText.metadata.originalFormat,
            extractedText: extractedText.content.substring(0, 1000), // Store first 1000 chars
            embeddingModel: chunkEmbeddings[0]?.model || 'cohere-embed-english-v3.0',
            chunks: textChunks.length,
            processingStage: 'ready',
            indexingStatus: 'completed',
            indexingFailed: false,
            indexedAt: new Date().toISOString(),
            keywordSearchAvailable: true,
            vectorSearchAvailable: true,
          }
        })
        .where(eq(files.id, fileId));
      
      logger.info(`File ${fileId} reprocessed successfully with ${textChunks.length} chunks`);
      
      reply.send({
        message: `File ${fileData.filename} reprocessed successfully`,
        fileId: fileId,
        status: 'processed'
      });
      
    } catch (error) {
      logger.error(`Failed to reprocess file ${fileId}:`, error);
      
      // Update status to failed
      await db.update(files)
        .set({ 
          status: 'failed',
          processingError: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(files.id, fileId));
      
      reply.status(500).send({
        error: 'Reprocessing failed',
        message: `Failed to reprocess file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Migrate file from volume storage to the currently configured object storage (R2/S3)
  fastify.post('/:fileId/migrate-storage', {
    preHandler: [authenticateToken],
    schema: {
      params: {
        type: 'object',
        properties: { fileId: { type: 'string' } },
        required: ['fileId'],
      },
    },
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const userId = (request as any).user.id;

    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (!file) return reply.status(404).send({ error: 'File not found' });

    if (file.storageProvider === config.storageProvider) {
      return { success: true, message: 'File is already on the current storage provider', migrated: false };
    }

    if (file.storageProvider !== 'volume') {
      return reply.status(400).send({ error: `Cannot migrate from ${file.storageProvider} — only volume → R2/S3 is supported` });
    }

    if (!file.storageKey) {
      return reply.status(400).send({ error: 'File has no storage key — it may not have been stored yet' });
    }

    try {
      const volumeStorage = new LocalFileStorage(config.storagePath);
      const buffer = await volumeStorage.downloadFile(file.storageKey);

      const newUrl = await storageProvider.uploadFile(buffer, file.storageKey, file.mimetype, {
        'user-id': userId,
        'file-id': fileId,
        'original-filename': file.originalName || file.filename,
      });

      await db
        .update(files)
        .set({ storageProvider: config.storageProvider as any, storageUrl: newUrl })
        .where(eq(files.id, fileId));

      logger.info(`Migrated file ${fileId} from volume → ${config.storageProvider}`);
      return { success: true, message: `File migrated to ${config.storageProvider}`, migrated: true };
    } catch (error) {
      logger.error(`Failed to migrate file ${fileId}:`, error);
      return reply.status(500).send({ error: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  // Delete file
  fastify.delete('/:fileId', {
    schema: {
      description: 'Delete an uploaded file and its associated data',
      tags: ['files'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' }
        },
        required: ['fileId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const userId = (request as any).user?.id;
    
    try {
      logger.info(`Deleting file: ${fileId} for user: ${userId}`);
      
      // First, check if the file exists and belongs to the user
      const fileData = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
      
      if (fileData.length === 0) {
        return reply.status(404).send({
          error: 'File not found',
          message: `File with ID ${fileId} does not exist`
        });
      }
      
      const file = fileData[0];
      
      // Verify user owns the file (unless user is admin or file has no userId)
      // Allow deletion if:
      // 1. User owns the file (file.userId === userId)
      // 2. User is admin
      // 3. File has no userId (legacy data or unauthenticated upload)
      if (userId && file.userId && file.userId !== userId && (request as any).user?.role !== 'admin') {
        return reply.status(403).send({
          error: 'Access denied',
          message: 'You do not have permission to delete this file'
        });
      }
      
      logger.info(`Deleting file ${fileId}: ${file.filename}`);
      
      // Clean up RAG search sessions that reference this file
      // Update sessions to remove this fileId from their documentIds array
      try {
        const sessionsWithFile = await db
          .select()
          .from(ragSearchSessions)
          .where(sql`${ragSearchSessions.documentIds}::text LIKE ${`%"${fileId}"%`}`);
        
        for (const session of sessionsWithFile) {
          const documentIds = (session.documentIds || []) as string[];
          const updatedIds = documentIds.filter(id => id !== fileId);
          
          if (updatedIds.length === 0) {
            // If no documents left, delete the session
            await db.delete(ragSearchSessions).where(eq(ragSearchSessions.id, session.id));
          } else {
            // Update session to remove this fileId
            await db
              .update(ragSearchSessions)
              .set({ documentIds: updatedIds })
              .where(eq(ragSearchSessions.id, session.id));
          }
        }
        logger.info(`Cleaned up RAG search sessions for file: ${fileId}`);
      } catch (ragError) {
        // Table might not exist or have different structure, continue anyway
        logger.warn(`Could not clean up RAG search sessions for file ${fileId}:`, ragError);
      }
      
      // Delete all document chunks associated with this file
      // Cascade should handle this automatically, but being explicit ensures it happens
      await db.delete(documentChunks).where(eq(documentChunks.fileId, fileId));
      logger.info(`Deleted document chunks for file: ${fileId}`);
      
      // Delete the file record from the database
      await db.delete(files).where(eq(files.id, fileId));
      logger.info(`Deleted file record: ${fileId}`);
      
      let storageCleanupWarning: string | undefined;

      // Delete the actual file from storage if storageKey exists
      if (file.storageKey) {
        try {
          await storageProvider.deleteFile(file.storageKey);
          logger.info(`Deleted file from storage: ${file.storageKey}`);
        } catch (storageError) {
          // Log but don't fail - file is already deleted from database
          logger.warn(`Failed to delete file from storage ${file.storageKey}:`, storageError);
          storageCleanupWarning = 'The database record was removed, but storage cleanup could not be confirmed. A background cleanup may still be needed.';
        }
      }
      
      reply.send({
        success: true,
        message: `File ${file.filename} deleted successfully`,
        storageCleanupWarning,
      });
      
    } catch (error) {
      logger.error(`Failed to delete file ${fileId}:`, error);
      
      // Check if it's a foreign key constraint error
      if (error instanceof Error && error.message.includes('foreign key')) {
        return reply.status(409).send({
          error: 'Cannot delete file',
          message: 'File is still referenced by other records. Please try again or contact support.'
        });
      }
      
      reply.status(500).send({
        error: 'Failed to delete file',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ── Media Lab endpoints ────────────────────────────────────────────────────

  fastify.get('/:fileId/transcript', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get transcript segments for a media file',
      tags: ['files'],
      params: { type: 'object', properties: { fileId: { type: 'string' } }, required: ['fileId'] },
    },
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const userId = (request as any).user?.id;

    const [file] = await db.select({ id: files.id, userId: files.userId })
      .from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) return reply.status(404).send({ error: 'File not found' });
    if (file.userId && file.userId !== userId && (request as any).user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const segments = await db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.fileId, fileId))
      .orderBy(transcriptSegments.sequenceIndex);

    return reply.send({ segments });
  });

  fastify.get('/:fileId/insights', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get AI-generated media insights for a media file',
      tags: ['files'],
      params: { type: 'object', properties: { fileId: { type: 'string' } }, required: ['fileId'] },
    },
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const userId = (request as any).user?.id;

    const [file] = await db.select({ id: files.id, userId: files.userId })
      .from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) return reply.status(404).send({ error: 'File not found' });
    if (file.userId && file.userId !== userId && (request as any).user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const insights = await db
      .select()
      .from(mediaInsights)
      .where(eq(mediaInsights.fileId, fileId))
      .orderBy(mediaInsights.insightType);

    return reply.send({ insights });
  });

  fastify.get('/:fileId/media-results', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get structured Media AI results for a media file',
      tags: ['files'],
      params: { type: 'object', properties: { fileId: { type: 'string' } }, required: ['fileId'] },
    },
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const userId = (request as any).user?.id;

    const [file] = await db.select({ id: files.id, userId: files.userId, metadata: files.metadata })
      .from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) return reply.status(404).send({ error: 'File not found' });
    if (file.userId && file.userId !== userId && (request as any).user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const [segments, insights, frames] = await Promise.all([
      db.select().from(transcriptSegments).where(eq(transcriptSegments.fileId, fileId)).orderBy(transcriptSegments.sequenceIndex),
      db.select().from(mediaInsights).where(eq(mediaInsights.fileId, fileId)).orderBy(mediaInsights.insightType),
      db.select().from(frameAnalyses).where(eq(frameAnalyses.fileId, fileId)).orderBy(frameAnalyses.timestampSec),
    ]);

    const metadata = (file as any).metadata || {};
    const intelligenceMode = resolveMediaIntelligenceMode(metadata.intelligenceMode as MediaIntelligenceMode | undefined);
    const payload = buildMediaResultsPayload(segments, insights, frames, intelligenceMode);

    return reply.send({
      ...payload,
      overview: {
        ...payload.overview,
        intelligenceMode,
      },
      knowledgeSync: {
        indexingStatus: metadata.indexingStatus || 'unavailable',
        keywordSearchAvailable: Boolean(metadata.keywordSearchAvailable),
        vectorSearchAvailable: Boolean(metadata.vectorSearchAvailable),
        syncedAt: metadata.mediaKnowledgeSyncedAt || metadata.indexedAt || null,
      },
    });
  });

  fastify.post('/:fileId/analyze-media', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Run or rerun Media AI analysis on a media file using a selected intelligence mode',
      tags: ['files'],
      params: { type: 'object', properties: { fileId: { type: 'string' } }, required: ['fileId'] },
      body: {
        type: 'object',
        properties: {
          intelligenceMode: { type: 'string', enum: ['balanced', 'conversation', 'sales', 'creator'] },
        },
      },
    },
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const userId = (request as any).user?.id;
    const parsed = AnalyzeMediaSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid analysis request', details: parsed.error.flatten() });
    }

    const intelligenceMode = parsed.data.intelligenceMode as MediaIntelligenceMode;

    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) return reply.status(404).send({ error: 'File not found' });
    if (file.userId && file.userId !== userId && (request as any).user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (!String(file.mimetype || '').startsWith('video/') && !String(file.mimetype || '').startsWith('audio/')) {
      return reply.status(400).send({ error: 'Media analysis is only supported for audio and video assets' });
    }

    if (!mediaProcessingQueue || !isQueueAvailable()) {
      return reply.status(503).send({
        error: 'Media processing unavailable',
        message: 'Background media processing is currently unavailable. Please try again shortly.',
      });
    }

    const metadata = (file.metadata || {}) as Record<string, any>;

    await db.update(files)
      .set({
        status: 'processing',
        processingError: null,
        metadata: {
          ...metadata,
          intelligenceMode,
          processingStage: 'uploaded',
          indexingFailed: false,
          indexingStatus: 'queued',
          vectorSearchAvailable: false,
          mediaAnalysisRequestedAt: new Date().toISOString(),
        } as any,
      })
      .where(eq(files.id, fileId));

    await mediaProcessingQueue.add('extract-audio' as any, {
      fileId,
      userId,
      jobType: 'extract_audio',
      insightModel: typeof metadata.insightModel === 'string' ? metadata.insightModel : undefined,
      intelligenceMode,
    });

    return reply.send({
      message: `Started ${intelligenceMode} media analysis`,
      fileId,
      intelligenceMode,
      status: 'processing',
    });
  });

  fastify.post('/:fileId/clips', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Render a clip from a media file using a selected timestamp range',
      tags: ['files'],
      params: { type: 'object', properties: { fileId: { type: 'string' } }, required: ['fileId'] },
      body: {
        type: 'object',
        properties: {
          startTime: { type: 'number' },
          endTime: { type: 'number' },
          title: { type: 'string' },
          sourceInsightId: { type: 'string' },
        },
        required: ['startTime', 'endTime'],
      },
    },
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const user = (request as any).user;
    const userId = user?.id;
    const parsed = CreateClipSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid clip request', details: parsed.error.flatten() });
    }

    const { startTime, endTime, title, sourceInsightId } = parsed.data;
    if (endTime <= startTime) {
      return reply.status(400).send({ error: 'Invalid clip range', message: 'endTime must be greater than startTime' });
    }

    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) return reply.status(404).send({ error: 'File not found' });
    if (file.userId && file.userId !== userId && user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Access denied' });
    }
    if (!String(file.mimetype || '').startsWith('video/') && !String(file.mimetype || '').startsWith('audio/')) {
      return reply.status(400).send({ error: 'Clip creation is only supported for media assets' });
    }

    const duration = Number((endTime - startTime).toFixed(3));
    const clipTitle = title?.trim() || `${file.originalName || file.filename} clip ${Math.floor(startTime / 60)}:${String(Math.floor(startTime % 60)).padStart(2, '0')}`;

    const [editPlan] = await db.insert(editPlans).values({
      userId,
      fileId,
      title: clipTitle,
      description: `Clip requested from ${startTime}s to ${endTime}s`,
      status: 'rendering',
      steps: [
        {
          id: crypto.randomUUID(),
          stepType: 'clip',
          order: 1,
          config: {
            startTime,
            endTime,
            sourceInsightId: sourceInsightId ?? null,
          },
        },
      ],
      metadata: {
        origin: 'media_results',
        sourceInsightId: sourceInsightId ?? null,
      },
    }).returning({ id: editPlans.id });

    try {
      const renderOutputId = await renderMediaClip({
        editPlanId: editPlan.id,
        fileId,
        startTime,
        endTime,
        userId,
      });

      const [renderOutput] = await db.select().from(renderOutputs).where(eq(renderOutputs.id, renderOutputId)).limit(1);
      await db.update(editPlans)
        .set({ status: 'done', updatedAt: new Date() })
        .where(eq(editPlans.id, editPlan.id));

      if (!renderOutput) {
        return reply.status(500).send({ error: 'Clip created but output record was not found' });
      }

      // Always return an authenticated API path so volume + cloud storage both work
      // from the frontend (Open clip uses an auth-bearing fetch, not a bare /storage URL).
      const downloadUrl = `/api/files/${fileId}/clips/${renderOutputId}/download`;

      return reply.send({
        renderOutputId,
        editPlanId: editPlan.id,
        title: clipTitle,
        startTime,
        endTime,
        duration,
        status: renderOutput.status,
        downloadUrl,
        sourceInsightId: sourceInsightId ?? null,
      });
    } catch (error) {
      await db.update(editPlans)
        .set({
          status: 'failed',
          updatedAt: new Date(),
          metadata: {
            origin: 'media_results',
            sourceInsightId: sourceInsightId ?? null,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
        .where(eq(editPlans.id, editPlan.id));

      logger.error(`Failed to create clip for file ${fileId}:`, error);
      return reply.status(500).send({
        error: 'Clip creation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // List rendered clips for a media file
  fastify.get('/:fileId/clips', {
    preHandler: [authenticateToken],
    schema: {
      description: 'List rendered clips for a media file',
      tags: ['files'],
      params: { type: 'object', properties: { fileId: { type: 'string' } }, required: ['fileId'] },
    },
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const user = (request as any).user;
    const userId = user?.id;

    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) return reply.status(404).send({ error: 'File not found' });
    if (file.userId && file.userId !== userId && user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const rows = await db
      .select({
        renderOutputId: renderOutputs.id,
        editPlanId: renderOutputs.editPlanId,
        format: renderOutputs.format,
        duration: renderOutputs.duration,
        sizeBytes: renderOutputs.sizeBytes,
        status: renderOutputs.status,
        createdAt: renderOutputs.createdAt,
        completedAt: renderOutputs.completedAt,
        title: editPlans.title,
        steps: editPlans.steps,
        metadata: editPlans.metadata,
      })
      .from(renderOutputs)
      .innerJoin(editPlans, eq(renderOutputs.editPlanId, editPlans.id))
      .where(and(
        eq(renderOutputs.fileId, fileId),
        eq(renderOutputs.format, 'mp4'),
        eq(renderOutputs.status, 'done'),
      ))
      .orderBy(desc(renderOutputs.createdAt));

    const clips = rows.map((row) => {
      const clipStep = Array.isArray(row.steps)
        ? row.steps.find((step) => step?.stepType === 'clip')
        : undefined;
      const startTime = typeof clipStep?.config?.startTime === 'number' ? clipStep.config.startTime : null;
      const endTime = typeof clipStep?.config?.endTime === 'number' ? clipStep.config.endTime : null;
      const sourceInsightId =
        (typeof clipStep?.config?.sourceInsightId === 'string' && clipStep.config.sourceInsightId)
        || (typeof row.metadata?.sourceInsightId === 'string' ? row.metadata.sourceInsightId : null);

      return {
        renderOutputId: row.renderOutputId,
        editPlanId: row.editPlanId,
        title: row.title,
        startTime,
        endTime,
        duration: row.duration ?? (startTime !== null && endTime !== null ? endTime - startTime : null),
        sizeBytes: row.sizeBytes,
        status: row.status,
        sourceInsightId,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        downloadUrl: `/api/files/${fileId}/clips/${row.renderOutputId}/download`,
      };
    });

    return reply.send({ clips, total: clips.length });
  });

  // Authenticated clip download (volume streams; R2/S3 redirect to presigned URL)
  fastify.get('/:fileId/clips/:renderOutputId/download', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Download a rendered media clip',
      tags: ['files'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
          renderOutputId: { type: 'string' },
        },
        required: ['fileId', 'renderOutputId'],
      },
    },
  }, async (request, reply) => {
    const { fileId, renderOutputId } = request.params as { fileId: string; renderOutputId: string };
    const user = (request as any).user;
    const userId = user?.id;

    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) return reply.status(404).send({ error: 'File not found' });
    if (file.userId && file.userId !== userId && user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const [renderOutput] = await db
      .select()
      .from(renderOutputs)
      .where(and(
        eq(renderOutputs.id, renderOutputId),
        eq(renderOutputs.fileId, fileId),
      ))
      .limit(1);

    if (!renderOutput) {
      return reply.status(404).send({ error: 'Clip not found' });
    }
    if (renderOutput.status !== 'done' || !renderOutput.storageKey) {
      return reply.status(409).send({
        error: 'Clip not ready',
        message: renderOutput.error || `Clip status is ${renderOutput.status}`,
      });
    }

    const [plan] = await db
      .select({ title: editPlans.title })
      .from(editPlans)
      .where(eq(editPlans.id, renderOutput.editPlanId))
      .limit(1);

    const safeTitle = (plan?.title || 'clip')
      .replace(/[^\w.\- ]+/g, '')
      .trim()
      .slice(0, 80) || 'clip';
    const filename = `${safeTitle}.mp4`;
    const disposition = (request.query as { disposition?: string })?.disposition === 'inline'
      ? 'inline'
      : 'attachment';

    // Always stream through the API so browser auth-fetch works for volume and R2/S3
    // (presigned redirects break CORS when opened via fetch + Authorization).
    const fileBuffer = await storageProvider.downloadFile(renderOutput.storageKey);
    return reply
      .header('Content-Type', 'video/mp4')
      .header('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`)
      .header('Content-Length', String(fileBuffer.length))
      .send(fileBuffer);
  });

}
