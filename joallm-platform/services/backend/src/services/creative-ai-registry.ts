/**
 * Creative AI — static image provider catalog (Platform).
 * Runtime instances and Auto routing live in a future creative-ai service.
 *
 * @see ../../../docs/04-architecture/CREATIVE_AI_DIRECTION.md
 */

export type ImageGenerationProviderId =
  | 'openai'
  | 'google_imagen'
  | 'flux'
  | 'ideogram'
  | 'stability'
  | 'adobe_firefly'
  | 'auto'
  | 'custom';

export type CreativeAICapability =
  | 'generateImage'
  | 'editImage'
  | 'upscale'
  | 'removeBackground'
  | 'expandCanvas'
  | 'generateVariants'
  | 'generateVideo'
  | 'generateAudio'
  | 'tts'
  | 'ocr'
  | 'styleTransfer';

export type ImageGenerationStyle =
  | 'marketing_poster'
  | 'social_media'
  | 'product_mockup'
  | 'hero_banner'
  | 'illustration'
  | 'infographic'
  | 'logo'
  | 'photo_realistic'
  | 'other';

export type ImageProviderRegistryEntry = {
  provider: ImageGenerationProviderId;
  displayName: string;
  defaultCapabilities: CreativeAICapability[];
  strengths: string[];
  setupNotes?: string;
};

/** Prefer these providers when Style is set and Provider = Auto */
export const AUTO_STYLE_PREFERENCES: Partial<
  Record<ImageGenerationStyle, ImageGenerationProviderId[]>
> = {
  marketing_poster: ['ideogram', 'openai', 'adobe_firefly'],
  social_media: ['openai', 'ideogram', 'flux'],
  product_mockup: ['google_imagen', 'flux', 'openai'],
  hero_banner: ['openai', 'ideogram', 'google_imagen'],
  illustration: ['openai', 'flux', 'stability'],
  infographic: ['ideogram', 'openai'],
  logo: ['ideogram', 'openai', 'adobe_firefly'],
  photo_realistic: ['google_imagen', 'flux', 'openai'],
  other: ['openai', 'flux', 'google_imagen'],
};

export const IMAGE_PROVIDER_REGISTRY: ImageProviderRegistryEntry[] = [
  {
    provider: 'openai',
    displayName: 'OpenAI GPT Image',
    defaultCapabilities: ['generateImage', 'editImage', 'generateVariants'],
    strengths: ['prompt adherence', 'editing', 'general marketing creatives', 'text rendering'],
    setupNotes: 'Primary default for most Studio workflows.',
  },
  {
    provider: 'google_imagen',
    displayName: 'Google Imagen',
    defaultCapabilities: ['generateImage', 'editImage', 'generateVariants'],
    strengths: ['photorealism', 'product photography', 'conversational editing'],
  },
  {
    provider: 'flux',
    displayName: 'Black Forest Labs FLUX',
    defaultCapabilities: ['generateImage', 'generateVariants'],
    strengths: ['realism', 'cost/performance', 'high volume', 'open/self-host path'],
  },
  {
    provider: 'ideogram',
    displayName: 'Ideogram',
    defaultCapabilities: ['generateImage', 'generateVariants'],
    strengths: ['posters', 'banners', 'logos', 'typography', 'embedded text'],
    setupNotes: 'Must-have for marketing graphics with text.',
  },
  {
    provider: 'stability',
    displayName: 'Stability AI',
    defaultCapabilities: ['generateImage', 'upscale', 'generateVariants'],
    strengths: ['self-host', 'fine-tuning', 'enterprise control'],
  },
  {
    provider: 'adobe_firefly',
    displayName: 'Adobe Firefly',
    defaultCapabilities: ['generateImage', 'editImage', 'generateVariants'],
    strengths: ['brand-safe commercial', 'Creative Cloud', 'enterprise creative teams'],
  },
];

export function getImageProviderEntry(
  provider: ImageGenerationProviderId,
): ImageProviderRegistryEntry | undefined {
  return IMAGE_PROVIDER_REGISTRY.find((entry) => entry.provider === provider);
}

/**
 * Resolve Auto → concrete provider preference list for a style.
 * Runtime service picks the first connected provider with required capability.
 */
export function preferredProvidersForStyle(
  style: ImageGenerationStyle,
): ImageGenerationProviderId[] {
  return AUTO_STYLE_PREFERENCES[style] ?? ['openai', 'flux', 'google_imagen'];
}
