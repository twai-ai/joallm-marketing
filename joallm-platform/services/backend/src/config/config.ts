import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  corsOrigin: z.string().default('http://localhost:5173,http://localhost:5174,http://localhost:3000,http://127.0.0.1:3000'),
  
  // Database
  databaseUrl: z.string().default('postgresql://shyamshundar@localhost:5432/joallm_dev'),
  databaseHost: z.string().optional(),
  databasePort: z.coerce.number().optional(),
  databaseName: z.string().optional(),
  databaseUser: z.string().optional(),
  databasePassword: z.string().optional(),
  
  // Redis
  redisUrl: z.string().default('redis://127.0.0.1:6379'),
  redisHost: z.string().optional(),
  redisPort: z.coerce.number().optional(),
  
  // API Keys (with defaults for development)
  openaiApiKey: z.string().default('PLACEHOLDER-OPENAI-KEY-NOT-SET'),
  anthropicApiKey: z.string().default('PLACEHOLDER-ANTHROPIC-KEY-NOT-SET'),
  groqApiKey: z.string().default('PLACEHOLDER-GROQ-KEY-NOT-SET'),
  cohereApiKey: z.string().default('PLACEHOLDER-COHERE-KEY-NOT-SET'),
  ollamaApiKey: z.string().default('PLACEHOLDER-OLLAMA-KEY-NOT-SET'),
  ollamaBaseUrl: z.string().default('http://localhost:11434'),
  
  // Google OAuth
  googleClientId: z.string(),
  googleClientSecret: z.string(),
  googleRedirectUri: z.string().default('http://localhost:3001/api/auth/google/callback'),
  
  // File Storage
  storageProvider: z.enum(['cloudflare-r2', 'aws-s3', 'volume']).default('volume'),
  storagePath: z.string().default('/app/data/uploads'),
  volumeMountPath: z.string().default('/app/data'),
  r2AccountId: z.string().optional(),
  r2AccessKeyId: z.string().optional(),
  r2SecretAccessKey: z.string().optional(),
  r2BucketName: z.string().optional(),
  r2TrainingBucketName: z.string().optional(),
  
  // JWT
  jwtSecret: z.string(),
  jwtExpiresIn: z.string().default('7d'),
  
  // API Key for service-to-service communication
  apiKey: z.string(),
  
  // Encryption key for sensitive data (API keys, etc.)
  encryptionKey: z.string(),
  
  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Meta / WhatsApp (Acquisition Intelligence) — optional on Railway backend
  metaVerifyToken: z.string().default('atrisi_meta_webhook_verify'),
  metaAccessToken: z.string().optional(),
  metaPhoneNumberId: z.string().optional(),
  metaAppSecret: z.string().optional(),
  metaEnableAutoReply: z.boolean().default(true),
  metaPageId: z.string().optional(),
  metaInstagramAccountId: z.string().optional(),
  // Soft fallback only — prefer Studio-connected Meta source (phone_number_id) at runtime.
  acquisitionDefaultOwnerUserId: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined),
    z.string().uuid().optional(),
  ),
});

// Map environment variables to schema keys
const envVars = {
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  corsOrigin: process.env.CORS_ORIGIN,
  databaseUrl: process.env.DATABASE_URL,
  databaseHost: process.env.DATABASE_HOST,
  databasePort: process.env.DATABASE_PORT,
  databaseName: process.env.DATABASE_NAME,
  databaseUser: process.env.DATABASE_USER,
  databasePassword: process.env.DATABASE_PASSWORD,
  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  cohereApiKey: process.env.COHERE_API_KEY,
  ollamaApiKey: process.env.OLLAMA_API_KEY,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
  storageProvider: process.env.STORAGE_PROVIDER,
  storagePath: process.env.STORAGE_PATH,
  volumeMountPath: process.env.VOLUME_MOUNT_PATH,
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  r2BucketName: process.env.R2_BUCKET_NAME,
  r2TrainingBucketName: process.env.R2_TRAINING_BUCKET_NAME,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  apiKey: process.env.API_KEY,
  encryptionKey: process.env.ENCRYPTION_KEY,
  logLevel: process.env.LOG_LEVEL,
  metaVerifyToken: process.env.META_VERIFY_TOKEN,
  metaAccessToken: process.env.META_ACCESS_TOKEN,
  metaPhoneNumberId: process.env.META_PHONE_NUMBER_ID,
  metaAppSecret: process.env.META_APP_SECRET,
  metaEnableAutoReply: process.env.META_ENABLE_AUTO_REPLY !== 'false',
  metaPageId: process.env.META_PAGE_ID,
  metaInstagramAccountId: process.env.META_INSTAGRAM_ACCOUNT_ID,
  acquisitionDefaultOwnerUserId: process.env.ACQUISITION_DEFAULT_OWNER_USER_ID,
};

// Validate environment variables
const parseResult = configSchema.safeParse(envVars);

if (!parseResult.success) {
  // Use console.error for startup errors before logger is available
  console.error('❌ Invalid environment variables:');
  console.error(parseResult.error.format());
  process.exit(1);
}

export const config = parseResult.data;

// Railway often injects host-only values; Google requires an absolute redirect URI.
{
  const raw = (config.googleRedirectUri || '').trim();
  if (raw && !/^https?:\/\//i.test(raw)) {
    const withScheme = raw.includes('localhost') || raw.startsWith('127.')
      ? `http://${raw}`
      : `https://${raw}`;
    (config as { googleRedirectUri: string }).googleRedirectUri = withScheme.replace(/\/$/, '');
  } else if (raw) {
    (config as { googleRedirectUri: string }).googleRedirectUri = raw.replace(/\/$/, '');
  }
}

// Production validation - ensure critical secrets are set
if (config.nodeEnv === 'production') {
  const requiredSecrets = [
    { key: 'jwtSecret', value: config.jwtSecret, placeholder: 'dev-jwt-secret' },
    { key: 'apiKey', value: config.apiKey, placeholder: 'dev-api-key' },
    { key: 'encryptionKey', value: config.encryptionKey, placeholder: 'dev-encryption' },
    { key: 'googleClientId', value: config.googleClientId, placeholder: '' },
    { key: 'googleClientSecret', value: config.googleClientSecret, placeholder: '' },
  ];

  const missingOrWeak = requiredSecrets.filter(secret => 
    !secret.value || 
    secret.value.includes('dev-') || 
    secret.value.includes('PLACEHOLDER') ||
    secret.value.includes('change-in-production') ||
    (secret.placeholder && secret.value.includes(secret.placeholder))
  );

  if (missingOrWeak.length > 0) {
    // Use console.error for critical startup errors
    console.error('❌ CRITICAL: Missing or weak secrets in production:');
    missingOrWeak.forEach(s => console.error(`  - ${s.key}`));
    console.error('\nProduction deployment requires all secrets to be properly configured.');
    process.exit(1);
  }
}

// Helper to log configuration sources (called after logger is initialized)
export const logConfigSources = () => {
  const isPlaceholder = (key: string) => {
    return key.includes('PLACEHOLDER') || 
           key.includes('your-') || 
           key.includes('sk-your-') ||
           key.includes('gsk-your-') ||
           key.includes('sk-ant-your-') ||
           key.includes('cohere-your-') ||
           key.includes('ollama-your-');
  };
  
  const sources = {
    openai: isPlaceholder(config.openaiApiKey) ? 'default' : 'environment',
    groq: isPlaceholder(config.groqApiKey) ? 'default' : 'environment',
    anthropic: isPlaceholder(config.anthropicApiKey) ? 'default' : 'environment',
    cohere: isPlaceholder(config.cohereApiKey) ? 'default' : 'environment',
  };
  
  return sources;
};

// Helper functions
export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';
