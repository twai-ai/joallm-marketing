import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate, mockChatCreate, MockGroq, mockToFile, mockConfig } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  const mockChatCreate = vi.fn();
  const MockGroq = vi.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: mockCreate } },
    chat: { completions: { create: mockChatCreate } },
  }));
  const mockToFile = vi.fn().mockResolvedValue({ name: 'audio.wav' });
  const mockConfig = { groqApiKey: 'env-test-key' };
  return { mockCreate, mockChatCreate, MockGroq, mockToFile, mockConfig };
});

vi.mock('groq-sdk', () => ({ default: MockGroq, toFile: mockToFile }));
vi.mock('../../../config/config.js', () => ({ config: mockConfig }));

import { transcribeAudio, verifyTranscriptLanguage } from '../../../services/transcription-service.js';

const MOCK_RESPONSE = {
  text: 'Hello world. This is a test.',
  language: 'en',
  duration: 5.2,
  segments: [
    { id: 0, start: 0.0, end: 2.1, text: ' Hello world.', avg_logprob: -0.23, no_speech_prob: 0.01 },
    { id: 1, start: 2.1, end: 5.2, text: ' This is a test.', avg_logprob: -0.18, no_speech_prob: 0.02 },
  ],
};

describe('transcription-service', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockChatCreate.mockReset();
    MockGroq.mockClear();
    mockConfig.groqApiKey = 'env-test-key'; // restore default before each test
  });

  describe('transcribeAudio', () => {
    it('returns correctly shaped segments from Groq response', async () => {
      mockCreate.mockResolvedValue(MOCK_RESPONSE);

      const result = await transcribeAudio(Buffer.from('fake-audio'), 'audio.wav');

      expect(result.provider).toBe('groq');
      expect(result.language).toBe('en');
      expect(result.duration).toBeCloseTo(5.2);
      expect(result.segments).toHaveLength(2);
    });

    it('maps segment fields correctly', async () => {
      mockCreate.mockResolvedValue(MOCK_RESPONSE);

      const result = await transcribeAudio(Buffer.from('x'), 'audio.wav');
      const [first, second] = result.segments;

      expect(first.startTime).toBe(0.0);
      expect(first.endTime).toBeCloseTo(2.1);
      expect(first.text).toBe('Hello world.');
      expect(first.sequenceIndex).toBe(0);
      expect(first.language).toBe('en');
      expect(first.metadata.avgLogprob).toBeCloseTo(-0.23);
      expect(first.metadata.noSpeechProb).toBeCloseTo(0.01);

      expect(second.sequenceIndex).toBe(1);
      expect(second.text).toBe('This is a test.');
    });

    it('converts avg_logprob to confidence between 0 and 1', async () => {
      mockCreate.mockResolvedValue(MOCK_RESPONSE);

      const result = await transcribeAudio(Buffer.from('x'), 'audio.wav');
      result.segments.forEach(seg => {
        expect(seg.confidence).toBeGreaterThan(0);
        expect(seg.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('handles empty segments array without throwing', async () => {
      mockCreate.mockResolvedValue({ ...MOCK_RESPONSE, segments: [] });

      const result = await transcribeAudio(Buffer.from('x'), 'audio.wav');
      expect(result.segments).toHaveLength(0);
    });

    it('defaults language to "en" when absent from response', async () => {
      const { language: _l, ...noLang } = MOCK_RESPONSE;
      mockCreate.mockResolvedValue(noLang);

      const result = await transcribeAudio(Buffer.from('x'), 'audio.wav');
      expect(result.language).toBe('en');
    });

    it('throws when no API key is configured', async () => {
      mockConfig.groqApiKey = '';

      await expect(
        transcribeAudio(Buffer.from('x'), 'audio.wav', {}),
      ).rejects.toThrow('No Groq API key available');
    });

    it('uses a provided userApiKey over the env key', async () => {
      mockCreate.mockResolvedValue(MOCK_RESPONSE);

      await transcribeAudio(Buffer.from('x'), 'audio.wav', { groq: 'custom-key' });

      expect(MockGroq).toHaveBeenCalledWith({ apiKey: 'custom-key' });
    });

    it('supports mime overrides and timestamp offsets for chunked transcription', async () => {
      mockCreate.mockResolvedValue({
        ...MOCK_RESPONSE,
        duration: 4.5,
        segments: [
          { id: 0, start: 0.0, end: 1.5, text: ' chunk one', avg_logprob: -0.2, no_speech_prob: 0.01 },
        ],
      });

      const result = await transcribeAudio(Buffer.from('x'), 'audio.mp3', undefined, {
        mimeType: 'audio/mpeg',
        timeOffsetSec: 120,
        sequenceOffset: 8,
      });

      expect(mockToFile).toHaveBeenCalledWith(Buffer.from('x'), 'audio.mp3', { type: 'audio/mpeg' });
      expect(result.segments[0]?.startTime).toBe(120);
      expect(result.segments[0]?.endTime).toBe(121.5);
      expect(result.segments[0]?.sequenceIndex).toBe(8);
      expect(result.duration).toBe(124.5);
    });

    it('propagates Groq API errors', async () => {
      mockCreate.mockRejectedValue(new Error('rate_limit_exceeded'));

      await expect(
        transcribeAudio(Buffer.from('x'), 'audio.wav'),
      ).rejects.toThrow('rate_limit_exceeded');
    });

    it('verifies Hindi from Devanagari transcript without needing model inference', async () => {
      const language = await verifyTranscriptLanguage([
        {
          startTime: 0,
          endTime: 3,
          text: 'नमस्ते दोस्तों आज हम एआई के बारे में बात करेंगे',
          sequenceIndex: 0,
          language: 'ur',
          metadata: {},
        },
      ]);

      expect(language).toBe('hi');
      expect(mockChatCreate).not.toHaveBeenCalled();
    });

    it('uses multilingual verification model for romanized Hindi/Urdu ambiguity', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ language: 'hi' }) } }],
      });

      const language = await verifyTranscriptLanguage([
        {
          startTime: 0,
          endTime: 3,
          text: 'Namaste doston aaj hum AI ke baare mein baat karenge',
          sequenceIndex: 0,
          language: 'ur',
          metadata: {},
        },
      ], undefined, 'ur');

      expect(language).toBe('hi');
      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'llama-3.3-70b-versatile',
        }),
      );
    });
  });
});
