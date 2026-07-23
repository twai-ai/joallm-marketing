import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config/config.js';
import * as schema from './schema.js';

// Create postgres connection
const connectionString = config.databaseUrl;

// Create postgres client with connection pooling
// Note: SSL disabled for Railway's internal network (secure by default)
const client = postgres(connectionString, {
  max: 20, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  // Railway's private network doesn't require SSL
  // If external DB with SSL is used, set DATABASE_URL with ?sslmode=require
  ssl: false,
  prepare: false, // Disable prepared statements for better compatibility
});

// Create drizzle database instance
export const db = drizzle(client, { schema });

// Export the postgres client for raw queries
export { client };

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Initialize database (with error handling)
export async function initializeDatabase(): Promise<void> {
  try {
    await checkDatabaseHealth();
  } catch (error) {
    console.warn('⚠️ Database not available - running in development mode without database');
    console.warn('To enable database features, set up PostgreSQL and update DATABASE_URL');
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await client.end();
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

// Initialize pgvector extension when the Postgres image supports it.
export async function initializeExtensions(): Promise<boolean> {
  try {
    await client`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ pgvector extension initialized successfully');
    return true;
  } catch (error) {
    console.warn(
      '⚠️ Failed to initialize pgvector extension (RAG vector search disabled). ' +
        'Use a Railway "Postgres + pgvector" plugin/template, then redeploy.',
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/** Drop legacy btree embedding indexes that overflow without pgvector/ivfflat. */
export async function repairEmbeddingIndexes(): Promise<void> {
  try {
    const rows = await client`
      SELECT indexdef
      FROM pg_indexes
      WHERE indexname = 'document_chunks_embedding_idx'
    `;
    const indexDef = String(rows[0]?.indexdef || '');
    if (indexDef && /using btree/i.test(indexDef)) {
      await client`DROP INDEX IF EXISTS "document_chunks_embedding_idx"`;
      console.warn(
        '⚠️ Dropped legacy btree document_chunks_embedding_idx (row size exceeds btree limit). ' +
          'Install pgvector and recreate an ivfflat/hnsw index for RAG.',
      );
    }
  } catch (error) {
    console.warn(
      '⚠️ Could not inspect/repair embedding index:',
      error instanceof Error ? error.message : error,
    );
  }
}
