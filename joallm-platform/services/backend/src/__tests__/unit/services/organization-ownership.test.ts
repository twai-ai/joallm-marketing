import { describe, expect, it } from 'vitest';
import {
  CREDENTIAL_SOURCE_ENVIRONMENT,
  isRowVisibleToTenant,
  orgMetaConnectorConfig,
} from '../../../services/organization-ownership.js';

describe('organization ownership isolation', () => {
  const orgA = 'org-a';
  const orgB = 'org-b';
  const user1 = 'user-1';
  const user2 = 'user-2';

  it('shows org-owned rows to any actor in that tenant', () => {
    expect(
      isRowVisibleToTenant({
        rowOrganizationId: orgA,
        rowOwnerUserId: user1,
        tenantOrganizationId: orgA,
        actorUserId: user2,
      }),
    ).toBe(true);
  });

  it('hides other-org rows even when actor matches legacy ownerUserId', () => {
    expect(
      isRowVisibleToTenant({
        rowOrganizationId: orgB,
        rowOwnerUserId: user1,
        tenantOrganizationId: orgA,
        actorUserId: user1,
      }),
    ).toBe(false);
  });

  it('allows legacy null-org rows only for the original owner during dual-read', () => {
    expect(
      isRowVisibleToTenant({
        rowOrganizationId: null,
        rowOwnerUserId: user1,
        tenantOrganizationId: orgA,
        actorUserId: user1,
      }),
    ).toBe(true);
    expect(
      isRowVisibleToTenant({
        rowOrganizationId: null,
        rowOwnerUserId: user1,
        tenantOrganizationId: orgA,
        actorUserId: user2,
      }),
    ).toBe(false);
  });

  it('falls back to ownerUserId when tenant org is missing', () => {
    expect(
      isRowVisibleToTenant({
        rowOrganizationId: orgA,
        rowOwnerUserId: user1,
        tenantOrganizationId: null,
        actorUserId: user1,
      }),
    ).toBe(true);
    expect(
      isRowVisibleToTenant({
        rowOrganizationId: orgA,
        rowOwnerUserId: user1,
        tenantOrganizationId: null,
        actorUserId: user2,
      }),
    ).toBe(false);
  });

  it('stamps Meta connector config with environment credential source + boundBy', () => {
    const config = orgMetaConnectorConfig({ pageId: '123' }, { boundByUserId: user1 });
    expect(config.credentialSource).toBe(CREDENTIAL_SOURCE_ENVIRONMENT);
    expect(config.boundByUserId).toBe(user1);
    expect(config.pageId).toBe('123');
  });
});
