/**
 * Meta Graph helpers for Page + Instagram (Acquisition Intelligence).
 */

import { createHash } from 'crypto';
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

function normalizeAdAccountId(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

export type MetaAdAccountProbeResult = {
  ok: boolean;
  adAccountId: string | null;
  accountName: string | null;
  currency: string | null;
  accountStatus: number | null;
  error: string | null;
  tokenConfigured: boolean;
  adAccountConfigured: boolean;
};

/** Live check that token can read the Ad Account (Marketing API). */
export async function probeMetaAdAccount(options?: {
  adAccountId?: string;
  accessToken?: string;
}): Promise<MetaAdAccountProbeResult> {
  const accessToken = options?.accessToken || config.metaAccessToken || null;
  const adAccountId = normalizeAdAccountId(
    options?.adAccountId || config.metaAdAccountId || null,
  );
  const base: MetaAdAccountProbeResult = {
    ok: false,
    adAccountId,
    accountName: null,
    currency: null,
    accountStatus: null,
    error: null,
    tokenConfigured: Boolean(accessToken),
    adAccountConfigured: Boolean(adAccountId),
  };

  if (!accessToken || !adAccountId) {
    return {
      ...base,
      error: !accessToken
        ? 'META_ACCESS_TOKEN not configured on backend'
        : 'META_AD_ACCOUNT_ID not configured on backend',
    };
  }

  try {
    const url = new URL(`https://graph.facebook.com/v20.0/${adAccountId}`);
    url.searchParams.set('fields', 'id,name,currency,account_status');
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
    return {
      ...base,
      ok: true,
      adAccountId: typeof data.id === 'string' ? data.id : adAccountId,
      accountName: typeof data.name === 'string' ? data.name : null,
      currency: typeof data.currency === 'string' ? data.currency : null,
      accountStatus: typeof data.account_status === 'number' ? data.account_status : null,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : 'Meta Ad Account probe failed',
    };
  }
}

export type MetaLeadDetail = {
  id: string;
  createdTime: string | null;
  formId: string | null;
  adId: string | null;
  adsetId: string | null;
  campaignId: string | null;
  fieldData: Record<string, string>;
  email: string | null;
  phone: string | null;
  fullName: string | null;
};

/** Fetch a Lead Ads submission by leadgen_id. */
export async function fetchMetaLeadById(
  leadgenId: string,
  accessToken?: string,
): Promise<{ ok: true; lead: MetaLeadDetail } | { ok: false; error: string }> {
  const token = accessToken || config.metaAccessToken;
  if (!token) return { ok: false, error: 'META_ACCESS_TOKEN not configured' };
  if (!leadgenId) return { ok: false, error: 'leadgen_id required' };

  try {
    const url = new URL(`https://graph.facebook.com/v20.0/${leadgenId}`);
    url.searchParams.set(
      'fields',
      'id,created_time,field_data,ad_id,adset_id,campaign_id,form_id',
    );
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const err =
        typeof data.error === 'object' && data.error && 'message' in (data.error as object)
          ? String((data.error as { message?: string }).message)
          : `Graph API ${response.status}`;
      return { ok: false, error: err };
    }

    const fieldData: Record<string, string> = {};
    const rawFields = Array.isArray(data.field_data) ? data.field_data : [];
    for (const row of rawFields) {
      if (!row || typeof row !== 'object') continue;
      const name = String((row as { name?: string }).name || '').toLowerCase();
      const values = (row as { values?: string[] }).values;
      const value = Array.isArray(values) ? String(values[0] || '') : '';
      if (name) fieldData[name] = value;
    }

    const pick = (...keys: string[]) => {
      for (const key of keys) {
        if (fieldData[key]) return fieldData[key];
      }
      return null;
    };

    return {
      ok: true,
      lead: {
        id: String(data.id || leadgenId),
        createdTime: typeof data.created_time === 'string' ? data.created_time : null,
        formId: typeof data.form_id === 'string' ? data.form_id : null,
        adId: typeof data.ad_id === 'string' ? data.ad_id : null,
        adsetId: typeof data.adset_id === 'string' ? data.adset_id : null,
        campaignId: typeof data.campaign_id === 'string' ? data.campaign_id : null,
        fieldData,
        email: pick('email', 'email_address'),
        phone: pick('phone', 'phone_number', 'mobile'),
        fullName:
          pick('full_name', 'fullname') ||
          [pick('first_name'), pick('last_name')].filter(Boolean).join(' ') ||
          null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Lead fetch failed',
    };
  }
}

export type MetaInsightsSnapshot = {
  datePreset: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number | null;
  ctr: number | null;
  reach: number | null;
  currency: string | null;
  fetchedAt: string;
};

/** Pull account-level insights for the last N days (Marketing API). */
export async function fetchMetaAdAccountInsights(options?: {
  adAccountId?: string;
  accessToken?: string;
  datePreset?: string;
}): Promise<
  | { ok: true; insights: MetaInsightsSnapshot; accountName: string | null }
  | { ok: false; error: string }
> {
  const accessToken = options?.accessToken || config.metaAccessToken;
  const adAccountId = normalizeAdAccountId(
    options?.adAccountId || config.metaAdAccountId || null,
  );
  const datePreset = options?.datePreset || 'last_7d';

  if (!accessToken || !adAccountId) {
    return {
      ok: false,
      error: !accessToken
        ? 'META_ACCESS_TOKEN not configured'
        : 'META_AD_ACCOUNT_ID not configured',
    };
  }

  try {
    const accountUrl = new URL(`https://graph.facebook.com/v20.0/${adAccountId}`);
    accountUrl.searchParams.set('fields', 'name,currency');
    const accountRes = await fetch(accountUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const accountData = (await accountRes.json()) as Record<string, unknown>;
    if (!accountRes.ok) {
      const err =
        typeof accountData.error === 'object' &&
        accountData.error &&
        'message' in (accountData.error as object)
          ? String((accountData.error as { message?: string }).message)
          : `Graph API ${accountRes.status}`;
      return { ok: false, error: err };
    }

    const insightsUrl = new URL(
      `https://graph.facebook.com/v20.0/${adAccountId}/insights`,
    );
    insightsUrl.searchParams.set(
      'fields',
      'impressions,clicks,spend,cpc,ctr,reach',
    );
    insightsUrl.searchParams.set('date_preset', datePreset);
    insightsUrl.searchParams.set('level', 'account');

    const insightsRes = await fetch(insightsUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const insightsData = (await insightsRes.json()) as {
      data?: Array<Record<string, string>>;
      error?: { message?: string };
    };
    if (!insightsRes.ok) {
      return {
        ok: false,
        error: insightsData.error?.message || `Graph API ${insightsRes.status}`,
      };
    }

    const row = insightsData.data?.[0] || {};
    const num = (key: string) => {
      const v = Number(row[key]);
      return Number.isFinite(v) ? v : 0;
    };

    return {
      ok: true,
      accountName: typeof accountData.name === 'string' ? accountData.name : null,
      insights: {
        datePreset,
        impressions: num('impressions'),
        clicks: num('clicks'),
        spend: num('spend'),
        cpc: row.cpc != null ? Number(row.cpc) : null,
        ctr: row.ctr != null ? Number(row.ctr) : null,
        reach: row.reach != null ? Number(row.reach) : null,
        currency: typeof accountData.currency === 'string' ? accountData.currency : null,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Insights fetch failed',
    };
  }
}

function graphErrorMessage(data: unknown, status: number): string {
  if (
    typeof data === 'object' &&
    data &&
    'error' in data &&
    typeof (data as { error?: unknown }).error === 'object' &&
    (data as { error?: { message?: string } }).error &&
    'message' in ((data as { error: { message?: string } }).error as object)
  ) {
    return String((data as { error: { message?: string } }).error.message);
  }
  return `Graph API ${status}`;
}

function sha256Normalize(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/** Upload an image into the ad account image library; returns image_hash. */
export async function uploadMetaAdImage(options: {
  buffer: Buffer;
  filename: string;
  contentType?: string;
  adAccountId?: string;
  accessToken?: string;
}): Promise<{ ok: true; imageHash: string } | { ok: false; error: string }> {
  const accessToken = options.accessToken || config.metaAccessToken;
  const adAccountId = normalizeAdAccountId(
    options.adAccountId || config.metaAdAccountId || null,
  );
  if (!accessToken || !adAccountId) {
    return {
      ok: false,
      error: !accessToken
        ? 'META_ACCESS_TOKEN not configured'
        : 'META_AD_ACCOUNT_ID not configured',
    };
  }

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(options.buffer)], {
      type: options.contentType || 'image/jpeg',
    });
    form.append('filename', blob, options.filename || 'creative.jpg');
    form.append('access_token', accessToken);

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${adAccountId}/adimages`,
      { method: 'POST', body: form },
    );
    const data = (await response.json()) as {
      images?: Record<string, { hash?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      return { ok: false, error: graphErrorMessage(data, response.status) };
    }
    const first = data.images ? Object.values(data.images)[0] : null;
    const imageHash = first?.hash;
    if (!imageHash) {
      return { ok: false, error: 'Ad image upload returned no hash' };
    }
    return { ok: true, imageHash };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Ad image upload failed',
    };
  }
}

export type MetaAdsDraftResult = {
  mode: 'ad_paused' | 'creative_only';
  creativeId: string;
  adId: string | null;
  imageHash: string | null;
  adsetId: string | null;
  note: string;
};

/**
 * Create a Marketing API creative (and optionally a PAUSED ad under META_DEFAULT_ADSET_ID).
 * Ads stay PAUSED — activate spend in Ads Manager.
 */
export async function createMetaAdsDraft(options: {
  name: string;
  message: string;
  link?: string;
  imageHash?: string | null;
  adAccountId?: string;
  pageId?: string;
  adsetId?: string;
  accessToken?: string;
}): Promise<{ ok: true; draft: MetaAdsDraftResult } | { ok: false; error: string }> {
  const accessToken = options.accessToken || config.metaAccessToken;
  const adAccountId = normalizeAdAccountId(
    options.adAccountId || config.metaAdAccountId || null,
  );
  const pageId = options.pageId || config.metaPageId || null;
  const adsetId = options.adsetId || config.metaDefaultAdsetId || null;
  const link =
    options.link ||
    config.metaWebsiteUrl ||
    (pageId ? `https://www.facebook.com/${pageId}` : null);

  if (!accessToken || !adAccountId) {
    return {
      ok: false,
      error: !accessToken
        ? 'META_ACCESS_TOKEN not configured'
        : 'META_AD_ACCOUNT_ID not configured',
    };
  }
  if (!pageId) {
    return { ok: false, error: 'META_PAGE_ID required to create Meta Ads creatives' };
  }
  if (!link && !options.imageHash) {
    return {
      ok: false,
      error: 'Provide an image file or META_WEBSITE_URL / link for the creative',
    };
  }

  try {
    const objectStorySpec: Record<string, unknown> = { page_id: pageId };
    if (options.imageHash && link) {
      objectStorySpec.link_data = {
        message: options.message,
        link,
        name: options.name.slice(0, 40),
        image_hash: options.imageHash,
      };
    } else if (options.imageHash) {
      objectStorySpec.photo_data = {
        caption: options.message,
        image_hash: options.imageHash,
      };
    } else {
      objectStorySpec.link_data = {
        message: options.message,
        link,
        name: options.name.slice(0, 40),
      };
    }

    const creativeRes = await fetch(
      `https://graph.facebook.com/v20.0/${adAccountId}/adcreatives`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `ATRISI · ${options.name}`.slice(0, 100),
          object_story_spec: objectStorySpec,
        }),
      },
    );
    const creativeData = (await creativeRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!creativeRes.ok || !creativeData.id) {
      return {
        ok: false,
        error: graphErrorMessage(creativeData, creativeRes.status),
      };
    }

    if (!adsetId) {
      return {
        ok: true,
        draft: {
          mode: 'creative_only',
          creativeId: creativeData.id,
          adId: null,
          imageHash: options.imageHash || null,
          adsetId: null,
          note:
            'Creative created in Ads Manager. Set META_DEFAULT_ADSET_ID to also create a PAUSED ad under an existing ad set.',
        },
      };
    }

    const adRes = await fetch(`https://graph.facebook.com/v20.0/${adAccountId}/ads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `ATRISI · ${options.name}`.slice(0, 100),
        adset_id: adsetId,
        creative: { creative_id: creativeData.id },
        status: 'PAUSED',
      }),
    });
    const adData = (await adRes.json()) as { id?: string; error?: { message?: string } };
    if (!adRes.ok || !adData.id) {
      return {
        ok: false,
        error: `Creative ${creativeData.id} created, but ad failed: ${graphErrorMessage(adData, adRes.status)}`,
      };
    }

    return {
      ok: true,
      draft: {
        mode: 'ad_paused',
        creativeId: creativeData.id,
        adId: adData.id,
        imageHash: options.imageHash || null,
        adsetId,
        note: 'PAUSED ad created under META_DEFAULT_ADSET_ID — review and activate in Ads Manager.',
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Meta Ads draft failed',
    };
  }
}

/** Publish a photo to the Facebook Page feed (organic). */
export async function publishMetaPagePhoto(options: {
  message: string;
  buffer: Buffer;
  filename?: string;
  contentType?: string;
  pageId?: string;
  accessToken?: string;
  published?: boolean;
}): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const accessToken = options.accessToken || config.metaAccessToken;
  const pageId = options.pageId || config.metaPageId || null;
  if (!accessToken || !pageId) {
    return {
      ok: false,
      error: !accessToken
        ? 'META_ACCESS_TOKEN not configured'
        : 'META_PAGE_ID not configured',
    };
  }

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(options.buffer)], {
      type: options.contentType || 'image/jpeg',
    });
    form.append('source', blob, options.filename || 'post.jpg');
    form.append('caption', options.message);
    form.append('published', options.published === false ? 'false' : 'true');
    form.append('access_token', accessToken);

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/photos`,
      { method: 'POST', body: form },
    );
    const data = (await response.json()) as {
      id?: string;
      post_id?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      return { ok: false, error: graphErrorMessage(data, response.status) };
    }
    return { ok: true, postId: data.post_id || data.id || `page-photo:${Date.now()}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Page photo publish failed',
    };
  }
}

/**
 * Send a Lead event to Meta Conversions API (Pixel / dataset).
 * Prefer including lead_id from Lead Ads for high match quality.
 */
export async function sendMetaCapiLeadEvent(options: {
  leadId?: string | null;
  email?: string | null;
  phone?: string | null;
  eventTime?: Date;
  eventSourceUrl?: string;
  formId?: string | null;
  accessToken?: string;
  pixelId?: string;
}): Promise<
  | { ok: true; eventsReceived: number }
  | { ok: false; error: string; skipped?: boolean }
> {
  const pixelId = options.pixelId || config.metaPixelId || null;
  const accessToken =
    options.accessToken || config.metaCapiAccessToken || config.metaAccessToken || null;

  if (!pixelId) {
    return { ok: false, error: 'META_PIXEL_ID not configured', skipped: true };
  }
  if (!accessToken) {
    return { ok: false, error: 'META_ACCESS_TOKEN / META_CAPI_ACCESS_TOKEN missing' };
  }

  const userData: Record<string, unknown> = {};
  if (options.email) userData.em = [sha256Normalize(options.email)];
  if (options.phone) {
    const digits = options.phone.replace(/\D/g, '');
    if (digits) userData.ph = [sha256Normalize(digits)];
  }
  if (options.leadId) userData.lead_id = options.leadId;

  if (!userData.em && !userData.ph && !userData.lead_id) {
    return { ok: false, error: 'CAPI Lead needs email, phone, or lead_id', skipped: true };
  }

  try {
    const body = {
      data: [
        {
          event_name: 'Lead',
          event_time: Math.floor((options.eventTime || new Date()).getTime() / 1000),
          action_source: 'system_generated',
          event_source_url:
            options.eventSourceUrl || config.metaWebsiteUrl || undefined,
          user_data: userData,
          custom_data: options.formId
            ? { content_name: String(options.formId) }
            : undefined,
        },
      ],
    };

    const url = new URL(`https://graph.facebook.com/v20.0/${pixelId}/events`);
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as {
      events_received?: number;
      error?: { message?: string };
    };
    if (!response.ok) {
      return { ok: false, error: graphErrorMessage(data, response.status) };
    }
    return { ok: true, eventsReceived: data.events_received || 1 };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'CAPI send failed',
    };
  }
}

export { normalizeAdAccountId };
