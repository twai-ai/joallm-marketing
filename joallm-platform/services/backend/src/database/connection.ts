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

// Initialize pgvector extension
export async function initializeExtensions(): Promise<void> {
  try {
    await client`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ pgvector extension initialized successfully');
  } catch (error) {
    console.warn('⚠️ Failed to initialize pgvector extension (RAG features will be disabled):', error);
    // Don't throw - allow server to start without pgvector
    // This enables deployment before pgvector is set up
  }
}
