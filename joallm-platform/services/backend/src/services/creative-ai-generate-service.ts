/**
 * Creative AI — image generation execution (Creative-0/1).
 * Studio calls this service; adapters talk to Ideogram / FLUX.
 * Outputs are ingested into Platform /api/files storage.
 *
 * @see docs/04-architecture/CREATIVE_AI_DIRECTION.md
 */

import { randomUUID } from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { files } from '../database/schema.js';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { storageProvider } from './file-storage.js';
import { buildInlineImageMetadata, resolveFileImageBytes } from './file-bytes.js';
import {
  preferredProvidersForStyle,
  type ImageGenerationProviderId,
  type ImageGenerationQuality,
  type ImageGenerationStyle,
} from './creative-ai-registry.js';
import { resolveCreativeProviderApiKey } from './creative-ai-keys.js';
import { describeCreativeReferenceImages } from './vision-analysis-service.js';
import { userApiKeyRepository } from '../repositories/user-api-key-repository.js';
import { resolvePaletteColors } from './creative-palettes.js';
import { parseBrandTheme, type BrandThemeInput } from './creative-brand-theme.js';
import { canActorAccessOwnerResource } from './organization-ownership.js';
import { ATRISI_EXACT_TYPE_DIRECTION } from './atrisi-brand.js';
import {
  formatCreativeUsageSummary,
  recordCreativeImageUsage,
  type CreativeUsageRecord,
} from './creative-usage.js';

const EXECUTABLE_PROVIDERS = ['ideogram', 'flux'] as const;
type ExecutableProvider = (typeof EXECUTABLE_PROVIDERS)[number];

/** Optional structured brief — makes typography / CTA / exclusions precise */
export type PromptPrecision = {
  headline?: string;
  cta?: string;
  /** Exact copy that must appear in the creative (program name, dates, etc.) */
  mustIncludeText?: string;
  /**
   * When true: no on-image typography at all (Story overlays titles/captions separately).
   * Forces Magic Prompt OFF and strips OCR text from reference vision.
   */
  textFree?: boolean;
  /** Things to avoid (wrong logos, watermarks, clutter…) */
  avoid?: string;
  institutionName?: string;
  /** Optional structured brand theme JSON (palette + mood/layout rules) */
  brandTheme?: BrandThemeInput;
  /** Palette type id from creative-palettes catalog (fallback when no brandTheme palette) */
  paletteType?: string;
  /** Brand palette hex colors (#RRGGBB) — optional override */
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  /** Treat first reference as the official logo mark to incorporate */
  useLogoReference?: boolean;
  /** Filled server-side from vision analysis of reference images */
  referenceVisualContext?: string;
};

export type GenerateImageInput = {
  ownerUserId: string;
  prompt: string;
  style?: ImageGenerationStyle;
  quality?: ImageGenerationQuality;
  providerOverride?: ImageGenerationProviderId | null;
  aspectRatio?: string | null;
  titleHint?: string;
  metadata?: Record<string, unknown>;
  /** Structured fields merged into a provider-ready prompt */
  precision?: PromptPrecision;
  /** When true (default) and refs exist, Groq vision describes refs into the prompt */
  analyzeReferences?: boolean;
  /** Platform file ids used as style / edit references */
  referenceFileIds?: string[];
  /**
   * Inline reference images (base64) — preferred for Creative AI when
   * Platform file retention is unavailable or still deploying.
   */
  referenceImages?: Array<{
    filename: string;
    contentType: string;
    base64: string;
  }>;
  /**
   * style — Ideogram style_reference_images (brand/look match)
   * edit — FLUX input_image remix / composition
   */
  referenceMode?: 'style' | 'edit';
  /**
   * Analyze refs for subject/look, but do not attach images to Ideogram/FLUX.
   * Use with exact typography so source-photo lettering is not remixed into garbage.
   */
  visionOnlyReferences?: boolean;
  /**
   * Still attach these file ids to the provider even when visionOnlyReferences is set
   * (e.g. Brand logo / style kit without the beat photo).
   */
  providerReferenceFileIds?: string[];
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
  /** Estimated Ideogram/FLUX cost recorded to api_usage */
  usage?: CreativeUsageRecord | null;
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
  // Ideogram ResolutionV3 (premium) + FLUX 2 sizes (multiples of 16, ~1–2MP base)
  const presets: Record<string, { ideogramAspect: string; width: number; height: number; label: string }> = {
    '1x1': { ideogramAspect: '1x1', width: 1280, height: 1280, label: '1:1' },
    '2x3': { ideogramAspect: '2x3', width: 1088, height: 1632, label: '2:3' },
    '3x2': { ideogramAspect: '3x2', width: 1632, height: 1088, label: '3:2' },
    '3x4': { ideogramAspect: '3x4', width: 1088, height: 1440, label: '3:4' },
    '4x3': { ideogramAspect: '4x3', width: 1440, height: 1088, label: '4:3' },
    '4x5': { ideogramAspect: '4x5', width: 1088, height: 1360, label: '4:5' },
    '5x4': { ideogramAspect: '5x4', width: 1360, height: 1088, label: '5:4' },
    '9x16': { ideogramAspect: '9x16', width: 1088, height: 1920, label: '9:16' },
    '16x9': { ideogramAspect: '16x9', width: 1920, height: 1088, label: '16:9' },
    '10x16': { ideogramAspect: '10x16', width: 1120, height: 1792, label: '10:16' },
    '16x10': { ideogramAspect: '16x10', width: 1792, height: 1120, label: '16:10' },
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

const IDEOGRAM_NEGATIVE_PROMPT =
  'blurry, low resolution, pixelated, jpeg artifacts, noisy, muddy colors, amateur layout, distorted typography';

const IDEOGRAM_TEXT_FREE_NEGATIVE =
  'text, letters, words, typography, writing, caption, headline, subtitle, watermark, logo text, signage, poster text, menu, label, UI text, numbers as text, alphabet, calligraphy, graffiti, banner text, misspelled words, gibberish';

/** When rendering exact Story copy — block invented / garbled extra lettering. */
const IDEOGRAM_EXACT_TEXT_NEGATIVE =
  'gibberish, nonsense words, misspelled words, random letters, extra slogans, extra captions, duplicate headlines, fake CTAs, Apply Now, Learn More, Register, lorem ipsum, placeholder text, watermark text, signage text from photo, unreadable tiny text, distorted letters';

/** Highest Ideogram 3 ResolutionV3 per aspect (used for standard/premium). */
const IDEOGRAM_RESOLUTION_BY_ASPECT: Record<string, string> = {
  '1x1': '1024x1024',
  '2x3': '832x1216',
  '3x2': '1216x832',
  '3x4': '896x1152',
  '4x3': '1152x896',
  '4x5': '896x1120',
  '5x4': '1120x896',
  '9x16': '768x1344',
  '16x9': '1344x768',
  '10x16': '800x1280',
  '16x10': '1280x800',
  '1x3': '512x1536',
  '3x1': '1536x512',
  '1x2': '704x1408',
  '2x1': '1408x704',
};

function ideogramResolutionForAspect(
  aspect: string,
  quality: ImageGenerationQuality,
): string | null {
  if (quality === 'draft') return null;
  return IDEOGRAM_RESOLUTION_BY_ASPECT[aspect] || IDEOGRAM_RESOLUTION_BY_ASPECT['3x4'];
}

const DEFAULT_AVOID =
  'gibberish text, misspelled words, random letters, fake logos, invented brand marks, watermarks, QR codes, unreadable tiny text, cluttered layouts, distorted faces, extra limbs';

const STYLE_PROMPT_GUIDANCE: Record<ImageGenerationStyle, string> = {
  marketing_poster:
    'Institutional marketing flyer: bold hierarchy, one clear headline, short supporting line, strong CTA button area, balanced margins, print-ready.',
  social_media:
    'Social feed creative: thumb-stopping composition, short readable text at safe margins, mobile-first contrast.',
  hero_banner:
    'Wide website hero: clean composition with space for a headline, restrained copy, premium institutional feel.',
  infographic:
    'Infographic poster: clear sections, readable labels, simple icons, structured layout.',
  illustration:
    'Styled illustration (not photo): cohesive colors, intentional shapes, polished editorial look.',
  photo_realistic:
    'Photoreal scene: natural lighting, sharp focus; keep any overlay text minimal and crisp.',
  logo:
    'Simple logo mark or wordmark: flat vector look, centered, high contrast, minimal detail.',
  product_mockup:
    'Clean product mockup: accurate proportions, soft studio lighting, uncluttered surface.',
  other:
    'Clean professional creative: clear subject, deliberate composition.',
};

function ideogramRenderingSpeed(quality: ImageGenerationQuality): string {
  if (quality === 'draft') return 'TURBO';
  return 'QUALITY';
}

function hasExactText(precision?: PromptPrecision): boolean {
  return Boolean(
    precision?.mustIncludeText?.trim() ||
      precision?.headline?.trim() ||
      precision?.cta?.trim(),
  );
}

function ideogramStyleType(
  style: ImageGenerationStyle,
  transparentBackground?: boolean,
): string | null {
  if (transparentBackground) return null;
  switch (style) {
    case 'photo_realistic':
    case 'product_mockup':
      return 'REALISTIC';
    case 'illustration':
      return 'RENDER_3D';
    case 'logo':
    case 'marketing_poster':
    case 'social_media':
    case 'hero_banner':
    case 'infographic':
    case 'other':
    default:
      return 'DESIGN';
  }
}

function resolveMagicPrompt(
  userPrompt: string,
  precision?: PromptPrecision,
): 'ON' | 'OFF' | 'AUTO' {
  // Text-free and exact copy must never be rewritten by Magic Prompt.
  if (precision?.textFree || hasExactText(precision) || userPrompt.length >= 420) return 'OFF';
  if (userPrompt.length < 140) return 'ON';
  return 'AUTO';
}

/**
 * Build a provider-ready prompt from free text + optional structured brief.
 * Exact text is placed first (Ideogram typography is more reliable that way).
 */
export function buildEnhancedPrompt(options: {
  prompt: string;
  style: ImageGenerationStyle;
  precision?: PromptPrecision;
  transparentBackground?: boolean;
}): { prompt: string; magicPrompt: 'ON' | 'OFF' | 'AUTO'; styleType: string | null; paletteHex: string[] } {
  const base = options.prompt.trim();
  const p = options.precision || {};
  const parts: string[] = [];
  const textFree = Boolean(p.textFree);
  const exact = !textFree && hasExactText(p);

  const headline = p.headline?.trim();
  const cta = p.cta?.trim();
  const must = p.mustIncludeText?.trim();

  if (textFree) {
    parts.push(
      'TEXT-FREE IMAGE (critical): produce a clean visual with absolutely NO readable text — no headlines, CTAs, captions, labels, watermarks, posters, signs, menus, badges, or gibberish letters. Empty safe margins for later typography overlay. Do not invent words of any language.',
    );
  } else if (exact) {
    parts.push(
      'TYPOGRAPHY LOCK (critical): the ONLY readable text in the entire image must be the quoted strings below — nothing else.',
    );
    if (headline) parts.push(`Headline (exact): "${headline}"`);
    if (cta) parts.push(`Supporting line (exact): "${cta}"`);
    if (must && must !== headline && must !== cta) parts.push(`Also exact: "${must}"`);
    parts.push(
      'No other words, numbers-as-text, buttons, badges, watermarks, signage, or gibberish. Blank surfaces everywhere else.',
    );
    parts.push(ATRISI_EXACT_TYPE_DIRECTION);
  }

  // Visual brief after text — keeps Ideogram focused on the quoted copy
  parts.push(base);

  const institution = p.institutionName?.trim();
  // Skip quoting institution when text-free — models turn it into on-image wordmarks
  if (institution && !textFree && !base.toLowerCase().includes(institution.toLowerCase()) && !exact) {
    parts.push(`Institution / program context: "${institution}".`);
  }

  const parsedTheme = parseBrandTheme(p.brandTheme);

  const paletteHex =
    parsedTheme?.colors.length
      ? parsedTheme.colors
      : resolvePaletteColors({
          paletteType: p.paletteType,
          primaryColor: p.primaryColor,
          secondaryColor: p.secondaryColor,
          accentColor: p.accentColor,
        });

  if (paletteHex.length > 0) {
    parts.push(
      `Brand colors (use exactly, do not invent alternate brand colors): ${paletteHex.join(', ')}.`,
    );
  }

  if (parsedTheme?.promptLines.length) {
    const themeLines =
      textFree
        ? // Text-free: keep mood/layout/imagery/colors — drop type/copy directions
          parsedTheme.promptLines.filter(
            (line) => !/typograph|headline|copy|font|wordmark|cta|typeface/i.test(line),
          )
        : exact
          ? // Exact copy: keep Inter/type feel + layout/mood; drop anything that invents extra slogans
            parsedTheme.promptLines.filter(
              (line) => !/\binvent\b|extra slogan|CTA button|wordmark lettering/i.test(line),
            )
          : parsedTheme.promptLines;
    if (themeLines.length) parts.push(...themeLines);
  }

  if (p.useLogoReference) {
    parts.push(
      textFree
        ? 'If a logo reference is provided, place the official mark only (icon/seal). Do not invent or redraw wordmark lettering.'
        : 'Use the official logo from the first reference image as a real brand mark (correct proportions; do not invent seals).',
    );
  }

  const visual = p.referenceVisualContext?.trim();
  if (visual) {
    // Keep vision cues short so they do not drown out typography instructions.
    // Exact mode: even shorter, and strip quote fragments that look like OCR.
    const cleaned = exact
      ? visual
          .replace(/seen text\s+"[^"]*"/gi, '')
          .replace(/"[^"]{3,80}"/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 220)
      : visual.slice(0, 500);
    if (cleaned) parts.push(`Reference look: ${cleaned}`);
  }

  if (textFree) {
    parts.push(
      'Photoreal or clean illustrative scene: natural lighting, sharp focus, NO letters, NO words, NO captions, NO signage text — pure visual for later text overlay.',
    );
  } else if (exact) {
    parts.push(
      'Clean ATRISI institutional photo-led layout: one large exact headline in Inter-like sans, generous empty margins, optional navy→blue gradient field or teal accent bar, no invented CTA buttons or badge clusters.',
    );
  } else {
    parts.push(STYLE_PROMPT_GUIDANCE[options.style] || STYLE_PROMPT_GUIDANCE.other);
  }
  parts.push('Sharp, high-resolution, professional marketing quality, clean edges and lighting.');

  if (options.transparentBackground) {
    parts.push(
      'Transparent background PNG: subject only, clean cutout edges, no backdrop.',
    );
  }

  const avoid = [
    p.avoid?.trim(),
    textFree
      ? 'any readable text, gibberish letters, misspelled words, fake logos, watermarks, QR codes, captions, headlines, CTAs, subtitles, UI chrome with labels'
      : exact
        ? 'any text except the quoted headline/supporting line, gibberish, misspellings, extra slogans, fake CTAs, Apply Now, Learn More, Register Now, badge stacks, watermarks, signage copied from reference photos'
        : DEFAULT_AVOID,
  ]
    .filter(Boolean)
    .join('; ');
  parts.push(`Avoid: ${avoid}.`);

  // Shorter prompts = better text fidelity on Ideogram
  // Exact typography: keep prompt tight; long briefs cause invented slogans
  const maxLen = exact ? 1400 : textFree ? 2800 : 3500;
  const enhanced = parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);

  return {
    prompt: enhanced,
    magicPrompt: resolveMagicPrompt(base, options.precision),
    // DESIGN for locked copy; REALISTIC when scrubbing text from photos
    styleType: textFree
      ? 'REALISTIC'
      : exact
        ? 'DESIGN'
        : ideogramStyleType(options.style, options.transparentBackground),
    paletteHex,
  };
}

function scaleFluxSize(
  width: number,
  height: number,
  quality: ImageGenerationQuality,
): { width: number; height: number } {
  const round16 = (n: number) => Math.max(512, Math.round(n / 16) * 16);
  if (quality === 'draft') return { width: round16(width), height: round16(height) };

  const targetMp =
    quality === 'premium' ? 2_000_000 : 1_400_000;
  const currentMp = width * height;
  const scale = Math.min(2.2, Math.max(1, Math.sqrt(targetMp / currentMp)));
  let w = round16(width * scale);
  let h = round16(height * scale);
  while (w * h > 4_000_000) {
    w = round16(w * 0.92);
    h = round16(h * 0.92);
  }
  return { width: w, height: h };
}

function fluxModelForQuality(
  quality: ImageGenerationQuality,
  hasRefs: boolean,
  style: ImageGenerationStyle,
): string {
  if (quality === 'draft' && !hasRefs) return 'flux-2-klein-4b';
  if (quality === 'premium' && !hasRefs && style === 'photo_realistic') {
    return 'flux-2-max';
  }
  return 'flux-2-pro';
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
  // Same layout as Story uploads so previews/export recovery share one tree
  const storageKey = `images/${options.ownerUserId}/${fileId}/original.${ext}`;
  const contentType = options.contentType.startsWith('image/') ? options.contentType : 'image/png';
  let storageUrl: string | undefined;
  let volumeOk = false;

  try {
    storageUrl = await storageProvider.uploadFile(
      options.buffer,
      storageKey,
      contentType,
      {
        'user-id': options.ownerUserId,
        'file-id': fileId,
        'original-filename': encodeURIComponent(filename),
        source: 'creative_ai',
      },
    );
    const verify = await storageProvider.downloadFile(storageKey);
    volumeOk = Boolean(verify?.length);
  } catch (error) {
    logger.error('Creative AI volume write failed — using DB inline fallback', {
      storageKey,
      storagePath: config.storagePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const metadata = buildInlineImageMetadata(options.buffer, contentType, {
    source: 'creative_ai',
    storeOriginal: true,
    ...(options.metadata || {}),
    ...(volumeOk ? {} : { storageWriteFailed: true }),
  });

  if (!volumeOk && !(metadata as { inlineBase64?: string }).inlineBase64) {
    throw Object.assign(
      new Error(
        'Generated image could not be saved. Mount a Railway volume and set STORAGE_PATH, or use a smaller image.',
      ),
      { statusCode: 503 },
    );
  }

  await db
    .update(files)
    .set({
      storageKey,
      storageUrl: storageUrl || null,
      status: 'processed',
      metadata: metadata as any,
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

/** Load image files the actor owns or can access via shared organization. */
export async function loadReferenceImages(
  actorUserId: string,
  referenceFileIds: string[] | undefined,
): Promise<ReferenceImageBlob[]> {
  const ids = [...new Set((referenceFileIds || []).filter(Boolean))].slice(0, MAX_REFERENCE_IMAGES);
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(files)
    .where(inArray(files.id, ids));
  const accessibleRows: typeof rows = [];
  for (const row of rows) {
    if (await canActorAccessOwnerResource(actorUserId, row.userId)) {
      accessibleRows.push(row);
    }
  }
  const byId = new Map(accessibleRows.map((row) => [row.id, row]));
  const loaded: ReferenceImageBlob[] = [];
  const missing: string[] = [];

  for (const fileId of ids) {
    const row = byId.get(fileId);
    if (!row) {
      missing.push(fileId);
      continue;
    }
    if (!row.mimetype?.startsWith('image/')) {
      throw new Error(`Reference must be an image (${row.originalName || fileId})`);
    }
    try {
      const resolved = await resolveFileImageBytes({
        id: row.id,
        originalName: row.originalName,
        filename: row.filename,
        mimetype: row.mimetype,
        storageKey: row.storageKey,
        metadata: row.metadata as Record<string, unknown> | null,
      });
      loaded.push({
        fileId: row.id,
        filename: row.originalName || row.filename || `reference-${fileId}.png`,
        contentType: resolved.contentType,
        buffer: resolved.buffer,
      });
    } catch (error) {
      logger.warn('Creative reference download failed', {
        fileId,
        storageKey: row.storageKey,
        error: error instanceof Error ? error.message : String(error),
      });
      missing.push(row.originalName || fileId);
    }
  }

  if (loaded.length === 0) {
    throw Object.assign(
      new Error(
        missing.length > 0
          ? `Image “${missing[0]}” is missing from storage. Remove it and re-upload in Story Assets (volume may have been reset).`
          : 'No reference images available. Re-upload the beat image and try again.',
      ),
      { statusCode: 404 },
    );
  }

  if (missing.length > 0) {
    logger.warn('Creative AI continuing with partial references', {
      loaded: loaded.length,
      missing,
    });
  }

  return loaded;
}

export function decodeInlineReferenceImages(
  images:
    | Array<{
        filename: string;
        contentType: string;
        base64: string;
      }>
    | undefined,
): ReferenceImageBlob[] {
  if (!images?.length) return [];
  return images.slice(0, MAX_REFERENCE_IMAGES).map((image, index) => {
    const raw = image.base64.includes(',')
      ? image.base64.split(',').pop() || ''
      : image.base64;
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.length) {
      throw new Error(`Inline reference “${image.filename || index + 1}” is empty`);
    }
    return {
      fileId: `inline-${index + 1}`,
      filename: image.filename || `reference-${index + 1}.png`,
      contentType: image.contentType || 'image/png',
      buffer,
    };
  });
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
  magicPrompt?: 'ON' | 'OFF' | 'AUTO';
  styleType?: string | null;
  paletteHex?: string[];
  references?: ReferenceImageBlob[];
  transparentBackground?: boolean;
  variantCount?: number;
  textFree?: boolean;
  /** Strengthen negative prompt when rendering locked Story copy. */
  exactText?: boolean;
}): Promise<Array<{ buffer: Buffer; contentType: string; modelId: string; sourceUrl: string }>> {
  const form = new FormData();
  form.append('prompt', options.prompt);
  const resolution = ideogramResolutionForAspect(options.ideogramAspect, options.quality);
  if (resolution) {
    form.append('resolution', resolution);
  } else {
    form.append('aspect_ratio', options.ideogramAspect);
  }
  form.append('num_images', String(Math.min(4, Math.max(1, options.variantCount || 1))));
  form.append('magic_prompt', options.magicPrompt || 'AUTO');
  form.append('rendering_speed', ideogramRenderingSpeed(options.quality));
  if (options.quality !== 'draft') {
    const negative = options.textFree
      ? `${IDEOGRAM_NEGATIVE_PROMPT}, ${IDEOGRAM_TEXT_FREE_NEGATIVE}`
      : options.exactText
        ? `${IDEOGRAM_NEGATIVE_PROMPT}, ${IDEOGRAM_EXACT_TEXT_NEGATIVE}`
        : IDEOGRAM_NEGATIVE_PROMPT;
    form.append('negative_prompt', negative);
  }

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
  } else if (options.styleType) {
    form.append('style_type', options.styleType);
  }

  const palette = (options.paletteHex || []).filter(Boolean).slice(0, 5);
  if (palette.length > 0) {
    form.append(
      'color_palette',
      JSON.stringify({
        members: palette.map((color_hex) => ({ color_hex })),
      }),
    );
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
      ? `ideogram-v3+style-ref`
      : resolution
        ? `ideogram-v3@${resolution}`
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
  style: ImageGenerationStyle;
  references?: ReferenceImageBlob[];
  textFree?: boolean;
}): Promise<{ buffer: Buffer; contentType: string; modelId: string; sourceUrl: string }> {
  const refs = options.references || [];
  const modelId = fluxModelForQuality(options.quality, refs.length > 0, options.style);
  const sized = scaleFluxSize(options.width, options.height, options.quality);

  let prompt = options.prompt;
  if (options.textFree && refs.length > 0) {
    prompt = [
      'Edit the reference photograph.',
      'Keep the same people, place, lighting, and composition.',
      'Remove every readable character: headlines, captions, logos-as-words, signs, posters, UI labels, watermarks, and gibberish letters.',
      'Where text was, use blank walls, plain clothing, empty boards, or clean surfaces — no replacement lettering.',
      'Final frame must contain zero letters of any language.',
      prompt,
    ].join(' ');
  }

  const body: Record<string, unknown> = {
    prompt,
    width: sized.width,
    height: sized.height,
    output_format: 'png',
    safety_tolerance: 2,
  };

  refs.slice(0, 8).forEach((ref, index) => {
    const key = index === 0 ? 'input_image' : `input_image_${index + 1}`;
    body[key] = toBase64DataUrl(ref);
  });

  const submitFlux = async (activeModel: string) =>
    fetch(`https://api.bfl.ai/v1/${activeModel}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'x-key': options.apiKey,
      },
      body: JSON.stringify(body),
    });

  let activeModel = modelId;
  let submit = await submitFlux(activeModel);
  if (!submit.ok && activeModel === 'flux-2-max') {
    activeModel = 'flux-2-pro';
    submit = await submitFlux(activeModel);
  }

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
        modelId: refs.length > 0 ? `${activeModel}+ref` : activeModel,
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

async function listExecutableProviders(
  userId: string,
  style: ImageGenerationStyle,
  override?: ImageGenerationProviderId | null,
  options?: {
    hasReferences?: boolean;
    referenceMode?: 'style' | 'edit';
    transparentBackground?: boolean;
    preferLegibleText?: boolean;
  },
): Promise<Array<{ provider: ExecutableProvider; apiKey: string; source: 'byok' | 'platform' }>> {
  const order: ExecutableProvider[] = [];

  if (override && override !== 'auto') {
    if (!isExecutable(override)) {
      throw new Error(
        `Provider "${override}" is not wired yet. Use Auto, Ideogram, or FLUX.`,
      );
    }
    if (options?.transparentBackground && override === 'flux') {
      throw new Error('Transparent PNG is Ideogram-only. Switch provider to Ideogram or Auto.');
    }
    order.push(override);
  } else if (options?.transparentBackground) {
    order.push('ideogram');
  } else if (options?.preferLegibleText) {
    order.push('ideogram', 'flux');
  } else if (options?.referenceMode === 'edit' && options?.hasReferences) {
    // Subject-preserving remix — FLUX input_image first, Ideogram fallback
    order.push('flux', 'ideogram');
  } else if (options?.hasReferences) {
    // Ideogram first for style refs — FLUX remix is nice but often credit-limited
    order.push('ideogram', 'flux');
  } else {
    for (const id of preferredProvidersForStyle(style)) {
      if (isExecutable(id) && !order.includes(id)) order.push(id);
    }
    for (const id of EXECUTABLE_PROVIDERS) {
      if (!order.includes(id)) order.push(id);
    }
  }

  const resolved: Array<{ provider: ExecutableProvider; apiKey: string; source: 'byok' | 'platform' }> = [];
  const missing: string[] = [];
  for (const provider of order) {
    const key = await resolveCreativeProviderApiKey(userId, provider);
    if (key.key) {
      resolved.push({
        provider,
        apiKey: key.key,
        source: key.source === 'byok' ? 'byok' : 'platform',
      });
    } else {
      missing.push(provider);
    }
  }

  if (resolved.length === 0) {
    throw new Error(
      `No Creative AI key configured for ${missing.join(' / ') || 'ideogram / flux'}. Set IDEOGRAM_API_KEY and/or BFL_API_KEY on the backend, or add BYOK in Settings.`,
    );
  }
  return resolved;
}

function isProviderBillingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /402|insufficient credits|out of credits|billing|payment required|quota/i.test(message);
}

/**
 * Generate one or more marketing images and store them as Platform files.
 */
export async function generateCreativeImages(
  input: GenerateImageInput,
): Promise<GenerateCreativeBatchResult> {
  const userPrompt = input.prompt.trim();
  if (userPrompt.length < 3) {
    throw new Error('Prompt is required');
  }

  const style: ImageGenerationStyle = input.style || 'marketing_poster';
  const quality: ImageGenerationQuality = input.quality || 'standard';
  const referenceMode = input.referenceMode || 'style';
  const transparentBackground = Boolean(input.transparentBackground);
  const variantCount = Math.min(4, Math.max(1, input.variantCount || 1));
  const analyzeReferences = input.analyzeReferences !== false;

  const inlineReferences = decodeInlineReferenceImages(input.referenceImages);
  let fileReferences: ReferenceImageBlob[] = [];
  if (inlineReferences.length === 0 && input.referenceFileIds?.length) {
    fileReferences = await loadReferenceImages(input.ownerUserId, input.referenceFileIds);
  }
  const references = (inlineReferences.length ? inlineReferences : fileReferences).slice(
    0,
    MAX_REFERENCE_IMAGES,
  );

  let providerAttachRefs: ReferenceImageBlob[] = [];
  if (input.visionOnlyReferences) {
    const attachIds = [...new Set((input.providerReferenceFileIds || []).filter(Boolean))];
    if (attachIds.length > 0) {
      providerAttachRefs = await loadReferenceImages(input.ownerUserId, attachIds);
    }
  }

  let visionNotes: Awaited<ReturnType<typeof describeCreativeReferenceImages>> = [];
  let referenceVisualContext: string | undefined;
  let inferredPalette: string[] = [];

  if (analyzeReferences && references.length > 0) {
    try {
      const byok = await userApiKeyRepository.getDecryptedApiKeys(input.ownerUserId);
      const groqKey = byok.groq?.trim() || config.groqApiKey;
      visionNotes = await describeCreativeReferenceImages(references, { apiKey: groqKey });
      if (visionNotes.length > 0) {
        const userHasExactText = hasExactText(input.precision);
        const textFree = Boolean(input.precision?.textFree);
        referenceVisualContext = visionNotes
          .map((note, index) => {
            const bits = [
              `Ref ${index + 1}${note.isLogoLike ? ' [logo]' : ''}: ${note.summary}`,
            ];
            if (note.styleNotes.length) bits.push(note.styleNotes.slice(0, 4).join('; '));
            if (note.colors.length) bits.push(`colors ${note.colors.join(', ')}`);
            // Never feed OCR into exact-copy or text-free jobs — Ideogram invents garbage from it
            if (!textFree && !userHasExactText && note.detectedText) {
              bits.push(`seen text "${note.detectedText.slice(0, 80)}"`);
            }
            return bits.join(' — ');
          })
          .join(' | ')
          .slice(0, userHasExactText ? 280 : 600);

        inferredPalette = visionNotes.flatMap((n) => n.colors).slice(0, 5);
      }
    } catch (error) {
      logger.warn('Creative reference vision skipped', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const useLogoReference =
    input.precision?.useLogoReference === true ||
    (input.precision?.useLogoReference !== false && visionNotes[0]?.isLogoLike === true);

  const parsedTheme = parseBrandTheme(input.precision?.brandTheme);
  const paletteType = input.precision?.paletteType || 'auto';
  const typedColors = resolvePaletteColors({ paletteType });
  const themeColors = parsedTheme?.colors || [];

  const precision: PromptPrecision = {
    ...(input.precision || {}),
    paletteType,
    useLogoReference: useLogoReference || undefined,
    referenceVisualContext:
      referenceVisualContext || input.precision?.referenceVisualContext,
    primaryColor:
      themeColors[0] ||
      typedColors[0] ||
      input.precision?.primaryColor ||
      (paletteType === 'auto' ? inferredPalette[0] : undefined) ||
      undefined,
    secondaryColor:
      themeColors[1] ||
      typedColors[1] ||
      input.precision?.secondaryColor ||
      (paletteType === 'auto' ? inferredPalette[1] : undefined) ||
      undefined,
    accentColor:
      themeColors[2] ||
      typedColors[2] ||
      input.precision?.accentColor ||
      (paletteType === 'auto' ? inferredPalette[2] : undefined) ||
      undefined,
  };

  const enhanced = buildEnhancedPrompt({
    prompt: userPrompt,
    style,
    precision,
    transparentBackground,
  });
  const prompt = enhanced.prompt;

  // Exact typography: keep vision description; optionally attach logo/style kit only
  const providerReferences = input.visionOnlyReferences
    ? providerAttachRefs.slice(0, MAX_REFERENCE_IMAGES)
    : references;

  const preferLegibleText = hasExactText(input.precision);
  const dims = resolveDimensions(style, input.aspectRatio);
  const providerCandidates = await listExecutableProviders(
    input.ownerUserId,
    style,
    input.providerOverride,
    {
      hasReferences: providerReferences.length > 0,
      referenceMode,
      transparentBackground,
      preferLegibleText,
    },
  );

  const ideogramResolution = ideogramResolutionForAspect(dims.ideogramAspect, quality);
  const fluxSized = scaleFluxSize(dims.width, dims.height, quality);

  const started = Date.now();
  let outputs: Array<{ buffer: Buffer; contentType: string; modelId: string; sourceUrl: string }> = [];
  let provider: ExecutableProvider = providerCandidates[0].provider;
  let source: 'byok' | 'platform' = providerCandidates[0].source;
  let lastError: unknown;

  for (const candidate of providerCandidates) {
    provider = candidate.provider;
    source = candidate.source;
    logger.info('Creative AI generate start', {
      userId: input.ownerUserId,
      provider,
      keySource: source,
      style,
      quality,
      aspect: dims.label,
      ideogramResolution: ideogramResolution || dims.ideogramAspect,
      fluxSize: provider === 'flux' ? `${fluxSized.width}x${fluxSized.height}` : undefined,
      magicPrompt: enhanced.magicPrompt,
      styleType: enhanced.styleType,
      palette: enhanced.paletteHex,
      visionRefs: visionNotes.length,
      referenceCount: providerReferences.length,
      referenceMode: providerReferences.length ? referenceMode : undefined,
      visionOnlyReferences: Boolean(input.visionOnlyReferences),
      transparentBackground,
      variantCount,
    });

    try {
      if (provider === 'ideogram') {
        outputs = await generateWithIdeogram({
          apiKey: candidate.apiKey,
          prompt,
          quality,
          ideogramAspect: dims.ideogramAspect,
          magicPrompt: enhanced.magicPrompt,
          styleType: enhanced.styleType,
          paletteHex: enhanced.paletteHex,
          references: providerReferences,
          transparentBackground,
          variantCount,
          textFree: Boolean(input.precision?.textFree),
          exactText: preferLegibleText,
        });
      } else {
        outputs = [];
        for (let i = 0; i < variantCount; i += 1) {
          const one = await generateWithFlux({
            apiKey: candidate.apiKey,
            prompt,
            quality,
            width: dims.width,
            height: dims.height,
            style,
            references: providerReferences,
            textFree: Boolean(input.precision?.textFree),
          });
          outputs.push(one);
        }
      }
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      logger.error('Creative AI generate failed', {
        provider,
        error: error instanceof Error ? error.message : String(error),
        willRetry: isProviderBillingError(error) && providerCandidates.indexOf(candidate) < providerCandidates.length - 1,
      });
      if (!isProviderBillingError(error) || providerCandidates.indexOf(candidate) >= providerCandidates.length - 1) {
        // Non-billing errors: still try next provider when available (e.g. FLUX down)
        const hasNext = providerCandidates.indexOf(candidate) < providerCandidates.length - 1;
        if (!hasNext) throw error;
        logger.warn('Creative AI trying next provider after failure', {
          failed: provider,
          next: providerCandidates[providerCandidates.indexOf(candidate) + 1]?.provider,
        });
      }
    }
  }

  if (outputs.length === 0) {
    throw lastError instanceof Error
      ? lastError
      : new Error('Creative AI returned no images');
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
        prompt: userPrompt,
        enhancedPrompt: prompt,
        magicPrompt: enhanced.magicPrompt,
        styleType: enhanced.styleType || undefined,
        precision,
        palette: enhanced.paletteHex,
        referenceVision: visionNotes.length
          ? visionNotes.map((n) => ({
              filename: n.filename,
              summary: n.summary,
              colors: n.colors,
              isLogoLike: n.isLogoLike,
              model: n.model,
            }))
          : undefined,
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
      prompt: userPrompt,
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
  const usage = await recordCreativeImageUsage({
    userId: input.ownerUserId,
    provider,
    modelId: filesOut[0]?.modelId || provider,
    quality,
    imageCount: filesOut.length,
    hasReferences: providerReferences.length > 0,
    latencyMs,
    keySource: source,
    source: typeof input.metadata?.source === 'string' ? input.metadata.source : undefined,
  });

  logger.info('Creative AI generate succeeded', {
    userId: input.ownerUserId,
    provider,
    fileCount: filesOut.length,
    latencyMs,
    estimatedCostCents: usage?.estimatedCostCents,
    estimatedCredits: usage?.estimatedCredits,
    usageSummary: formatCreativeUsageSummary(usage),
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
    usage,
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
