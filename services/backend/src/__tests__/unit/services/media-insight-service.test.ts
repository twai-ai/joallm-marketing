import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockChatCreate, mockMessagesCreate, mockConfig } = vi.hoisted(() => ({
  mockChatCreate: vi.fn(),
  mockMessagesCreate: vi.fn(),
  mockConfig: { groqApiKey: null as string | null, openaiApiKey: 'openai-test', anthropicApiKey: null as string | null },
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCreate } },
  })),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

vi.mock('../../../config/config.js', () => ({ config: mockConfig }));

import { generateMediaInsights } from '../../../services/media-insight-service.js';
import type { TranscriptSegment } from '../../../services/transcription-service.js';

const SEGMENTS: TranscriptSegment[] = [
  { startTime: 0, endTime: 5, text: 'Welcome to the podcast.', sequenceIndex: 0, language: 'en', metadata: {} },
  { startTime: 5, endTime: 15, text: 'Today we discuss AI trends.', sequenceIndex: 1, language: 'en', metadata: {} },
  { startTime: 15, endTime: 25, text: 'Key action item: review the paper by Friday.', sequenceIndex: 2, language: 'en', metadata: {} },
];

const VALID_RESPONSE = JSON.stringify({
  summary: { title: 'AI Trends Podcast', description: 'Overview of AI.', tags: ['ai', 'podcast'] },
  highlights: [{ title: 'Key quote', description: 'AI is changing everything.', startTime: 5, endTime: 10, score: 0.9, tags: ['ai'] }],
  key_moments: [{ title: 'Opening', description: 'Host introduces topic.', startTime: 0, endTime: 5, score: 0.7, tags: [] }],
  topics: [{ title: 'AI Trends', description: 'Current state of AI.', tags: ['ai'] }],
  action_items: [{ title: 'Review paper', description: 'Review the paper by Friday.', tags: ['task'] }],
});

describe('media-insight-service', () => {
  beforeEach(() => {
    mockChatCreate.mockReset();
    mockMessagesCreate.mockReset();
    mockConfig.openaiApiKey = 'openai-test';
    mockConfig.anthropicApiKey = null;
  });

  describe('generateMediaInsights', () => {
    it('generates insights using OpenAI when key is available', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: VALID_RESPONSE } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      });

      const result = await generateMediaInsights(SEGMENTS);

      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.insights.length).toBeGreaterThan(0);
      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('"media_type"'),
            }),
          ]),
        }),
      );
    });

    it('includes speaker-aware timeline entries when labels are available', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: VALID_RESPONSE } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      });

      await generateMediaInsights([
        { startTime: 0, endTime: 5, text: 'Welcome to the show.', speaker: 'Speaker 1', sequenceIndex: 0, language: 'en', metadata: {} },
        { startTime: 5, endTime: 10, text: 'Thanks for having me.', speaker: 'Speaker 2', sequenceIndex: 1, language: 'en', metadata: {} },
      ]);

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Speaker 1'),
            }),
          ]),
        }),
      );
    });

    it('falls back to Anthropic when no OpenAI key', async () => {
      mockConfig.openaiApiKey = '';
      mockConfig.anthropicApiKey = 'anthropic-test';
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: VALID_RESPONSE }],
        usage: { input_tokens: 80, output_tokens: 150 },
      });

      const result = await generateMediaInsights(SEGMENTS);

      expect(result.provider).toBe('anthropic');
      expect(result.insights.length).toBeGreaterThan(0);
    });

    it('throws when no provider key is available', async () => {
      mockConfig.openaiApiKey = '';
      mockConfig.anthropicApiKey = null;

      await expect(generateMediaInsights(SEGMENTS)).rejects.toThrow(
        'No LLM API key available',
      );
    });

    it('returns a summary insight', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: VALID_RESPONSE } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      });

      const result = await generateMediaInsights(SEGMENTS);
      const summary = result.insights.find(i => i.insightType === 'summary');

      expect(summary).toBeDefined();
      expect(summary?.title).toBe('AI Trends Podcast');
      expect(summary?.tags).toContain('ai');
    });

    it('returns highlight insights with time ranges and scores', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: VALID_RESPONSE } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      });

      const result = await generateMediaInsights(SEGMENTS);
      const highlights = result.insights.filter(i => i.insightType === 'highlight');

      expect(highlights.length).toBeGreaterThan(0);
      highlights.forEach(h => {
        expect(h.startTime).toBeDefined();
        expect(h.endTime).toBeDefined();
        expect(h.score).toBeGreaterThanOrEqual(0);
        expect(h.score).toBeLessThanOrEqual(1);
      });
    });

    it('snaps invalid highlight timestamps back to transcript boundaries', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              summary: { title: 'Loose timestamps', description: 'Testing timestamp cleanup.', tags: [] },
              highlights: [{
                title: 'Off-range moment',
                description: 'A strong point outside expected bounds.',
                startTime: -10,
                endTime: 999,
                score: 1.4,
                tags: ['test'],
              }],
              key_moments: [],
              topics: [],
              action_items: [],
            }),
          },
        }],
        usage: { prompt_tokens: 60, completion_tokens: 80 },
      });

      const result = await generateMediaInsights(SEGMENTS);
      const highlight = result.insights.find(i => i.insightType === 'highlight');

      expect(highlight).toBeDefined();
      expect(highlight?.startTime).toBe(0);
      expect(highlight?.endTime).toBe(25);
      expect(highlight?.score).toBe(1);
    });

    it('filters weak action items that are not supported by the evidence', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              summary: { title: 'Weak action item', description: 'Testing unsupported tasks.', tags: [] },
              highlights: [],
              key_moments: [],
              topics: [],
              action_items: [{
                title: 'Launch the satellite program',
                description: 'Coordinate orbital approvals and space manufacturing.',
                tags: ['task'],
              }],
            }),
          },
        }],
        usage: { prompt_tokens: 50, completion_tokens: 70 },
      });

      const result = await generateMediaInsights(SEGMENTS);
      const actions = result.insights.filter(i => i.insightType === 'action_item');

      expect(actions).toHaveLength(0);
    });

    it('returns action items', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: VALID_RESPONSE } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      });

      const result = await generateMediaInsights(SEGMENTS);
      const actions = result.insights.filter(i => i.insightType === 'action_item');

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].title).toBe('Review paper');
    });

    it('returns empty array on malformed JSON without throwing', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'not valid json {{{' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await generateMediaInsights(SEGMENTS);
      expect(result.insights).toHaveLength(0);
    });

    it('strips Anthropic markdown fences before parsing', async () => {
      mockConfig.openaiApiKey = '';
      mockConfig.anthropicApiKey = 'anthropic-test';
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: '```json\n' + VALID_RESPONSE + '\n```' }],
        usage: { input_tokens: 80, output_tokens: 150 },
      });

      const result = await generateMediaInsights(SEGMENTS);
      expect(result.insights.length).toBeGreaterThan(0);
    });

    it('attaches model and token usage to insight metadata', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: VALID_RESPONSE } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      });

      const result = await generateMediaInsights(SEGMENTS);
      const insight = result.insights[0];

      expect(insight.metadata.model).toBe('gpt-4o-mini');
      expect(insight.metadata.promptTokens).toBe(100);
      expect(insight.metadata.completionTokens).toBe(200);
    });

    it('batches long transcripts and merges chunk insights', async () => {
      const longSegments: TranscriptSegment[] = Array.from({ length: 140 }, (_, index) => ({
        startTime: index * 10,
        endTime: index * 10 + 8,
        text: `Detailed discussion segment ${index} `.repeat(8).trim(),
        sequenceIndex: index,
        language: 'en',
        metadata: {},
      }));

      mockChatCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: { title: 'Part 1 Summary', description: 'First section recap.', tags: ['strategy', 'planning'] },
                highlights: [{ title: 'Opening highlight', description: 'Strong opening.', startTime: 10, endTime: 30, score: 0.95, tags: ['opening'] }],
                key_moments: [{ title: 'Pivot', description: 'Team changes direction.', startTime: 40, endTime: 55, score: 0.82, tags: ['pivot'] }],
                topics: [{ title: 'Roadmap', description: 'Roadmap discussion.', tags: ['planning'] }],
                action_items: [{ title: 'Write brief', description: 'Prepare the follow-up brief.', tags: ['task'] }],
              }),
            },
          }],
          usage: { prompt_tokens: 120, completion_tokens: 180 },
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: { title: 'Part 2 Summary', description: 'Second section recap.', tags: ['delivery', 'planning'] },
                highlights: [{ title: 'Closing highlight', description: 'Important close.', startTime: 600, endTime: 620, score: 0.9, tags: ['closing'] }],
                key_moments: [{ title: 'Decision', description: 'Decision is finalized.', startTime: 640, endTime: 660, score: 0.88, tags: ['decision'] }],
                topics: [{ title: 'Execution', description: 'Execution planning.', tags: ['delivery'] }],
                action_items: [{ title: 'Notify team', description: 'Share the final decision.', tags: ['task'] }],
              }),
            },
          }],
          usage: { prompt_tokens: 130, completion_tokens: 170 },
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: { title: 'Part 3 Summary', description: 'Third section recap.', tags: ['delivery'] },
                highlights: [{ title: 'Support highlight', description: 'Supporting context.', startTime: 900, endTime: 930, score: 0.7, tags: ['support'] }],
                key_moments: [],
                topics: [{ title: 'Support', description: 'Support planning.', tags: ['operations'] }],
                action_items: [],
              }),
            },
          }],
          usage: { prompt_tokens: 110, completion_tokens: 120 },
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: { title: 'Part 4 Summary', description: 'Fourth section recap.', tags: ['delivery'] },
                highlights: [{ title: 'Support highlight 2', description: 'Supporting context 2.', startTime: 1100, endTime: 1130, score: 0.68, tags: ['support'] }],
                key_moments: [],
                topics: [{ title: 'Support', description: 'Support planning.', tags: ['operations'] }],
                action_items: [],
              }),
            },
          }],
          usage: { prompt_tokens: 100, completion_tokens: 100 },
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: { title: 'Part 5 Summary', description: 'Fifth section recap.', tags: ['delivery'] },
                highlights: [{ title: 'Support highlight 3', description: 'Supporting context 3.', startTime: 1260, endTime: 1290, score: 0.67, tags: ['support'] }],
                key_moments: [],
                topics: [{ title: 'Support', description: 'Support planning.', tags: ['operations'] }],
                action_items: [],
              }),
            },
          }],
          usage: { prompt_tokens: 100, completion_tokens: 100 },
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: { title: 'Whole Asset Summary', description: 'Combined synthesis.', tags: ['strategy', 'delivery'] },
                highlights: [{ title: 'Final standout moment', description: 'Best cross-chunk moment.', startTime: 600, endTime: 620, score: 0.96, tags: ['decision'] }],
                key_moments: [{ title: 'Final decision', description: 'Best synthesized pivot.', startTime: 640, endTime: 660, score: 0.91, tags: ['decision'] }],
                topics: [{ title: 'Roadmap', description: 'Combined roadmap theme.', tags: ['planning'] }],
                action_items: [{ title: 'Notify team', description: 'Share the final decision.', tags: ['task'] }],
              }),
            },
          }],
          usage: { prompt_tokens: 140, completion_tokens: 160 },
        });

      const result = await generateMediaInsights(longSegments);
      const summaries = result.insights.filter(i => i.insightType === 'summary');
      const highlights = result.insights.filter(i => i.insightType === 'highlight');
      const topics = result.insights.filter(i => i.insightType === 'topic');

      expect(mockChatCreate.mock.calls.length).toBeGreaterThan(2);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].title).toBe('Whole Asset Summary');
      expect(highlights.length).toBeLessThanOrEqual(5);
      expect(topics.some(topic => topic.title === 'Roadmap')).toBe(true);
    });

    it('uses a second-pass synthesis prompt for multi-chunk analysis', async () => {
      const longSegments: TranscriptSegment[] = Array.from({ length: 130 }, (_, index) => ({
        startTime: index * 10,
        endTime: index * 10 + 8,
        text: `Discussion segment ${index} `.repeat(8).trim(),
        sequenceIndex: index,
        language: 'en',
        metadata: {},
      }));

      mockChatCreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: VALID_RESPONSE } }],
          usage: { prompt_tokens: 100, completion_tokens: 100 },
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: VALID_RESPONSE } }],
          usage: { prompt_tokens: 100, completion_tokens: 100 },
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: VALID_RESPONSE } }],
          usage: { prompt_tokens: 100, completion_tokens: 100 },
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: VALID_RESPONSE } }],
          usage: { prompt_tokens: 100, completion_tokens: 100 },
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: VALID_RESPONSE } }],
          usage: { prompt_tokens: 100, completion_tokens: 100 },
        });

      await generateMediaInsights(longSegments, undefined, { intelligenceMode: 'conversation' });

      expect(mockChatCreate.mock.calls.length).toBeGreaterThan(2);
      expect(mockChatCreate.mock.calls[mockChatCreate.mock.calls.length - 1][0]).toEqual(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('second-pass synthesis'),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('"chunk_summaries"'),
            }),
          ]),
        }),
      );
    });
  });
});
