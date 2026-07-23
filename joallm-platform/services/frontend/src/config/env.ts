// Environment configuration with validation
import { z } from 'zod';

type RuntimeEnv = {
  VITE_API_URL?: string;
  VITE_API_BASE_URL?: string;
  VITE_APP_ENV?: string;
};

declare global {
  interface Window {
    __ATRISI_ENV__?: RuntimeEnv;
  }
}

function readRuntimeEnv(): RuntimeEnv {
  if (typeof window === 'undefined') return {};
  return window.__ATRISI_ENV__ ?? {};
}

/** Unsubstituted Docker build tokens — never embed the full placeholder string
 *  in source (entrypoint used to sed-replace every occurrence and break checks). */
function isBuildPlaceholder(value: string): boolean {
  return value.includes('__API_URL_') || value.includes('__API_BASE_URL_');
}

function normalizeApiUrl(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim().replace(/\/$/, '');
  if (!value || isBuildPlaceholder(value)) return fallback;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes('localhost') || value.startsWith('127.')) return `http://${value}`;
  return `https://${value}`;
}

/** Public production API — used when runtime config is missing on ATRISI hosts. */
export const PRODUCTION_API_URL =
  'https://joallm-marketing-backend-production.up.railway.app';

function isUnusableApiUrl(api: string): boolean {
  const value = api.trim().toLowerCase();
  return (
    !value ||
    value.includes('localhost') ||
    value.includes('127.0.0.1') ||
    value.includes('railway.internal') ||
    isBuildPlaceholder(value)
  );
}

function isRunningOnPublicHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.startsWith('127.')) return false;
  return true;
}

function isLegacyPlatformHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.toLowerCase() === 'platform.joallm.ai';
}

const envSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3001'),
  VITE_API_BASE_URL: z.string().url().default('http://localhost:3001'),
  VITE_ENABLE_ANALYTICS: z.string().transform(val => val === 'true').default('false'),
  VITE_ENABLE_DEBUG_MODE: z.string().transform(val => val === 'true').default('false'),
  VITE_AUTO_LOGIN: z.string().transform(val => val === 'true').default('false'),
  VITE_GOOGLE_CLIENT_ID: z.string().default('<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com'),
  VITE_GOOGLE_REDIRECT_URI: z.string().default('http://localhost:3001/api/auth/google/callback'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

function validateEnv() {
  const fallbackApi = 'http://localhost:3001';
  const runtime = readRuntimeEnv();

  try {
    return envSchema.parse({
      VITE_API_URL: normalizeApiUrl(
        runtime.VITE_API_URL || import.meta.env.VITE_API_URL,
        fallbackApi,
      ),
      VITE_API_BASE_URL: normalizeApiUrl(
        runtime.VITE_API_BASE_URL ||
          runtime.VITE_API_URL ||
          import.meta.env.VITE_API_BASE_URL ||
          import.meta.env.VITE_API_URL,
        fallbackApi,
      ),
      VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS,
      VITE_ENABLE_DEBUG_MODE: import.meta.env.VITE_ENABLE_DEBUG_MODE,
      VITE_AUTO_LOGIN: import.meta.env.VITE_AUTO_LOGIN,
      VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      VITE_GOOGLE_REDIRECT_URI: import.meta.env.VITE_GOOGLE_REDIRECT_URI,
      VITE_APP_ENV: runtime.VITE_APP_ENV || import.meta.env.VITE_APP_ENV,
    });
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    return {
      VITE_API_URL: fallbackApi,
      VITE_API_BASE_URL: fallbackApi,
      VITE_ENABLE_ANALYTICS: false,
      VITE_ENABLE_DEBUG_MODE: false,
      VITE_AUTO_LOGIN: true,
      VITE_GOOGLE_CLIENT_ID: '<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com',
      VITE_GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/auth/google/callback',
      VITE_APP_ENV: 'development' as const,
    };
  }
}

export const env = validateEnv();

export function resolveApiBaseUrl(): string {
  // Prefer runtime config written by entrypoint (avoids brittle sed on the JS bundle)
  const runtime = readRuntimeEnv();
  const preferred = runtime.VITE_API_URL || runtime.VITE_API_BASE_URL || env.VITE_API_URL || env.VITE_API_BASE_URL;
  const normalized = normalizeApiUrl(preferred, 'http://localhost:3001');

  // Public hosts must never fall back to localhost — that yields Chrome's
  // "This site can't be reached / Check if there is a typo" on Google login.
  if (isRunningOnPublicHost() && isUnusableApiUrl(normalized)) {
    return PRODUCTION_API_URL;
  }
  return normalized;
}

export function isApiUrlMisconfigured(): boolean {
  const api = resolveApiBaseUrl();
  const appEnv = readRuntimeEnv().VITE_APP_ENV || env.VITE_APP_ENV;
  const onPublicHost = isRunningOnPublicHost();

  // Treat public deployments as production even if VITE_APP_ENV was baked wrong
  if (appEnv !== 'production' && !onPublicHost) return false;
  return isUnusableApiUrl(api);
}

/** Old JoaLLM hostname — Google OAuth / API point at a different stack. */
export function getCanonicalPlatformOrigin(): string | null {
  if (!isLegacyPlatformHost()) return null;
  return 'https://platform.atrisi.org';
}
