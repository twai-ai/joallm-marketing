// Environment configuration with validation
import { z } from 'zod';

/** Must match Dockerfile build placeholder. Do not put this literal in other checks —
 *  entrypoint.sh sed-replaces every occurrence in the JS bundle at runtime. */
const API_URL_BUILD_PLACEHOLDER = '__API_URL_PLACEHOLDER__';
const API_BASE_URL_BUILD_PLACEHOLDER = '__API_BASE_URL_PLACEHOLDER__';

function normalizeApiUrl(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim().replace(/\/$/, '');
  if (
    !value ||
    value.includes(API_URL_BUILD_PLACEHOLDER) ||
    value.includes(API_BASE_URL_BUILD_PLACEHOLDER)
  ) {
    return fallback;
  }
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes('localhost') || value.startsWith('127.')) return `http://${value}`;
  return `https://${value}`;
}

function isUnusableApiUrl(api: string): boolean {
  const value = api.trim().toLowerCase();
  return (
    !value ||
    value.includes('localhost') ||
    value.includes('127.0.0.1') ||
    value.includes('railway.internal') ||
    // leftover build tokens (split so runtime sed cannot rewrite this check)
    value.includes('__api_url_') ||
    value.includes('__api_base_url_')
  );
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

// Validate and parse environment variables
function validateEnv() {
  const fallbackApi = 'http://localhost:3001';
  try {
    return envSchema.parse({
      VITE_API_URL: normalizeApiUrl(import.meta.env.VITE_API_URL, fallbackApi),
      VITE_API_BASE_URL: normalizeApiUrl(
        import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL,
        fallbackApi,
      ),
      VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS,
      VITE_ENABLE_DEBUG_MODE: import.meta.env.VITE_ENABLE_DEBUG_MODE,
      VITE_AUTO_LOGIN: import.meta.env.VITE_AUTO_LOGIN,
      VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      VITE_GOOGLE_REDIRECT_URI: import.meta.env.VITE_GOOGLE_REDIRECT_URI,
      VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    });
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    // Return defaults if validation fails
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
  return normalizeApiUrl(env.VITE_API_URL || env.VITE_API_BASE_URL, 'http://localhost:3001');
}

export function isApiUrlMisconfigured(): boolean {
  if (env.VITE_APP_ENV !== 'production') return false;
  return isUnusableApiUrl(resolveApiBaseUrl());
}

// Log configuration in development
if (env.VITE_ENABLE_DEBUG_MODE) {
  // debug mode enabled — logging handled per-component
}
