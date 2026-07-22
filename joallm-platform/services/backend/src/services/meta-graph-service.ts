/**
 * Meta Graph helpers for Page + Instagram (Acquisition Intelligence).
 */

import { config } from '../config/config.js';

export type MetaPageProbeResult = {
  ok: boolean;
  pageId: string | null;
  pageName: string | null;
  igAccountId: string | null;
  igUsername: string | null;
  error: string | null;
  tokenConfigured: boolean;
  pageIdConfigured: boolean;
  verifyTokenConfigured: boolean;
};

/** Live Graph check that token + page id can read the Page (and linked IG). */
export async function probeMetaPageConnection(options?: {
  pageId?: string;
  accessToken?: string;
}): Promise<MetaPageProbeResult> {
  const accessToken = options?.accessToken || config.metaAccessToken || null;
  const pageId = options?.pageId || config.metaPageId || null;
  const base: MetaPageProbeResult = {
    ok: false,
    pageId,
    pageName: null,
    igAccountId: config.metaInstagramAccountId || null,
    igUsername: null,
    error: null,
    tokenConfigured: Boolean(accessToken),
    pageIdConfigured: Boolean(pageId),
    verifyTokenConfigured: Boolean(config.metaVerifyToken),
  };

  if (!accessToken || !pageId) {
    return {
      ...base,
      error: !accessToken
        ? 'META_ACCESS_TOKEN not configured on backend'
        : 'META_PAGE_ID not configured on backend',
    };
  }

  try {
    const url = new URL(`https://graph.facebook.com/v20.0/${pageId}`);
    url.searchParams.set(
      'fields',
      'id,name,instagram_business_account{id,username}',
    );
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const err =
        typeof data.error === 'object' && data.error && 'message' in (data.error as object)
          ? String((data.error as { message?: string }).message)
          : `Graph API ${response.status}`;
      return { ...base, error: err };
    }

    const ig =
      data.instagram_business_account &&
      typeof data.instagram_business_account === 'object'
        ? (data.instagram_business_account as { id?: string; username?: string })
        : null;

    return {
      ...base,
      ok: true,
      pageId: typeof data.id === 'string' ? data.id : pageId,
      pageName: typeof data.name === 'string' ? data.name : null,
      igAccountId: ig?.id || config.metaInstagramAccountId || null,
      igUsername: ig?.username || null,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : 'Meta Page Graph probe failed',
    };
  }
}
