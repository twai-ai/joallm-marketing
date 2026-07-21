/**
 * Creative AI — image generation execution (Creative-0/1).
 * Studio calls this service; adapters talk to Ideogram / FLUX.
 * Outputs are ingested into Platform /api/files storage.
 *
 * @see docs/04-architecture/CREATIVE_AI_DIRECTION.md
 */

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
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
};

function isExecutable(id: string): id is ExecutableProvider {
  return (EXECUTABLE_PROVIDERS as readonly string[]).includes(id);
}

/** Map Generation Profile aspect / style → Ideogram aspect_ratio + FLUX size */
export function resolveDimensions(
  style: ImageGenerationStyle,
  aspectRatio?: string | null,
): { ideogramAspect: string; width: number; height: number; label: string } {
  const raw = (aspectRatio || '').trim().toLowerCase().replace(':', 'x');
  const presets: Record<string, { ideogramAspect: string; width: number; height: number; label: string }> = {
    '1x1': { ideogramAspect: '1x1', width: 1024, height: 1024, label: '1:1' },
    '3x4': { ideogramAspect: '3x4', width: 896, height: 1152, label: '3:4' },
    '4x3': { ideogramAspect: '4x3', width: 1152, height: 896, label: '4:3' },
    '16x9': { ideogramAspect: '16x9', width: 1344, height: 768, label: '16:9' },
    '9x16': { ideogramAspect: '9x16', width: 768, height: 1344, label: '9:16' },
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

async function generateWithIdeogram(options: {
  apiKey: string;
  prompt: string;
  quality: ImageGenerationQuality;
  ideogramAspect: string;
}): Promise<{ buffer: Buffer; contentType: string; modelId: string; sourceUrl: string }> {
  const form = new FormData();
  form.append('prompt', options.prompt);
  form.append('aspect_ratio', options.ideogramAspect);
  form.append('num_images', '1');
  form.append('magic_prompt', 'AUTO');
  form.append('style_type', 'DESIGN');
  form.append(
    'rendering_speed',
    options.quality === 'draft' ? 'TURBO' : options.quality === 'premium' ? 'QUALITY' : 'DEFAULT',
  );

  const res = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
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

  const url = payload.data?.[0]?.url;
  if (!url) {
    throw new Error('Ideogram returned no image URL');
  }

  const downloaded = await downloadImage(url);
  return {
    ...downloaded,
    modelId: 'ideogram-v3',
    sourceUrl: url,
  };
}

async function generateWithFlux(options: {
  apiKey: string;
  prompt: string;
  quality: ImageGenerationQuality;
  width: number;
  height: number;
}): Promise<{ buffer: Buffer; contentType: string; modelId: string; sourceUrl: string }> {
  // Cheaper/faster for drafts; pinned pro for standard/premium dogfood
  const modelId =
    options.quality === 'draft' ? 'flux-2-klein-4b' : 'flux-2-pro';

  const submit = await fetch(`https://api.bfl.ai/v1/${modelId}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'x-key': options.apiKey,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      width: options.width,
      height: options.height,
    }),
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
        modelId,
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
): Promise<{ provider: ExecutableProvider; apiKey: string; source: 'byok' | 'platform' }> {
  const candidates: ExecutableProvider[] = [];

  if (override && override !== 'auto') {
    if (!isExecutable(override)) {
      throw new Error(
        `Provider "${override}" is not wired yet. Use Auto, Ideogram, or FLUX.`,
      );
    }
    candidates.push(override);
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
 * Generate one marketing image and store it as a Platform file.
 */
export async function generateCreativeImage(
  input: GenerateImageInput,
): Promise<GeneratedImageFile> {
  const prompt = input.prompt.trim();
  if (prompt.length < 3) {
    throw new Error('Prompt is required');
  }

  const style: ImageGenerationStyle = input.style || 'marketing_poster';
  const quality: ImageGenerationQuality = input.quality || 'standard';
  const dims = resolveDimensions(style, input.aspectRatio);
  const { provider, apiKey, source } = await pickProvider(
    input.ownerUserId,
    style,
    input.providerOverride,
  );

  const started = Date.now();
  logger.info('Creative AI generate start', {
    userId: input.ownerUserId,
    provider,
    keySource: source,
    style,
    quality,
    aspect: dims.label,
  });

  let generated: { buffer: Buffer; contentType: string; modelId: string; sourceUrl: string };

  try {
    if (provider === 'ideogram') {
      generated = await generateWithIdeogram({
        apiKey,
        prompt,
        quality,
        ideogramAspect: dims.ideogramAspect,
      });
    } else {
      generated = await generateWithFlux({
        apiKey,
        prompt,
        quality,
        width: dims.width,
        height: dims.height,
      });
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
  const filename = `${safeTitle}-${provider}-${randomUUID().slice(0, 8)}`;

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
      ...(input.metadata || {}),
    },
  });

  const latencyMs = Date.now() - started;
  logger.info('Creative AI generate succeeded', {
    userId: input.ownerUserId,
    provider,
    fileId,
    latencyMs,
  });

  return {
    fileId,
    provider,
    modelId: generated.modelId,
    prompt,
    style,
    quality,
    latencyMs,
    sourceUrl: generated.sourceUrl,
  };
}
