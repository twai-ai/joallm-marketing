import type { Config } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/joallm_dev';
const isRailwayPublicUrl = databaseUrl.includes('.proxy.rlwy.net');

export default {
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
    ssl: isRailwayPublicUrl ? 'require' : undefined,
  },
  verbose: true,
  strict: true,
} satisfies Config;

