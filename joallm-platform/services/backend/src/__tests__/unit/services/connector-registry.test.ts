import { describe, expect, it } from 'vitest';
import {
  CONNECTOR_REGISTRY,
  defaultCapabilitiesFor,
  getRegistryEntry,
} from '../../../services/connector-registry.js';

describe('connector registry', () => {
  it('includes meta_whatsapp with fetchEvents capability', () => {
    const entry = getRegistryEntry('meta_whatsapp');
    expect(entry?.displayName).toContain('WhatsApp');
    expect(defaultCapabilitiesFor('meta_whatsapp')).toContain('fetchEvents');
    expect(CONNECTOR_REGISTRY.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps LinkedIn as one technical provider for multiple Studio channels', () => {
    const linkedin = getRegistryEntry('linkedin');
    expect(linkedin?.defaultCapabilities).toContain('publish');
    expect(linkedin?.setupNotes).toMatch(/Organic vs Ads/i);
  });
});
