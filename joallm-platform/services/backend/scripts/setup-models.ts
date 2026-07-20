#!/usr/bin/env tsx

/**
 * Setup script for models database table
 * This script generates the migration and seeds the models data
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { db } from '../src/database/connection.js';
import { models } from '../src/database/schema.js';
import { count, sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateMigration() {
  
  try {
    // Generate the migration using Drizzle
    execSync('npm run db:generate', { 
      cwd: join(__dirname, '..'),
      stdio: 'inherit' 
    });
  } catch (error) {
    console.error('❌ Migration generation failed:', error.message);
    throw error;
  }
}

async function runMigration() {
  
  try {
    // Run the migration using Drizzle
    execSync('npm run db:migrate', { 
      cwd: join(__dirname, '..'),
      stdio: 'inherit' 
    });
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function seedModels() {
  
  try {
    const seedPath = join(__dirname, '../src/database/seed-models.sql');
    const seedSQL = readFileSync(seedPath, 'utf8');
    
    // Execute the seed SQL using Drizzle
    await db.execute(sql.raw(seedSQL));
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  }
}

async function verifySetup() {
  
  try {
    // Count models using Drizzle
    const countResult = await db.select({ count: count() }).from(models);
    const modelCount = countResult[0].count;
    
    
    // Show some sample data
    const sampleResult = await db
      .select({
        modelId: models.modelId,
        name: models.name,
        provider: models.provider,
        isAvailable: models.isAvailable
      })
      .from(models)
      .orderBy(models.sortOrder)
      .limit(5);
    
    sampleResult.forEach(row => {
      const status = row.isAvailable ? 'Available' : 'Unavailable';
    });
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    
    await generateMigration();
    
    await runMigration();
    
    await seedModels();
    
    await verifySetup();
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
main();
