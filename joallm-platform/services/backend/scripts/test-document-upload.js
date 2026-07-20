#!/usr/bin/env node

/**
 * Test script to verify document upload and processing pipeline
 * This script simulates uploading a document and checks if it gets properly processed and indexed
 */

import { config } from '../dist/config/config.js';
import { db } from '../dist/database/connection.js';
import { files, documentChunks } from '../dist/database/schema.js';
import { eq, desc } from 'drizzle-orm';

async function testDocumentUpload() {
  console.log('🧪 Testing document upload and processing pipeline...\n');

  try {
    // Check the most recently uploaded file
    const recentFiles = await db
      .select({
        id: files.id,
        filename: files.filename,
        status: files.status,
        metadata: files.metadata,
        createdAt: files.createdAt
      })
      .from(files)
      .orderBy(desc(files.createdAt))
      .limit(1);

    if (recentFiles.length === 0) {
      console.log('ℹ️  No files found in database. Please upload a document first.');
      return;
    }

    const file = recentFiles[0];
    console.log(`📄 Testing file: ${file.filename}`);
    console.log(`   ID: ${file.id}`);
    console.log(`   Status: ${file.status}`);
    console.log(`   Created: ${file.createdAt}`);

    if (file.metadata) {
      console.log(`   Metadata:`);
      console.log(`     - Chunks: ${file.metadata.chunks || 'N/A'}`);
      console.log(`     - Embedding Model: ${file.metadata.embeddingModel || 'N/A'}`);
      console.log(`     - Word Count: ${file.metadata.wordCount || 'N/A'}`);
      console.log(`     - Indexed At: ${file.metadata.indexedAt || 'N/A'}`);
    }

    // Check if the file has chunks with embeddings
    const chunks = await db
      .select({
        id: documentChunks.id,
        content: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        hasEmbedding: documentChunks.embedding
      })
      .from(documentChunks)
      .where(eq(documentChunks.fileId, file.id))
      .orderBy(documentChunks.chunkIndex);

    console.log(`\n📊 Document Analysis:`);
    console.log(`   Total chunks: ${chunks.length}`);
    
    const chunksWithEmbeddings = chunks.filter(chunk => chunk.hasEmbedding !== null);
    console.log(`   Chunks with embeddings: ${chunksWithEmbeddings.length}`);
    console.log(`   Embedding coverage: ${chunks.length > 0 ? ((chunksWithEmbeddings.length / chunks.length) * 100).toFixed(1) : 0}%`);

    if (chunks.length > 0) {
      console.log(`\n📝 Sample chunk content:`);
      console.log(`   Chunk 1: ${chunks[0].content.substring(0, 100)}...`);
      
      if (chunksWithEmbeddings.length > 0) {
        console.log(`   ✅ Embeddings are properly generated`);
      } else {
        console.log(`   ❌ No embeddings found - document needs to be indexed`);
      }
    }

    // Test RAG search on this document
    if (chunksWithEmbeddings.length > 0) {
      console.log(`\n🔍 Testing RAG search on this document...`);
      
      try {
        const { ragService } = await import('../dist/services/rag-service.js');
        
        const searchResults = await ragService.search({
          query: "test search query",
          fileIds: [file.id],
          limit: 2,
          threshold: 0.1
        });

        console.log(`   ✅ RAG search successful: ${searchResults.length} results found`);
        
        if (searchResults.length > 0) {
          console.log(`   📄 Top result:`);
          console.log(`      Content: ${searchResults[0].content.substring(0, 80)}...`);
          console.log(`      Score: ${searchResults[0].score.toFixed(4)}`);
        }
      } catch (searchError) {
        console.log(`   ❌ RAG search failed: ${searchError.message}`);
      }
    }

    // Summary
    console.log(`\n📋 Summary:`);
    if (file.status === 'processed' && chunksWithEmbeddings.length > 0) {
      console.log(`   ✅ Document is properly processed and indexed`);
      console.log(`   ✅ Ready for RAG search and querying`);
    } else if (file.status === 'processed' && chunksWithEmbeddings.length === 0) {
      console.log(`   ⚠️  Document is processed but not indexed`);
      console.log(`   💡 Run: node scripts/reindex-all-documents.js`);
    } else if (file.status === 'processing') {
      console.log(`   ⏳ Document is still being processed`);
    } else if (file.status === 'failed') {
      console.log(`   ❌ Document processing failed`);
    } else {
      console.log(`   ❓ Document status unclear`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testDocumentUpload().catch(console.error);
