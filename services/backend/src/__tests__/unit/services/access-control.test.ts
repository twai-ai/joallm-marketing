import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadAccessControl() {
  return await import('../../../services/access-control.js');
}

describe('access-control internal overrides', () => {
  const originalInternalSupportEmail = process.env.INTERNAL_SUPPORT_EMAIL;

  afterEach(() => {
    if (originalInternalSupportEmail === undefined) {
      delete process.env.INTERNAL_SUPPORT_EMAIL;
    } else {
      process.env.INTERNAL_SUPPORT_EMAIL = originalInternalSupportEmail;
    }
    vi.resetModules();
  });

  it('does not elevate support email when INTERNAL_SUPPORT_EMAIL is unset', async () => {
    delete process.env.INTERNAL_SUPPORT_EMAIL;
    vi.resetModules();

    const { applyInternalAccessOverrides } = await loadAccessControl();

    expect(
      applyInternalAccessOverrides('support@joallm.ai', 'casual', 'free'),
    ).toEqual({
      role: 'casual',
      subscriptionTier: 'free',
    });
  });

  it('elevates support email only when INTERNAL_SUPPORT_EMAIL matches', async () => {
    process.env.INTERNAL_SUPPORT_EMAIL = 'support@joallm.ai';
    vi.resetModules();

    const { applyInternalAccessOverrides } = await loadAccessControl();

    expect(
      applyInternalAccessOverrides('support@joallm.ai', 'casual', 'free'),
    ).toEqual({
      role: 'admin',
      subscriptionTier: 'enterprise',
    });
  });
});
