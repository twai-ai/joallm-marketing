import { describe, expect, it } from 'vitest';
import { resolveDimensions } from '../../../services/creative-ai-generate-service.js';

describe('creative AI generate dimensions', () => {
  it('defaults marketing posters to 3:4', () => {
    const dims = resolveDimensions('marketing_poster');
    expect(dims.ideogramAspect).toBe('3x4');
    expect(dims.width % 32).toBe(0);
    expect(dims.height % 32).toBe(0);
  });

  it('maps social media to square', () => {
    expect(resolveDimensions('social_media').label).toBe('1:1');
  });

  it('honors explicit aspect override', () => {
    expect(resolveDimensions('marketing_poster', '16:9').ideogramAspect).toBe('16x9');
  });
});
