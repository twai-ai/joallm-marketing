#!/usr/bin/env node

/**
 * Debug script to test vector search functionality
 */

import { config } from '../dist/config/config.js';
import { db } from '../dist/database/connection.js';
import { documentChunks, files } from '../dist/database/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { embeddingService } from '../dist/services/embedding-service.js';

async function debugVectorSearch() {
  console.log('🔍 Debugging vector search functionality...\n');

  try {
    // Test 1: Check if we have documents with embeddings
    console.log('1️⃣ Checking documents with embeddings...');
    const chunksWithEmbeddings = await db
      .select({
        id: documentChunks.id,
        content: documentChunks.content,
        embedding: documentChunks.embedding,
        filename: files.filename
      })
      .from(documentChunks)
      .innerJoin(files, eq(documentChunks.fileId, files.id))
      .where(sql`${documentChunks.embedding} IS NOT NULL`)
      .limit(5);

    console.log(`   Found ${chunksWithEmbeddings.length} chunks with embeddings`);
    
    if (chunksWithEmbeddings.length === 0) {
      console.log('   ❌ No chunks with embeddings found!');
      return;
    }

    // Test 2: Check embedding types
    console.log('\n2️⃣ Checking embedding types...');
    chunksWithEmbeddings.forEach((chunk, index) => {
      console.log(`   Chunk ${index + 1}: ${typeof chunk.embedding} - ${chunk.filename}`);
      if (typeof chunk.embedding === 'string') {
        try {
          const parsed = JSON.parse(chunk.embedding);
          console.log(`     Parsed length: ${parsed.length}`);
        } catch (e) {
          console.log(`     Failed to parse: ${e.message}`);
        }
      } else if (Array.isArray(chunk.embedding)) {
        console.log(`     Array length: ${chunk.embedding.length}`);
      } else if (chunk.embedding && typeof chunk.embedding === 'object') {
        console.log(`     Object keys: ${Object.keys(chunk.embedding)}`);
        if ('toArray' in chunk.embedding) {
          console.log(`     Has toArray method`);
        }
      }
    });

    // Test 3: Generate query embedding
    console.log('\n3️⃣ Testing query embedding generation...');
    const testQuery = "Railway deployment";
    const queryEmbedding = await embeddingService.generateQueryEmbedding(testQuery);
    console.log(`   Query: "${testQuery}"`);
    console.log(`   Query embedding length: ${queryEmbedding.length}`);
    console.log(`   Query embedding type: ${typeof queryEmbedding}`);

    // Test 4: Test similarity calculation
    console.log('\n4️⃣ Testing similarity calculation...');
    const testChunk = chunksWithEmbeddings[0];
    let chunkEmbedding;
    
    if (typeof testChunk.embedding === 'string') {
      chunkEmbedding = JSON.parse(testChunk.embedding);
    } else if (Array.isArray(testChunk.embedding)) {
      chunkEmbedding = testChunk.embedding;
    } else if (testChunk.embedding && typeof testChunk.embedding === 'object' && 'toArray' in testChunk.embedding) {
      chunkEmbedding = testChunk.embedding.toArray();
    }

    if (chunkEmbedding) {
      const similarity = embeddingService.calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
      console.log(`   Similarity with first chunk: ${similarity.toFixed(4)}`);
      console.log(`   Chunk content: ${testChunk.content.substring(0, 100)}...`);
    }

    // Test 5: Test database query
    console.log('\n5️⃣ Testing database query...');
    const searchQuery = db
      .select({
        id: documentChunks.id,
        content: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        metadata: documentChunks.metadata,
        fileId: documentChunks.fileId,
        filename: files.filename,
        uploadDate: files.createdAt,
        size: files.size,
        mimetype: files.mimetype,
        embedding: documentChunks.embedding,
      })
      .from(documentChunks)
      .innerJoin(files, eq(documentChunks.fileId, files.id))
      .where(
        and(
          sql`${documentChunks.embedding} IS NOT NULL`
        )
      )
      .limit(10);

    const results = await searchQuery;
    console.log(`   Database query returned ${results.length} results`);

    // Test 6: Test full vector search
    console.log('\n6️⃣ Testing full vector search...');
    const { enhancedRAGService } = await import('../dist/services/enhanced-rag-service.js');
    
    const searchResults = await enhancedRAGService.search({
      query: testQuery,
      limit: 5,
      threshold: 0.1,
      searchType: 'vector'
    });

    console.log(`   Vector search returned ${searchResults.length} results`);
    
    if (searchResults.length > 0) {
      console.log(`   Top result:`);
      console.log(`     Content: ${searchResults[0].content.substring(0, 100)}...`);
      console.log(`     Score: ${searchResults[0].score.toFixed(4)}`);
      console.log(`     File: ${searchResults[0].file.filename}`);
    }

    // Test 7: Test hybrid search
    console.log('\n7️⃣ Testing hybrid search...');
    const hybridResults = await enhancedRAGService.search({
      query: testQuery,
      limit: 5,
      threshold: 0.1,
      searchType: 'hybrid'
    });

    console.log(`   Hybrid search returned ${hybridResults.length} results`);
    
    if (hybridResults.length > 0) {
      console.log(`   Top result:`);
      console.log(`     Content: ${hybridResults[0].content.substring(0, 100)}...`);
      console.log(`     Score: ${hybridResults[0].score.toFixed(4)}`);
      console.log(`     Vector Score: ${hybridResults[0].vectorScore.toFixed(4)}`);
      console.log(`     Keyword Score: ${hybridResults[0].keywordScore.toFixed(4)}`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug
debugVectorSearch().catch(console.error);
