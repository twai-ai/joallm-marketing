#!/usr/bin/env node

/**
 * Setup script for models database table
 * This script generates the migration and seeds the models data
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateMigration() {
  console.log('🔄 Generating Drizzle migration for models table...');
  
  try {
    // Generate the migration using Drizzle
    execSync('npm run db:generate', { 
      cwd: join(__dirname, '..'),
      stdio: 'inherit' 
    });
    console.log('✅ Migration generated successfully');
  } catch (error) {
    console.error('❌ Migration generation failed:', error.message);
    throw error;
  }
}

async function runMigration() {
  console.log('🔄 Running Drizzle migration...');
  
  try {
    // Run the migration using Drizzle
    execSync('npm run db:migrate', { 
      cwd: join(__dirname, '..'),
      stdio: 'inherit' 
    });
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function seedModels() {
  console.log('🌱 Seeding models data...');
  
  try {
    const seedPath = join(__dirname, '../src/database/seed-models.sql');
    const seedSQL = readFileSync(seedPath, 'utf8');
    
    await db.query(seedSQL);
    console.log('✅ Models data seeded successfully');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  }
}

async function verifySetup() {
  console.log('🔍 Verifying setup...');
  
  try {
    // Use psql to verify the setup
    const countResult = execSync('psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM models;"', { 
      encoding: 'utf8',
      cwd: join(__dirname, '..')
    });
    const count = parseInt(countResult.trim());
    
    console.log(`✅ Found ${count} models in database`);
    
    // Show some sample data
    const sampleResult = execSync('psql $DATABASE_URL -t -c "SELECT model_id, name, provider, is_available FROM models ORDER BY sort_order LIMIT 5;"', { 
      encoding: 'utf8',
      cwd: join(__dirname, '..')
    });
    
    console.log('\n📋 Sample models:');
    const lines = sampleResult.trim().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      const [modelId, name, provider, isAvailable] = line.split('|').map(s => s.trim());
      const status = isAvailable === 't' ? 'Available' : 'Unavailable';
      console.log(`  - ${name} (${provider}) - ${status}`);
    });
    
  } catch (error) {
    console.log('⚠️  Could not verify setup automatically. Please check manually:');
    console.log('   psql $DATABASE_URL -c "SELECT COUNT(*) FROM models;"');
    console.log('   psql $DATABASE_URL -c "SELECT model_id, name, provider FROM models LIMIT 5;"');
  }
}

async function main() {
  try {
    console.log('🚀 Setting up models database with Drizzle...\n');
    
    await generateMigration();
    console.log('');
    
    await runMigration();
    console.log('');
    
    await seedModels();
    console.log('');
    
    await verifySetup();
    console.log('\n🎉 Models database setup completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
main();
