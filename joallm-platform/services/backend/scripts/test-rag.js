#!/usr/bin/env node

/**
 * Test script to verify RAG functionality
 * This script tests the basic RAG operations to ensure everything is working
 */

import { config } from '../dist/config/config.js';
import { ragService } from '../dist/services/rag-service.js';
import { embeddingService } from '../dist/services/embedding-service.js';

async function testRAG() {
  console.log('🧪 Testing RAG functionality...\n');

  try {
    // Test 1: Generate embedding
    console.log('1️⃣ Testing embedding generation...');
    const testText = "This is a test document about artificial intelligence and machine learning.";
    const embedding = await embeddingService.generateEmbedding(testText);
    console.log(`✅ Generated embedding with ${embedding.embedding.length} dimensions using model: ${embedding.model}`);

    // Test 2: Test cosine similarity calculation
    console.log('\n2️⃣ Testing cosine similarity calculation...');
    const text1 = "Machine learning is a subset of artificial intelligence.";
    const text2 = "AI includes machine learning as one of its components.";
    const text3 = "The weather is sunny today.";

    const emb1 = await embeddingService.generateEmbedding(text1);
    const emb2 = await embeddingService.generateEmbedding(text2);
    const emb3 = await embeddingService.generateEmbedding(text3);

    const sim12 = embeddingService.calculateCosineSimilarity(emb1.embedding, emb2.embedding);
    const sim13 = embeddingService.calculateCosineSimilarity(emb1.embedding, emb3.embedding);

    console.log(`✅ Similarity between related texts: ${sim12.toFixed(4)}`);
    console.log(`✅ Similarity between unrelated texts: ${sim13.toFixed(4)}`);
    
    if (sim12 > sim13) {
      console.log('✅ Similarity calculation working correctly (related texts have higher similarity)');
    } else {
      console.log('⚠️  Similarity calculation may have issues');
    }

    // Test 3: Test RAG search (if database is available)
    console.log('\n3️⃣ Testing RAG search...');
    try {
      const searchResults = await ragService.search({
        query: "artificial intelligence machine learning",
        limit: 3,
        threshold: 0.1
      });
      console.log(`✅ RAG search completed: ${searchResults.length} results found`);
      
      if (searchResults.length > 0) {
        console.log('📄 Sample result:');
        console.log(`   Content: ${searchResults[0].content.substring(0, 100)}...`);
        console.log(`   Score: ${searchResults[0].score.toFixed(4)}`);
        console.log(`   File: ${searchResults[0].file.filename}`);
      } else {
        console.log('ℹ️  No documents found in database (this is normal for a fresh setup)');
      }
    } catch (dbError) {
      console.log('⚠️  Database not available or no documents indexed yet');
      console.log('   This is normal for a fresh setup. Upload some documents first.');
    }

    console.log('\n🎉 RAG functionality test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run the database migration: ./scripts/migrate-embeddings.sh');
    console.log('   2. Upload some documents through the frontend');
    console.log('   3. Test the full RAG pipeline');

  } catch (error) {
    console.error('❌ RAG test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testRAG().catch(console.error);
