import { describe, expect, it } from 'vitest';

import { enrichTranscriptSpeakers } from '../../../services/speaker-intelligence-service.js';
import type { TranscriptSegment } from '../../../services/transcription-service.js';

describe('speaker-intelligence-service', () => {
  it('preserves provider-supplied speaker labels', () => {
    const segments: TranscriptSegment[] = [
      { startTime: 0, endTime: 3, text: 'Welcome everyone.', speaker: 'Host', sequenceIndex: 0, language: 'en', metadata: {} },
      { startTime: 3, endTime: 7, text: 'Thanks for having me.', speaker: 'Guest', sequenceIndex: 1, language: 'en', metadata: {} },
    ];

    const result = enrichTranscriptSpeakers(segments);

    expect(result.strategy).toBe('provided');
    expect(result.speakersDetected).toBe(2);
    expect(result.segments[0].speaker).toBe('Host');
    expect(result.segments[1].speaker).toBe('Guest');
  });

  it('infers alternating dialogue turns for conversational transcripts', () => {
    const segments: TranscriptSegment[] = [
      { startTime: 0, endTime: 2, text: 'Welcome back to the podcast.', sequenceIndex: 0, language: 'en', metadata: {} },
      { startTime: 2.3, endTime: 4.5, text: 'Thanks for having me as your guest.', sequenceIndex: 1, language: 'en', metadata: {} },
      { startTime: 5.9, endTime: 8.3, text: 'What changed this quarter?', sequenceIndex: 2, language: 'en', metadata: {} },
      { startTime: 8.5, endTime: 12.4, text: 'We focused on shipping the onboarding refresh.', sequenceIndex: 3, language: 'en', metadata: {} },
      { startTime: 13.9, endTime: 16.2, text: 'How did customers react?', sequenceIndex: 4, language: 'en', metadata: {} },
      { startTime: 16.5, endTime: 20.2, text: 'They adopted it faster than the previous flow.', sequenceIndex: 5, language: 'en', metadata: {} },
    ];

    const result = enrichTranscriptSpeakers(segments);

    expect(result.strategy).toBe('heuristic_dialogue');
    expect(result.speakersDetected).toBe(2);
    expect(new Set(result.segments.map(segment => segment.speaker))).toEqual(new Set(['Speaker 1', 'Speaker 2']));
  });

  it('falls back to a single-speaker structure for monologues', () => {
    const segments: TranscriptSegment[] = [
      { startTime: 0, endTime: 4, text: 'Today I will walk through the product roadmap.', sequenceIndex: 0, language: 'en', metadata: {} },
      { startTime: 4.2, endTime: 8.1, text: 'First we improved ingest reliability.', sequenceIndex: 1, language: 'en', metadata: {} },
      { startTime: 8.3, endTime: 12.5, text: 'Then we upgraded long-form insight generation.', sequenceIndex: 2, language: 'en', metadata: {} },
    ];

    const result = enrichTranscriptSpeakers(segments);

    expect(result.strategy).toBe('single_speaker_default');
    expect(result.speakersDetected).toBe(1);
    expect(result.segments.every(segment => segment.speaker === 'Speaker 1')).toBe(true);
  });
});
