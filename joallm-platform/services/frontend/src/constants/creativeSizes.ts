/**
 * Creative size presets for Acquisition Workspace generate UI.
 * Values map to Ideogram AspectRatioV3 + FLUX width/height via backend resolveDimensions.
 *
 * Ideogram public API is image-only today — no video generate endpoint.
 */

export type CreativeSizeId =
  | '1x1'
  | '4x5'
  | '3x4'
  | '2x3'
  | '9x16'
  | '16x9'
  | '4x3'
  | '3x2'
  | '5x4'
  | '16x10';

export type CreativeSizeOption = {
  id: CreativeSizeId;
  label: string;
  hint: string;
};

export const CREATIVE_SIZE_OPTIONS: CreativeSizeOption[] = [
  { id: '1x1', label: '1:1 Square', hint: 'Instagram / feed' },
  { id: '4x5', label: '4:5 Portrait', hint: 'Instagram portrait' },
  { id: '3x4', label: '3:4 Flyer', hint: 'Print / WhatsApp flyer' },
  { id: '2x3', label: '2:3 Poster', hint: 'Tall poster' },
  { id: '9x16', label: '9:16 Story', hint: 'Reels / Stories / Shorts still' },
  { id: '16x9', label: '16:9 Landscape', hint: 'YouTube / LinkedIn / banner' },
  { id: '4x3', label: '4:3 Landscape', hint: 'Presentation / deck' },
  { id: '3x2', label: '3:2 Photo', hint: 'Photo-like landscape' },
  { id: '5x4', label: '5:4 Landscape', hint: 'Slightly wide' },
  { id: '16x10', label: '16:10 Wide', hint: 'Wide hero' },
];

export function defaultSizeForStyle(style: string): CreativeSizeId {
  if (style === 'hero_banner') return '16x9';
  if (style === 'social_media') return '1x1';
  if (style === 'logo') return '1x1';
  if (style === 'photo_realistic' || style === 'product_mockup') return '4x3';
  return '3x4';
}
