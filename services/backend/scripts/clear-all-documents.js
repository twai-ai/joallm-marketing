#!/usr/bin/env node

/**
 * Script to clear all uploaded documents and start fresh
 * This will remove all files and their associated chunks from the database
 */

import { db } from '../dist/database/connection.js';
import { files, documentChunks } from '../dist/database/schema.js';

async function clearAllDocuments() {
  try {
    console.log('🗑️  Starting to clear all documents...\n');
    
    // Get count of current documents
    const currentFiles = await db.select().from(files);
    const currentChunks = await db.select().from(documentChunks);
    
    console.log(`📊 Current Status:`);
    console.log(`   📁 Files: ${currentFiles.length}`);
    console.log(`   📄 Chunks: ${currentChunks.length}`);
    console.log('');
    
    if (currentFiles.length === 0) {
      console.log('✅ No documents to clear. Database is already empty.');
      return;
    }
    
    console.log('🗑️  Clearing document chunks...');
    await db.delete(documentChunks);
    console.log('   ✅ All document chunks deleted');
    
    console.log('🗑️  Clearing files...');
    await db.delete(files);
    console.log('   ✅ All files deleted');
    
    console.log('\n🎉 All documents cleared successfully!');
    console.log('📝 You can now upload new documents and they will be processed with:');
    console.log('   • Real text extraction from files');
    console.log('   • Proper chunking and embedding generation');
    console.log('   • Immediate searchability');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Go to http://localhost:5173');
    console.log('   2. Open Knowledge Base');
    console.log('   3. Upload your new documents');
    console.log('   4. Documents will be automatically processed and searchable');
    
  } catch (error) {
    console.error('❌ Error clearing documents:', error.message);
  }
}

// Run the script
clearAllDocuments();
