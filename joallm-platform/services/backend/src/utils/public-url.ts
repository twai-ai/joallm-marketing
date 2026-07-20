/**
 * Normalize public URLs that Railway often injects as host-only (no scheme).
 */
export function normalizePublicUrl(raw: string | undefined | null, fallback: string): string {
  const value = (raw ?? '').trim() || fallback;
  const trimmed = value.replace(/\/$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Bare host → assume https in production-ish contexts
  if (trimmed.includes('localhost') || trimmed.startsWith('127.')) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

export function resolveRequestOrigin(headers: Record<string, unknown> | undefined): string | null {
  if (!headers) return null;
  const protoHeader = headers['x-forwarded-proto'];
  const hostHeader = headers['x-forwarded-host'] ?? headers.host;
  const proto = String(Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'https')
    .split(',')[0]
    .trim();
  const host = String(Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || '')
    .split(',')[0]
    .trim();
  if (!host) return null;
  return `${proto}://${host}`;
}
