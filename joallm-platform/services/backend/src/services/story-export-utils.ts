/**
 * Shared helpers for Story exports (PPTX / ZIP / arc ordering).
 */

import { deflateRawSync } from 'zlib';

export type ArcRole = 'context' | 'proof' | 'ask' | 'other';

const ARC_ORDER: ArcRole[] = ['context', 'proof', 'ask', 'other'];

export function sortBeatsByStoryArc<T extends { order: number; arcRole?: string | null }>(
  beats: T[],
): T[] {
  return [...beats].sort((a, b) => {
    const ai = ARC_ORDER.indexOf((a.arcRole as ArcRole) || 'other');
    const bi = ARC_ORDER.indexOf((b.arcRole as ArcRole) || 'other');
    const aIdx = ai < 0 ? 99 : ai;
    const bIdx = bi < 0 ? 99 : bi;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.order - b.order;
  });
}

export function groupBeatsByArc<T extends { arcRole?: string | null }>(
  beats: T[],
): Record<ArcRole, T[]> {
  const groups: Record<ArcRole, T[]> = {
    context: [],
    proof: [],
    ask: [],
    other: [],
  };
  for (const beat of beats) {
    const role = (beat.arcRole && groups[beat.arcRole as ArcRole] ? beat.arcRole : 'other') as ArcRole;
    groups[role].push(beat);
  }
  return groups;
}

/** Read PNG/JPEG pixel size for non-stretching PPTX layout. */
export function readImagePixelSize(buffer: Buffer): { width: number; height: number } | null {
  try {
    if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }
    if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        const size = buffer.readUInt16BE(offset + 2);
        // SOF0 / SOF2
        if (marker === 0xc0 || marker === 0xc2) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        offset += 2 + size;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Fit image into a box without distortion (letterbox). Units are PPTX inches. */
export function fitImageInBox(
  pixelW: number,
  pixelH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): { x: number; y: number; w: number; h: number } {
  const aspect = pixelW / Math.max(pixelH, 1);
  let w = boxW;
  let h = w / aspect;
  if (h > boxH) {
    h = boxH;
    w = h * aspect;
  }
  return {
    x: boxX + (boxW - w) / 2,
    y: boxY + (boxH - h) / 2,
    w: Number(w.toFixed(3)),
    h: Number(h.toFixed(3)),
  };
}

export function safeExportSlug(value: string, fallback = 'beat'): string {
  return (
    value
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || fallback
  );
}

/** Minimal ZIP (store + deflate) without extra dependencies. */
export function buildZipArchive(
  entries: Array<{ name: string; data: Buffer }>,
): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const useDeflate = compressed.length < entry.data.length;
    const payload = useDeflate ? compressed : entry.data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    parts.push(local, nameBuf, payload);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc >>> 0, 16);
    cen.writeUInt32LE(payload.length, 20);
    cen.writeUInt32LE(entry.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);

    offset += local.length + nameBuf.length + payload.length;
  }

  const centralDir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, centralDir, end]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Clean Story field for exact Ideogram typography (never OCR). */
export function cleanStoryTypography(text: string | null | undefined, maxLen: number): string | undefined {
  if (!text?.trim()) return undefined;
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length > maxLen) return undefined;
  if (/[|]{2,}|\uFFFD|[{}]|https?:\/\//i.test(cleaned)) return undefined;
  return cleaned;
}
