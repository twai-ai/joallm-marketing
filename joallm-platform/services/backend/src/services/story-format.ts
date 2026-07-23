/**
 * Story output formats — drive Brand/Similar aspect + PPTX/HTML layout.
 * Carousel / feed / stories are not 16:9; deck is.
 */

export type StoryFormatId = 'deck' | 'carousel' | 'feed' | 'story';

export type StoryFormatSpec = {
  id: StoryFormatId;
  label: string;
  hint: string;
  /** Creative AI / Ideogram aspect key (e.g. 1x1) */
  aspectRatio: string;
  pptx: { name: string; width: number; height: number };
  /** How images fill the slide image region */
  imageFit: 'contain' | 'cover';
  /** deck = title + image + caption; fullbleed = image-led with overlay copy */
  layout: 'deck' | 'fullbleed';
};

export const STORY_FORMATS: Record<StoryFormatId, StoryFormatSpec> = {
  deck: {
    id: 'deck',
    label: 'Deck',
    hint: '16:9 presentation',
    aspectRatio: '16x9',
    pptx: { name: 'STORY_DECK_16x9', width: 13.333, height: 7.5 },
    imageFit: 'contain',
    layout: 'deck',
  },
  carousel: {
    id: 'carousel',
    label: 'Carousel',
    hint: '1:1 feed carousel',
    aspectRatio: '1x1',
    pptx: { name: 'STORY_CAROUSEL_1x1', width: 7.5, height: 7.5 },
    imageFit: 'cover',
    layout: 'fullbleed',
  },
  feed: {
    id: 'feed',
    label: 'Feed',
    hint: '4:5 portrait post',
    aspectRatio: '4x5',
    pptx: { name: 'STORY_FEED_4x5', width: 7.5, height: 9.375 },
    imageFit: 'cover',
    layout: 'fullbleed',
  },
  story: {
    id: 'story',
    label: 'Stories',
    hint: '9:16 Reels / Stories',
    aspectRatio: '9x16',
    pptx: { name: 'STORY_VERTICAL_9x16', width: 7.5, height: 13.333 },
    imageFit: 'cover',
    layout: 'fullbleed',
  },
};

export const STORY_FORMAT_IDS = Object.keys(STORY_FORMATS) as StoryFormatId[];

export function isStoryFormatId(value: unknown): value is StoryFormatId {
  return typeof value === 'string' && value in STORY_FORMATS;
}

/** Read format from story metadata (default deck). */
export function getStoryFormat(
  metadata: Record<string, unknown> | null | undefined,
): StoryFormatSpec {
  const raw = metadata?.format;
  if (isStoryFormatId(raw)) return STORY_FORMATS[raw];
  // Legacy: metadata.aspectRatio alone
  const aspect = typeof metadata?.aspectRatio === 'string'
    ? metadata.aspectRatio.trim().toLowerCase().replace(':', 'x')
    : '';
  if (aspect === '1x1') return STORY_FORMATS.carousel;
  if (aspect === '4x5') return STORY_FORMATS.feed;
  if (aspect === '9x16') return STORY_FORMATS.story;
  return STORY_FORMATS.deck;
}

export function getStoryAspectRatio(
  metadata: Record<string, unknown> | null | undefined,
): string {
  const custom =
    typeof metadata?.aspectRatio === 'string' && metadata.aspectRatio.trim()
      ? metadata.aspectRatio.trim().toLowerCase().replace(':', 'x')
      : '';
  if (custom && /^(1x1|4x5|9x16|16x9|3x4|4x3|3x2|2x3)$/.test(custom)) {
    return custom;
  }
  return getStoryFormat(metadata).aspectRatio;
}
