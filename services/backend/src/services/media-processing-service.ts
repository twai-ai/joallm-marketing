import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { logger } from '../utils/logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { existsSync } from 'fs';

function configureFfmpegBinaries(): void {
  const configuredFfmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
  ffmpeg.setFfmpegPath(configuredFfmpegPath);

  const ffprobeCandidates = [
    process.env.FFPROBE_PATH,
    path.join(path.dirname(configuredFfmpegPath), 'ffprobe'),
    '/usr/bin/ffprobe',
    '/usr/local/bin/ffprobe',
  ].filter((candidate): candidate is string => Boolean(candidate));

  const ffprobePath = ffprobeCandidates.find(candidate => existsSync(candidate));
  if (ffprobePath) {
    ffmpeg.setFfprobePath(ffprobePath);
    logger.info(`Configured ffprobe path: ${ffprobePath}`);
  } else {
    logger.warn('ffprobe binary was not found during media service startup');
  }

  logger.info(`Configured ffmpeg path: ${configuredFfmpegPath}`);
}

configureFfmpegBinaries();

export interface MediaMetadata {
  duration: number;        // seconds
  mediaType: 'video' | 'audio';
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  bitrate?: number;        // kbps
}

export interface AudioChunk {
  path: string;
  startTime: number;
  duration: number;
  index: number;
}

function probeFile(filePath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function parseFps(rFrameRate?: string): number | undefined {
  if (!rFrameRate) return undefined;
  const [num, den] = rFrameRate.split('/').map(Number);
  if (!den) return undefined;
  return Math.round((num / den) * 100) / 100;
}

export async function extractMediaMetadata(filePath: string): Promise<MediaMetadata> {
  logger.info(`Probing media file: ${filePath}`);
  const probe = await probeFile(filePath);
  const format = probe.format;
  const videoStream = probe.streams.find(s => s.codec_type === 'video');
  const audioStream = probe.streams.find(s => s.codec_type === 'audio');

  return {
    duration: format.duration ? parseFloat(String(format.duration)) : 0,
    mediaType: videoStream ? 'video' : 'audio',
    width: videoStream?.width,
    height: videoStream?.height,
    fps: parseFps(videoStream?.r_frame_rate),
    videoCodec: videoStream?.codec_name,
    audioCodec: audioStream?.codec_name,
    audioChannels: audioStream?.channels,
    bitrate: format.bit_rate ? Math.round(parseInt(String(format.bit_rate)) / 1000) : undefined,
  };
}

/**
 * Extract audio track from a media file.
 * Outputs 16 kHz mono WAV — optimised for Whisper/Groq transcription.
 */
export async function extractAudio(
  inputPath: string,
  outputPath: string,
  format: 'wav' | 'mp3' | 'flac' = 'wav',
): Promise<string> {
  logger.info(`Extracting audio: ${inputPath} → ${outputPath}`);
  return new Promise((resolve, reject) => {
    const codec =
      format === 'wav' ? 'pcm_s16le' :
      format === 'mp3' ? 'libmp3lame' :
      'flac';

    ffmpeg(inputPath)
      .noVideo()
      .audioCodec(codec)
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Split an extracted audio file into smaller chunks for provider upload limits.
 */
export async function splitAudioForTranscription(
  inputPath: string,
  outputDir: string,
  chunkDurationSecs: number = 8 * 60,
  format: 'wav' | 'mp3' | 'flac' = 'mp3',
): Promise<AudioChunk[]> {
  const metadata = await extractMediaMetadata(inputPath);
  const totalDuration = metadata.duration;

  if (!Number.isFinite(totalDuration) || totalDuration <= chunkDurationSecs) {
    return [{
      path: inputPath,
      startTime: 0,
      duration: totalDuration || 0,
      index: 0,
    }];
  }

  await fs.mkdir(outputDir, { recursive: true });

  const extension = format === 'wav' ? 'wav' : format === 'flac' ? 'flac' : 'mp3';
  const chunks: AudioChunk[] = [];

  for (let index = 0, startTime = 0; startTime < totalDuration; index += 1, startTime += chunkDurationSecs) {
    const duration = Math.min(chunkDurationSecs, totalDuration - startTime);
    const chunkPath = path.join(outputDir, `audio_chunk_${String(index).padStart(3, '0')}.${extension}`);
    const codec =
      format === 'wav' ? 'pcm_s16le' :
      format === 'mp3' ? 'libmp3lame' :
      'flac';

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .noVideo()
        .audioCodec(codec)
        .audioFrequency(16000)
        .audioChannels(1)
        .output(chunkPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    chunks.push({
      path: chunkPath,
      startTime,
      duration,
      index,
    });
  }

  logger.info(`Split audio into ${chunks.length} chunk(s) for transcription`);
  return chunks;
}

/**
 * Extract frames from a video at a fixed interval.
 * Returns sorted list of output JPEG paths.
 */
export async function extractFrames(
  inputPath: string,
  outputDir: string,
  intervalSecs: number = 5,
): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const pattern = path.join(outputDir, 'frame_%04d.jpg');
  logger.info(`Extracting frames every ${intervalSecs}s: ${inputPath} → ${outputDir}`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([`-vf fps=1/${intervalSecs}`, '-q:v 2'])
      .output(pattern)
      .on('end', async () => {
        const entries = await fs.readdir(outputDir);
        const framePaths = entries
          .filter(f => f.endsWith('.jpg'))
          .sort()
          .map(f => path.join(outputDir, f));
        resolve(framePaths);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Cut a clip from a media file by start time and duration.
 * Uses stream copy (no re-encode) for speed.
 */
export async function renderClip(
  inputPath: string,
  outputPath: string,
  startSec: number,
  durationSec: number,
): Promise<string> {
  logger.info(`Rendering clip ${startSec}s+${durationSec}s: ${inputPath} → ${outputPath}`);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(startSec)
      .duration(durationSec)
      .outputOptions(['-c copy'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Create a temp dir, run fn, then clean up regardless of outcome.
 */
export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'joallm-media-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
