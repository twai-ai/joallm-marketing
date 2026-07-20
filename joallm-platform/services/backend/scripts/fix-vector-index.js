#!/usr/bin/env node

/**
 * Fix Vector Index - Run this script to fix the btree index issue
 * 
 * This script drops the problematic btree index and creates a proper
 * ivfflat vector index for pgvector embeddings.
 * 
 * Usage:
 *   node scripts/fix-vector-index.js
 *   
 * Or via Railway:
 *   railway run --service backend node scripts/fix-vector-index.js
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment variables');
  process.exit(1);
}

async function fixVectorIndex() {
  console.log('🔧 Fixing vector index for embeddings...\n');
  
  const sql = postgres(DATABASE_URL, { ssl: 'require' });
  
  try {
    console.log('1. Checking current index...');
    const currentIndex = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE indexname = 'document_chunks_embedding_idx'
    `;
    
    if (currentIndex.length > 0) {
      console.log('   Current index:', currentIndex[0].indexdef);
      
      if (currentIndex[0].indexdef.includes('btree')) {
        console.log('   ⚠️  Index is btree (WRONG TYPE - causing errors)');
      } else if (currentIndex[0].indexdef.includes('ivfflat')) {
        console.log('   ✓ Index is already ivfflat (correct type)');
        console.log('\n✅ Index is correct! No fix needed.');
        await sql.end();
        return;
      }
    } else {
      console.log('   ⚠️  No index found');
    }
    
    console.log('\n2. Dropping existing index...');
    await sql`DROP INDEX IF EXISTS "document_chunks_embedding_idx"`;
    console.log('   ✓ Old index dropped');
    
    console.log('\n3. Creating ivfflat vector index...');
    await sql`
      CREATE INDEX "document_chunks_embedding_idx" 
      ON "document_chunks" 
      USING ivfflat ("embedding" vector_cosine_ops) 
      WITH (lists = 100)
    `;
    console.log('   ✓ New vector index created');
    
    console.log('\n4. Verifying new index...');
    const newIndex = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE indexname = 'document_chunks_embedding_idx'
    `;
    
    if (newIndex.length > 0) {
      console.log('   ✓ New index:', newIndex[0].indexdef);
      
      if (newIndex[0].indexdef.includes('ivfflat')) {
        console.log('\n✅ SUCCESS! Vector index fixed!');
        console.log('   Embeddings can now be stored properly.');
        console.log('   Markdown files will now be indexed and searchable.\n');
      } else {
        console.log('\n❌ ERROR: Index still not correct');
      }
    }
    
    await sql.end();
    
  } catch (error) {
    console.error('\n❌ Error fixing index:', error);
    await sql.end();
    process.exit(1);
  }
}

fixVectorIndex();

