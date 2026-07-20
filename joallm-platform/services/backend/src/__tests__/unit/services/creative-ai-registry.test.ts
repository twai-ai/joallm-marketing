import { describe, expect, it } from 'vitest';
import {
  IMAGE_PROVIDER_REGISTRY,
  getImageProviderEntry,
  preferredProvidersForStyle,
} from '../../../services/creative-ai-registry.js';

describe('creative AI image provider registry', () => {
  it('lists OpenAI as default-capable and Ideogram for typography', () => {
    expect(getImageProviderEntry('openai')?.strengths.join(' ')).toMatch(/prompt/i);
    expect(getImageProviderEntry('ideogram')?.strengths.join(' ')).toMatch(/typography|poster/i);
    expect(IMAGE_PROVIDER_REGISTRY.length).toBeGreaterThanOrEqual(5);
  });

  it('routes Marketing Poster Auto preference toward Ideogram first', () => {
    expect(preferredProvidersForStyle('marketing_poster')[0]).toBe('ideogram');
    expect(preferredProvidersForStyle('social_media')[0]).toBe('openai');
    expect(preferredProvidersForStyle('product_mockup')[0]).toBe('google_imagen');
  });
});
