/**
 * Authenticated file download helpers for Studio assets.
 */

import { API_ENDPOINTS } from '../config/api';
import { storage, STORAGE_KEYS } from './storage';

function getAuthToken(): string | null {
  try {
    return storage.getSecure<string>(STORAGE_KEYS.AUTH_TOKEN);
  } catch {
    return null;
  }
}

export async function fetchAuthenticatedBlob(url: string): Promise<Blob> {
  const token = getAuthToken();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Download failed (${response.status})`);
  }
  return response.blob();
}

const previewObjectUrlCache = new Map<string, string>();

/** Fetch image bytes via the preview endpoint (proxied — works with R2/S3). */
export async function getAuthenticatedPreviewObjectUrl(fileId: string): Promise<string> {
  const cached = previewObjectUrlCache.get(fileId);
  if (cached) return cached;

  const blob = await fetchAuthenticatedBlob(API_ENDPOINTS.files.preview(fileId));
  const objectUrl = URL.createObjectURL(blob);
  previewObjectUrlCache.set(fileId, objectUrl);
  return objectUrl;
}

export function revokeAuthenticatedPreviewObjectUrl(fileId: string): void {
  const url = previewObjectUrlCache.get(fileId);
  if (url) {
    URL.revokeObjectURL(url);
    previewObjectUrlCache.delete(fileId);
  }
}

export function clearAuthenticatedPreviewCache(): void {
  for (const url of previewObjectUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  previewObjectUrlCache.clear();
}

export async function downloadAuthenticatedFile(options: {
  url: string;
  filename: string;
}): Promise<void> {
  const blob = await fetchAuthenticatedBlob(options.url);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = options.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

/** Open an authenticated file in a new tab (Bearer token cannot be sent via plain <a href>). */
export async function openAuthenticatedFileInNewTab(url: string): Promise<void> {
  const blob = await fetchAuthenticatedBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    // Popup blocked — fall back to same-tab navigation
    window.location.assign(objectUrl);
    return;
  }
  // Revoke later so the new tab can load the blob
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function extensionForMime(mime: string | undefined, fallback = 'png'): string {
  if (!mime) return fallback;
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('png')) return 'png';
  if (mime.includes('mp4')) return 'mp4';
  return fallback;
}

export function safeDownloadFilename(title: string, ext: string): string {
  const base =
    title
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'creative';
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}
