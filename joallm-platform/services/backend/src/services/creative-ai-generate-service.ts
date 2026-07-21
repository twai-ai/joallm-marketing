/**
 * Creative AI — image generation execution (Creative-0/1).
 * Studio calls this service; adapters talk to Ideogram / FLUX.
 * Outputs are ingested into Platform /api/files storage.
 *
 * @see docs/04-architecture/CREATIVE_AI_DIRECTION.md
 */

import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { files } from '../database/schema.js';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { storageProvider } from './file-storage.js';
import {
  preferredProvidersForStyle,
  type ImageGenerationProviderId,
  type ImageGenerationQuality,
  type ImageGenerationStyle,
} from './creative-ai-registry.js';
import { resolveCreativeProviderApiKey } from './creative-ai-keys.js';

const EXECUTABLE_PROVIDERS = ['ideogram', 'flux'] as const;
type ExecutableProvider = (typeof EXECUTABLE_PROVIDERS)[number];

export type GenerateImageInput = {
  ownerUserId: string;
  prompt: string;
  style?: ImageGenerationStyle;
  quality?: ImageGenerationQuality;
  providerOverride?: ImageGenerationProviderId | null;
  aspectRatio?: string | null;
  titleHint?: string;
  metadata?: Record<string, unknown>;
  /** Platform file ids used as style / edit references */
  referenceFileIds?: string[];
  /**
   * style — Ideogram style_reference_images (brand/look match)
   * edit — FLUX input_image remix / composition
   */
  referenceMode?: 'style' | 'edit';
  /** Ideogram transparent PNG path (logos / stickers / overlays) */
  transparentBackground?: boolean;
  /** How many variants to generate (1–4). Creates one Platform file each. */
  variantCount?: number;
};

export type GeneratedImageFile = {
  fileId: string;
  provider: ExecutableProvider;
  modelId: string;
  prompt: string;
  style: ImageGenerationStyle;
  quality: ImageGenerationQuality;
  latencyMs: number;
  sourceUrl?: string;
  referenceFileIds?: string[];
  referenceMode?: 'style' | 'edit';
  transparentBackground?: boolean;
};

export type GenerateCreativeBatchResult = {
  files: GeneratedImageFile[];
  provider: ExecutableProvider;
  modelId: string;
  style: ImageGenerationStyle;
  quality: ImageGenerationQuality;
  latencyMs: number;
  referenceFileIds?: string[];
  referenceMode?: 'style' | 'edit';
  transparentBackground?: boolean;
};

export type ReferenceImageBlob = {
  fileId: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
};

const MAX_REFERENCE_IMAGES = 4;

function isExecutable(id: string): id is ExecutableProvider {
  return (EXECUTABLE_PROVIDERS as readonly string[]).includes(id);
}

/** Map Generation Profile aspect / style → Ideogram aspect_ratio + FLUX size */
export function resolveDimensions(
  style: ImageGenerationStyle,
  aspectRatio?: string | null,
): { ideogramAspect: string; width: number; height: number; label: string } {
  const raw = (aspectRatio || '').trim().toLowerCase().replace(':', 'x');
  // Ideogram AspectRatioV3 + FLUX sizes (width/height multiples of 32)
  const presets: Record<string, { ideogramAspect: string; width: number; height: number; label: string }> = {
    '1x1': { ideogramAspect: '1x1', width: 1024, height: 1024, label: '1:1' },
    '2x3': { ideogramAspect: '2x3', width: 832, height: 1216, label: '2:3' },
    '3x2': { ideogramAspect: '3x2', width: 1216, height: 832, label: '3:2' },
    '3x4': { ideogramAspect: '3x4', width: 896, height: 1152, label: '3:4' },
    '4x3': { ideogramAspect: '4x3', width: 1152, height: 896, label: '4:3' },
    '4x5': { ideogramAspect: '4x5', width: 896, height: 1120, label: '4:5' },
    '5x4': { ideogramAspect: '5x4', width: 1120, height: 896, label: '5:4' },
    '9x16': { ideogramAspect: '9x16', width: 768, height: 1344, label: '9:16' },
    '16x9': { ideogramAspect: '16x9', width: 1344, height: 768, label: '16:9' },
    '10x16': { ideogramAspect: '10x16', width: 800, height: 1280, label: '10:16' },
    '16x10': { ideogramAspect: '16x10', width: 1280, height: 800, label: '16:10' },
  };

  if (raw && presets[raw]) return presets[raw];

  switch (style) {
    case 'marketing_poster':
    case 'infographic':
      return presets['3x4'];
    case 'hero_banner':
      return presets['16x9'];
    case 'social_media':
      return presets['1x1'];
    case 'logo':
      return presets['1x1'];
    case 'photo_realistic':
    case 'product_mockup':
      return presets['4x3'];
    default:
      return presets['3x4'];
  }
}

/** Studio-facing size catalog (shared with frontend via mirrored constants). */
export const CREATIVE_SIZE_PRESETS = [
  { id: '1x1', label: '1:1 Square', hint: 'Instagram / feed', ideogramAspect: '1x1' },
  { id: '4x5', label: '4:5 Portrait', hint: 'Instagram portrait', ideogramAspect: '4x5' },
  { id: '3x4', label: '3:4 Flyer', hint: 'Print / WhatsApp flyer', ideogramAspect: '3x4' },
  { id: '2x3', label: '2:3 Poster', hint: 'Tall poster', ideogramAspect: '2x3' },
  { id: '9x16', label: '9:16 Story', hint: 'Reels / Stories / Shorts', ideogramAspect: '9x16' },
  { id: '16x9', label: '16:9 Landscape', hint: 'YouTube / LinkedIn / banner', ideogramAspect: '16x9' },
  { id: '4x3', label: '4:3 Landscape', hint: 'Presentation / deck', ideogramAspect: '4x3' },
  { id: '3x2', label: '3:2 Photo', hint: 'Photo-like landscape', ideogramAspect: '3x2' },
  { id: '5x4', label: '5:4 Landscape', hint: 'Slightly wide', ideogramAspect: '5x4' },
  { id: '16x10', label: '16:10 Wide', hint: 'Wide hero', ideogramAspect: '16x10' },
] as const;

async function ingestGeneratedImage(options: {
  ownerUserId: string;
  buffer: Buffer;
  contentType: string;
  filename: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const ext =
    options.contentType.includes('png') ? 'png'
      : options.contentType.includes('webp') ? 'webp'
        : options.contentType.includes('jpeg') || options.contentType.includes('jpg') ? 'jpg'
          : 'png';
  const filename = options.filename.endsWith(`.${ext}`)
    ? options.filename
    : `${options.filename}.${ext}`;

  const [row] = await db
    .insert(files)
    .values({
      filename,
      originalName: filename,
      mimetype: options.contentType.startsWith('image/') ? options.contentType : 'image/png',
      size: options.buffer.length,
      status: 'processed',
      userId: options.ownerUserId,
      storageProvider: (config.storageProvider || 'volume') as 'volume' | 'cloudflare-r2' | 'aws-s3',
      metadata: {
        source: 'creative_ai',
        storeOriginal: true,
        ...(options.metadata || {}),
      } as any,
    })
    .returning({ id: files.id });

  const fileId = row.id;
  const storageKey = `creatives/${options.ownerUserId}/${fileId}/original.${ext}`;
  const storageUrl = await storageProvider.uploadFile(
    options.buffer,
    storageKey,
    options.contentType.startsWith('image/') ? options.contentType : 'image/png',
    {
      'user-id': options.ownerUserId,
      'file-id': fileId,
      'original-filename': encodeURIComponent(filename),
      source: 'creative_ai',
    },
  );

  await db
    .update(files)
    .set({
      storageKey,
      storageUrl,
      status: 'processed',
    })
    .where(eq(files.id, fileId));

  return fileId;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download generated image (${res.status})`);
  }
  const contentType = res.headers.get('content-type') || 'image/png';
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

/** Load owned image files from Platform storage for Creative AI reference inputs. */
export async function loadReferenceImages(
  ownerUserId: string,
  referenceFileIds: string[] | undefined,
): Promise<ReferenceImageBlob[]> {
  const ids = [...new Set((referenceFileIds || []).filter(Boolean))].slice(0, MAX_REFERENCE_IMAGES);
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.userId, ownerUserId), inArray(files.id, ids)));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const loaded: ReferenceImageBlob[] = [];

  for (const fileId of ids) {
    const row = byId.get(fileId);
    if (!row) {
      throw new Error(`Reference file not found: ${fileId}`);
    }
    if (!row.mimetype?.startsWith('image/')) {
      throw new Error(`Reference must be an image (${row.originalName || fileId})`);
    }
    if (!row.storageKey) {
      throw new Error(
        `Reference “${row.originalName || fileId}” has no stored image bytes. Re-upload it as a reference (older uploads did not retain image files).`,
      );
    }
    const buffer = await storageProvider.downloadFile(row.storageKey);
    loaded.push({
      fileId: row.id,
      filename: row.originalName || row.filename || `reference-${fileId}.png`,
      contentType: row.mimetype || 'image/png',
      buffer,
    });
  }

  return loaded;
}

function toBase64DataUrl(blob: ReferenceImageBlob): string {
  const mime = blob.contentType.startsWith('image/') ? blob.contentType : 'image/png';
  return `data:${mime};base64,${blob.buffer.toString('base64')}`;
}

async function generateWithIdeogram(options: {
  apiKey: string;
  prompt: string;
  quality: ImageGenerationQuality;
  ideogramAspect: string;
  references?: ReferenceImageBlob[];
  transparentBackground?: boolean;
  variantCount?: number;
}): Promise<Array<{ buffer: Buffer; contentType: string; modelId: string; sourceUrl: string }>> {
  const form = new FormData();
  form.append('prompt', options.prompt);
  form.append('aspect_ratio', options.ideogramAspect);
  form.append('num_images', String(Math.min(4, Math.max(1, options.variantCount || 1))));
  form.append('magic_prompt', 'AUTO');
  form.append(
    'rendering_speed',
    options.quality === 'draft' ? 'TURBO' : options.quality === 'premium' ? 'QUALITY' : 'DEFAULT',
  );

  const refs = options.references || [];
  if (refs.length > 0) {
    // style_reference_images cannot be combined with style_type / style_codes
    for (const ref of refs) {
      const bytes = new Uint8Array(ref.buffer);
      form.append(
        'style_reference_images',
        new Blob([bytes], { type: ref.contentType }),
        ref.filename,
      );
    }
  } else if (!options.transparentBackground) {
    form.append('style_type', 'DESIGN');
  }

  const endpoint = options.transparentBackground
    ? 'https://api.ideogram.ai/v1/ideogram-v3/generate-transparent'
    : 'https://api.ideogram.ai/v1/ideogram-v3/generate';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Api-Key': options.apiKey },
    body: form,
  });

  const payload = (await res.json().catch(() => ({}))) as {
    data?: Array<{ url?: string }>;
    detail?: string | { msg?: string };
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    const detail =
      typeof payload.detail === 'string'
        ? payload.detail
        : payload.detail?.msg || payload.message || payload.error || res.statusText;
    throw new Error(`Ideogram generate failed (${res.status}): ${detail}`);
  }

  const urls = (payload.data || []).map((item) => item.url).filter(Boolean) as string[];
  if (urls.length === 0) {
    throw new Error('Ideogram returned no image URL');
  }

  const modelId = options.transparentBackground
    ? refs.length > 0
      ? 'ideogram-v3-transparent+style-ref'
      : 'ideogram-v3-transparent'
    : refs.length > 0
      ? 'ideogram-v3+style-ref'
      : 'ideogram-v3';

  const outputs = [];
  for (const url of urls) {
    const downloaded = await downloadImage(url);
    outputs.push({
      ...downloaded,
      // Transparent endpoint returns PNG with alpha
      contentType: options.transparentBackground ? 'image/png' : downloaded.contentType,
      modelId,
      sourceUrl: url,
    });
  }
  return outputs;
}

async function generateWithFlux(options: {
  apiKey: string;
  prompt: string;
  quality: ImageGenerationQuality;
  width: number;
  height: number;
  references?: ReferenceImageBlob[];
}): Promise<{ buffer: Buffer; contentType: string; modelId: string; sourceUrl: string }> {
  // Image-conditioned edit works best on FLUX.2 pro family
  const refs = options.references || [];
  const modelId =
    refs.length > 0
      ? options.quality === 'draft'
        ? 'flux-2-pro'
        : 'flux-2-pro'
      : options.quality === 'draft'
        ? 'flux-2-klein-4b'
        : 'flux-2-pro';

  const body: Record<string, unknown> = {
    prompt: options.prompt,
    width: options.width,
    height: options.height,
  };

  refs.slice(0, 8).forEach((ref, index) => {
    const key = index === 0 ? 'input_image' : `input_image_${index + 1}`;
    body[key] = toBase64DataUrl(ref);
  });

  const submit = await fetch(`https://api.bfl.ai/v1/${modelId}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'x-key': options.apiKey,
    },
    body: JSON.stringify(body),
  });

  const submitted = (await submit.json().catch(() => ({}))) as {
    id?: string;
    polling_url?: string;
    detail?: string;
    message?: string;
  };

  if (!submit.ok) {
    throw new Error(
      `FLUX submit failed (${submit.status}): ${submitted.detail || submitted.message || submit.statusText}`,
    );
  }

  const pollingUrl = submitted.polling_url;
  if (!pollingUrl) {
    throw new Error('FLUX returned no polling_url');
  }

  const started = Date.now();
  const timeoutMs = 120_000;

  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 700));
    const poll = await fetch(pollingUrl, {
      headers: {
        accept: 'application/json',
        'x-key': options.apiKey,
      },
    });
    const result = (await poll.json().catch(() => ({}))) as {
      status?: string;
      result?: { sample?: string };
      detail?: string;
    };

    if (!poll.ok) {
      throw new Error(`FLUX poll failed (${poll.status}): ${result.detail || poll.statusText}`);
    }

    const status = result.status;
    if (status === 'Ready') {
      const sampleUrl = result.result?.sample;
      if (!sampleUrl) throw new Error('FLUX Ready but missing result.sample');
      const downloaded = await downloadImage(sampleUrl);
      return {
        ...downloaded,
        modelId: refs.length > 0 ? `${modelId}+ref` : modelId,
        sourceUrl: sampleUrl,
      };
    }

    if (
      status === 'Error' ||
      status === 'Failed' ||
      status === 'Request Moderated' ||
      status === 'Content Moderated'
    ) {
      throw new Error(`FLUX generation ${status}`);
    }
  }

  throw new Error('FLUX generation timed out');
}

async function pickProvider(
  userId: string,
  style: ImageGenerationStyle,
  override?: ImageGenerationProviderId | null,
  options?: {
    hasReferences?: boolean;
    referenceMode?: 'style' | 'edit';
    transparentBackground?: boolean;
  },
): Promise<{ provider: ExecutableProvider; apiKey: string; source: 'byok' | 'platform' }> {
  const candidates: ExecutableProvider[] = [];

  if (override && override !== 'auto') {
    if (!isExecutable(override)) {
      throw new Error(
        `Provider "${override}" is not wired yet. Use Auto, Ideogram, or FLUX.`,
      );
    }
    if (options?.transparentBackground && override === 'flux') {
      throw new Error('Transparent PNG is Ideogram-only. Switch provider to Ideogram or Auto.');
    }
    candidates.push(override);
  } else if (options?.transparentBackground) {
    candidates.push('ideogram');
  } else if (options?.hasReferences) {
    // Style match → Ideogram; edit/remix → FLUX
    if (options.referenceMode === 'edit') {
      candidates.push('flux', 'ideogram');
    } else {
      candidates.push('ideogram', 'flux');
    }
  } else {
    for (const id of preferredProvidersForStyle(style)) {
      if (isExecutable(id) && !candidates.includes(id)) candidates.push(id);
    }
    for (const id of EXECUTABLE_PROVIDERS) {
      if (!candidates.includes(id)) candidates.push(id);
    }
  }

  const missing: string[] = [];
  for (const provider of candidates) {
    const resolved = await resolveCreativeProviderApiKey(userId, provider);
    if (resolved.key) {
      return { provider, apiKey: resolved.key, source: resolved.source === 'byok' ? 'byok' : 'platform' };
    }
    missing.push(provider);
  }

  throw new Error(
    `No Creative AI key configured for ${missing.join(' / ')}. Set IDEOGRAM_API_KEY and/or BFL_API_KEY on the backend, or add BYOK in Settings.`,
  );
}

/**
 * Generate one or more marketing images and store them as Platform files.
 */
export async function generateCreativeImages(
  input: GenerateImageInput,
): Promise<GenerateCreativeBatchResult> {
  const prompt = input.prompt.trim();
  if (prompt.length < 3) {
    throw new Error('Prompt is required');
  }

  const style: ImageGenerationStyle = input.style || 'marketing_poster';
  const quality: ImageGenerationQuality = input.quality || 'standard';
  const referenceMode = input.referenceMode || 'style';
  const transparentBackground = Boolean(input.transparentBackground);
  const variantCount = Math.min(4, Math.max(1, input.variantCount || 1));
  const references = await loadReferenceImages(input.ownerUserId, input.referenceFileIds);
  const dims = resolveDimensions(style, input.aspectRatio);
  const { provider, apiKey, source } = await pickProvider(
    input.ownerUserId,
    style,
    input.providerOverride,
    {
      hasReferences: references.length > 0,
      referenceMode,
      transparentBackground,
    },
  );

  const started = Date.now();
  logger.info('Creative AI generate start', {
    userId: input.ownerUserId,
    provider,
    keySource: source,
    style,
    quality,
    aspect: dims.label,
    referenceCount: references.length,
    referenceMode: references.length ? referenceMode : undefined,
    transparentBackground,
    variantCount,
  });

  let outputs: Array<{ buffer: Buffer; contentType: string; modelId: string; sourceUrl: string }> = [];

  try {
    if (provider === 'ideogram') {
      outputs = await generateWithIdeogram({
        apiKey,
        prompt,
        quality,
        ideogramAspect: dims.ideogramAspect,
        references,
        transparentBackground,
        variantCount,
      });
    } else {
      // FLUX has no native multi-variant in one call — loop for variants
      for (let i = 0; i < variantCount; i += 1) {
        const one = await generateWithFlux({
          apiKey,
          prompt,
          quality,
          width: dims.width,
          height: dims.height,
          references,
        });
        outputs.push(one);
      }
    }
  } catch (error) {
    logger.error('Creative AI generate failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const safeTitle = (input.titleHint || 'creative')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'creative';

  const filesOut: GeneratedImageFile[] = [];
  for (let i = 0; i < outputs.length; i += 1) {
    const generated = outputs[i];
    const filename =
      outputs.length > 1
        ? `${safeTitle}-${provider}-v${i + 1}-${randomUUID().slice(0, 8)}`
        : `${safeTitle}-${provider}-${randomUUID().slice(0, 8)}`;

    const fileId = await ingestGeneratedImage({
      ownerUserId: input.ownerUserId,
      buffer: generated.buffer,
      contentType: generated.contentType,
      filename,
      metadata: {
        provider,
        modelId: generated.modelId,
        style,
        quality,
        prompt,
        aspectRatio: dims.label,
        keySource: source,
        referenceFileIds: references.map((r) => r.fileId),
        referenceMode: references.length ? referenceMode : undefined,
        transparentBackground: transparentBackground || undefined,
        variantIndex: i + 1,
        variantCount: outputs.length,
        ...(input.metadata || {}),
      },
    });

    filesOut.push({
      fileId,
      provider,
      modelId: generated.modelId,
      prompt,
      style,
      quality,
      latencyMs: Date.now() - started,
      sourceUrl: generated.sourceUrl,
      referenceFileIds: references.map((r) => r.fileId),
      referenceMode: references.length ? referenceMode : undefined,
      transparentBackground: transparentBackground || undefined,
    });
  }

  const latencyMs = Date.now() - started;
  logger.info('Creative AI generate succeeded', {
    userId: input.ownerUserId,
    provider,
    fileCount: filesOut.length,
    latencyMs,
  });

  return {
    files: filesOut,
    provider,
    modelId: filesOut[0]?.modelId || provider,
    style,
    quality,
    latencyMs,
    referenceFileIds: references.map((r) => r.fileId),
    referenceMode: references.length ? referenceMode : undefined,
    transparentBackground: transparentBackground || undefined,
  };
}

/** @deprecated Prefer generateCreativeImages — kept for single-file callers */
export async function generateCreativeImage(
  input: GenerateImageInput,
): Promise<GeneratedImageFile> {
  const batch = await generateCreativeImages(input);
  if (!batch.files[0]) {
    throw new Error('Generation returned no files');
  }
  return batch.files[0];
}
