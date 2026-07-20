import { db } from '../database/connection.js';
import { files, renderOutputs, editPlans, transcriptSegments } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { storageProvider } from './file-storage.js';
import { renderClip, withTempDir } from './media-processing-service.js';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface RenderClipOptions {
  editPlanId: string;
  fileId: string;
  startTime: number;
  endTime: number;
  userId: string;
}

export interface RenderSubtitleOptions {
  editPlanId: string;
  fileId: string;
  userId: string;
}

/**
 * Render a clip from a media file and persist as a render_output record.
 */
export async function renderMediaClip(opts: RenderClipOptions): Promise<string> {
  const { editPlanId, fileId, startTime, endTime, userId } = opts;

  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file?.storageKey) throw new Error(`renderMediaClip: file ${fileId} has no storageKey`);

  // Create a pending render_output record
  const [record] = await db.insert(renderOutputs).values({
    editPlanId,
    fileId,
    storageKey: '',       // will be filled after upload
    storageProvider: config.storageProvider as 'volume' | 'cloudflare-r2' | 'aws-s3',
    format: 'mp4',
    status: 'rendering',
    metadata: {},
  }).returning({ id: renderOutputs.id });

  const renderOutputId = record.id;

  try {
    await withTempDir(async (tmpDir) => {
      const mediaExt = path.extname(file.filename) || '.mp4';
      const mediaTmp = path.join(tmpDir, `source${mediaExt}`);
      const clipTmp = path.join(tmpDir, `clip_${renderOutputId}.mp4`);

      logger.info(`Downloading source media ${file.storageKey} for clip render`);
      const buffer = await storageProvider.downloadFile(file.storageKey!);
      await fs.writeFile(mediaTmp, buffer);

      const duration = endTime - startTime;
      await renderClip(mediaTmp, clipTmp, startTime, duration);

      const clipBuffer = await fs.readFile(clipTmp);
      const clipStat = await fs.stat(clipTmp);
      const storageKey = `media/${userId}/${fileId}/renders/${renderOutputId}.mp4`;

      await storageProvider.uploadFile(clipBuffer, storageKey, 'video/mp4', {
        'file-id': fileId,
        'render-output-id': renderOutputId,
        'edit-plan-id': editPlanId,
      });

      await db.update(renderOutputs)
        .set({
          storageKey,
          duration,
          sizeBytes: clipStat.size,
          status: 'done',
          completedAt: new Date(),
        })
        .where(eq(renderOutputs.id, renderOutputId));

      logger.info(`✓ Clip render complete: ${storageKey} (${clipStat.size} bytes)`);
    });

  } catch (error) {
    await db.update(renderOutputs)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(renderOutputs.id, renderOutputId));
    throw error;
  }

  return renderOutputId;
}

/**
 * Export transcript as SRT subtitle file and persist as a render_output record.
 */
export async function exportSubtitleSRT(opts: RenderSubtitleOptions): Promise<string> {
  const { editPlanId, fileId, userId } = opts;

  const segments = await db
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.fileId, fileId))
    .orderBy(transcriptSegments.sequenceIndex);

  if (segments.length === 0) throw new Error(`exportSubtitleSRT: no transcript segments for ${fileId}`);

  const [record] = await db.insert(renderOutputs).values({
    editPlanId,
    fileId,
    storageKey: '',
    storageProvider: config.storageProvider as 'volume' | 'cloudflare-r2' | 'aws-s3',
    format: 'srt',
    status: 'rendering',
    metadata: {},
  }).returning({ id: renderOutputs.id });

  const renderOutputId = record.id;

  try {
    const srt = buildSRT(segments);
    const srtBuffer = Buffer.from(srt, 'utf-8');
    const storageKey = `media/${userId}/${fileId}/renders/${renderOutputId}.srt`;

    await storageProvider.uploadFile(srtBuffer, storageKey, 'text/plain', {
      'file-id': fileId,
      'render-output-id': renderOutputId,
    });

    await db.update(renderOutputs)
      .set({
        storageKey,
        sizeBytes: srtBuffer.length,
        status: 'done',
        completedAt: new Date(),
      })
      .where(eq(renderOutputs.id, renderOutputId));

    logger.info(`✓ SRT export complete: ${storageKey}`);

  } catch (error) {
    await db.update(renderOutputs)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(renderOutputs.id, renderOutputId));
    throw error;
  }

  return renderOutputId;
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function buildSRT(segments: Array<{ startTime: number; endTime: number; text: string }>): string {
  return segments
    .map((seg, i) =>
      `${i + 1}\n${formatSRTTime(seg.startTime)} --> ${formatSRTTime(seg.endTime)}\n${seg.text.trim()}\n`,
    )
    .join('\n');
}
