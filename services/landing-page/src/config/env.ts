// Environment configuration with validation
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3001'),
  VITE_ENABLE_ANALYTICS: z.string().transform(val => val === 'true').default('false'),
  VITE_ENABLE_DEBUG_MODE: z.string().transform(val => val === 'true').default('false'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

// Validate and parse environment variables
function validateEnv() {
  try {
    return envSchema.parse({
      VITE_API_URL: import.meta.env.VITE_API_URL,
      VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS,
      VITE_ENABLE_DEBUG_MODE: import.meta.env.VITE_ENABLE_DEBUG_MODE,
      VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    });
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    // Return defaults if validation fails
    return {
      VITE_API_URL: 'http://localhost:3001',
      VITE_ENABLE_ANALYTICS: false,
      VITE_ENABLE_DEBUG_MODE: false,
      VITE_APP_ENV: 'development' as const,
    };
  }
}

export const env = validateEnv();

// Log configuration in development
if (env.VITE_ENABLE_DEBUG_MODE) {
  // debug mode enabled — logging handled per-component
}


