import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';

type FfmpegEventCallback = () => void;
type FfprobeCallback = (error: Error | null, data: ReturnType<typeof makeProbeData> | null) => void;

// Mock fluent-ffmpeg and the ffmpeg installer before importing the service
vi.mock('fluent-ffmpeg', () => {
  const ffmpegMock = vi.fn(() => ({
    noVideo: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    audioFrequency: vi.fn().mockReturnThis(),
    audioChannels: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    seekInput: vi.fn().mockReturnThis(),
    duration: vi.fn().mockReturnThis(),
    on: vi.fn().mockImplementation(function (this: unknown, event: string, cb: FfmpegEventCallback) {
      if (event === 'end') setTimeout(() => cb(), 0);
      return this;
    }),
    run: vi.fn(),
  }));

  (ffmpegMock as any).setFfmpegPath = vi.fn();
  (ffmpegMock as any).setFfprobePath = vi.fn();
  (ffmpegMock as any).ffprobe = vi.fn();

  return { default: ffmpegMock };
});

vi.mock('@ffmpeg-installer/ffmpeg', () => ({
  default: { path: '/mock/ffmpeg', version: '6.0.0' },
}));

// Import after mocks are set up
import ffmpeg from 'fluent-ffmpeg';
import { extractMediaMetadata, withTempDir } from '../../../services/media-processing-service.js';

const mockFfprobe = ffmpeg.ffprobe as ReturnType<typeof vi.fn>;

function makeProbeData(overrides: Partial<{
  duration: number;
  bitRate: number;
  hasVideo: boolean;
  width: number;
  height: number;
  frameRate: string;
  videoCodec: string;
  audioCodec: string;
  audioChannels: number;
}> = {}): any {
  const {
    duration = 120.5,
    bitRate = 4000000,
    hasVideo = true,
    width = 1920,
    height = 1080,
    frameRate = '30/1',
    videoCodec = 'h264',
    audioCodec = 'aac',
    audioChannels = 2,
  } = overrides;

  const streams: any[] = [];

  if (hasVideo) {
    streams.push({
      codec_type: 'video',
      codec_name: videoCodec,
      width,
      height,
      r_frame_rate: frameRate,
    });
  }

  streams.push({
    codec_type: 'audio',
    codec_name: audioCodec,
    channels: audioChannels,
  });

  return {
    format: {
      duration: String(duration),
      bit_rate: String(bitRate),
    },
    streams,
  };
}

describe('media-processing-service', () => {
  beforeEach(() => {
    mockFfprobe.mockReset();
  });

  describe('extractMediaMetadata', () => {
    it('returns correct metadata for a video file', async () => {
      mockFfprobe.mockImplementation((_path: string, cb: FfprobeCallback) =>
        cb(null, makeProbeData()),
      );

      const meta = await extractMediaMetadata('/tmp/test.mp4');

      expect(meta.mediaType).toBe('video');
      expect(meta.duration).toBeCloseTo(120.5);
      expect(meta.width).toBe(1920);
      expect(meta.height).toBe(1080);
      expect(meta.fps).toBe(30);
      expect(meta.videoCodec).toBe('h264');
      expect(meta.audioCodec).toBe('aac');
      expect(meta.audioChannels).toBe(2);
      expect(meta.bitrate).toBe(4000); // kbps
    });

    it('returns mediaType audio when no video stream present', async () => {
      mockFfprobe.mockImplementation((_path: string, cb: FfprobeCallback) =>
        cb(null, makeProbeData({ hasVideo: false })),
      );

      const meta = await extractMediaMetadata('/tmp/test.mp3');

      expect(meta.mediaType).toBe('audio');
      expect(meta.width).toBeUndefined();
      expect(meta.height).toBeUndefined();
      expect(meta.fps).toBeUndefined();
      expect(meta.videoCodec).toBeUndefined();
      expect(meta.audioCodec).toBe('aac');
    });

    it('handles non-integer frame rates correctly', async () => {
      mockFfprobe.mockImplementation((_path: string, cb: FfprobeCallback) =>
        cb(null, makeProbeData({ frameRate: '60000/1001' })), // ~59.94 fps
      );

      const meta = await extractMediaMetadata('/tmp/test.mp4');
      expect(meta.fps).toBeCloseTo(59.94, 1);
    });

    it('handles missing frame rate gracefully', async () => {
      const probe = makeProbeData();
      probe.streams[0].r_frame_rate = undefined;
      mockFfprobe.mockImplementation((_path: string, cb: FfprobeCallback) =>
        cb(null, probe),
      );

      const meta = await extractMediaMetadata('/tmp/test.mp4');
      expect(meta.fps).toBeUndefined();
    });

    it('handles zero denominator in frame rate without crashing', async () => {
      mockFfprobe.mockImplementation((_path: string, cb: FfprobeCallback) =>
        cb(null, makeProbeData({ frameRate: '30/0' })),
      );

      const meta = await extractMediaMetadata('/tmp/test.mp4');
      expect(meta.fps).toBeUndefined();
    });

    it('handles missing duration gracefully', async () => {
      const probe = makeProbeData();
      probe.format.duration = undefined;
      mockFfprobe.mockImplementation((_path: string, cb: FfprobeCallback) =>
        cb(null, probe),
      );

      const meta = await extractMediaMetadata('/tmp/test.mp4');
      expect(meta.duration).toBe(0);
    });

    it('handles missing bitrate gracefully', async () => {
      const probe = makeProbeData();
      probe.format.bit_rate = undefined;
      mockFfprobe.mockImplementation((_path: string, cb: FfprobeCallback) =>
        cb(null, probe),
      );

      const meta = await extractMediaMetadata('/tmp/test.mp4');
      expect(meta.bitrate).toBeUndefined();
    });

    it('rejects when ffprobe returns an error', async () => {
      mockFfprobe.mockImplementation((_path: string, cb: FfprobeCallback) =>
        cb(new Error('ffprobe failed'), null),
      );

      await expect(extractMediaMetadata('/tmp/bad.mp4')).rejects.toThrow('ffprobe failed');
    });
  });

  describe('withTempDir', () => {
    it('creates a temp dir, passes it to the callback, then removes it', async () => {
      let capturedDir = '';

      await withTempDir(async (dir) => {
        capturedDir = dir;
        expect(dir).toContain('joallm-media-');
        // Dir exists during callback
        const stat = await fs.stat(dir);
        expect(stat.isDirectory()).toBe(true);
      });

      // Dir should be gone after callback
      await expect(fs.stat(capturedDir)).rejects.toThrow();
    });

    it('cleans up the temp dir even when the callback throws', async () => {
      let capturedDir = '';

      await expect(
        withTempDir(async (dir) => {
          capturedDir = dir;
          throw new Error('callback error');
        }),
      ).rejects.toThrow('callback error');

      // Dir still cleaned up
      await expect(fs.stat(capturedDir)).rejects.toThrow();
    });

    it('returns the value from the callback', async () => {
      const result = await withTempDir(async (_dir) => 'hello');
      expect(result).toBe('hello');
    });
  });
});
