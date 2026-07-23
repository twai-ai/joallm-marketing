/**
 * Resolve image bytes from volume/R2, with DB inline fallback when the volume
 * was reset or STORAGE_PATH is not on a persistent mount.
 */
import { storageProvider } from './file-storage.js';
import { logger } from '../utils/logger.js';

/** Keep Story/Creative AI images readable even if the Railway volume is ephemeral. */
export const MAX_INLINE_IMAGE_BYTES = 6 * 1024 * 1024;

export type FileBytesRow = {
  id: string;
  originalName?: string | null;
  filename?: string | null;
  mimetype?: string | null;
  storageKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function buildInlineImageMetadata(
  buffer: Buffer,
  contentType: string,
  existing?: Record<string, unknown> | null,
): Record<string, unknown> {
  const meta: Record<string, unknown> = { ...(existing || {}) };
  if (buffer.length > 0 && buffer.length <= MAX_INLINE_IMAGE_BYTES) {
    meta.inlineBase64 = buffer.toString('base64');
    meta.inlineContentType = contentType.startsWith('image/') ? contentType : 'image/png';
    meta.inlineBytes = buffer.length;
    meta.inlineStoredAt = new Date().toISOString();
  } else {
    delete meta.inlineBase64;
    delete meta.inlineContentType;
    delete meta.inlineBytes;
    delete meta.inlineStoredAt;
    if (buffer.length > MAX_INLINE_IMAGE_BYTES) {
      meta.inlineSkippedReason = `Image larger than ${MAX_INLINE_IMAGE_BYTES} bytes — relies on volume storage`;
    }
  }
  return meta;
}

export function readInlineImageBytes(
  metadata?: Record<string, unknown> | null,
): { buffer: Buffer; contentType: string } | null {
  const raw = metadata?.inlineBase64;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.length) return null;
    const contentType =
      typeof metadata?.inlineContentType === 'string' && metadata.inlineContentType.startsWith('image/')
        ? metadata.inlineContentType
        : 'image/png';
    return { buffer, contentType };
  } catch {
    return null;
  }
}

/**
 * Prefer volume/object storage; fall back to DB-inline bytes for Story / Creative AI.
 */
export async function resolveFileImageBytes(
  row: FileBytesRow,
): Promise<{ buffer: Buffer; contentType: string; source: 'storage' | 'inline' }> {
  const contentType =
    row.mimetype && row.mimetype.startsWith('image/') ? row.mimetype : 'image/png';

  if (row.storageKey) {
    try {
      const buffer = await storageProvider.downloadFile(row.storageKey);
      if (buffer?.length) {
        return { buffer, contentType, source: 'storage' };
      }
    } catch (error) {
      logger.warn('Storage miss — trying DB inline image bytes', {
        fileId: row.id,
        storageKey: row.storageKey,
        name: row.originalName || row.filename,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const inline = readInlineImageBytes(row.metadata || null);
  if (inline) {
    return { ...inline, source: 'inline' };
  }

  throw Object.assign(
    new Error(
      `Image “${row.originalName || row.filename || row.id}” is missing from storage. Re-upload it in Story Assets, and set Railway STORAGE_PATH to a persistent volume mount.`,
    ),
    { statusCode: 404, code: 'STORAGE_OBJECT_MISSING' },
  );
}
