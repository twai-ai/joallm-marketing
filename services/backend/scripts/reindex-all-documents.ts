/**
 * Script to reindex all documents and generate embeddings
 * This is useful when:
 * - Documents were uploaded but embeddings weren't generated
 * - You want to switch embedding providers
 * - Embeddings got corrupted or deleted
 */

import { db } from '../src/database/connection.js';
import { files, documentChunks } from '../src/database/schema.js';
import { eq, sql } from 'drizzle-orm';
import { embeddingService } from '../src/services/embedding-service.js';
import { logger } from '../src/utils/logger.js';

async function reindexAllDocuments() {
  try {
    console.log('🔄 Starting document reindexing process...\n');

    // Get all processed files
    const allFiles = await db
      .select()
      .from(files)
      .where(eq(files.status, 'processed'));

    console.log(`📁 Found ${allFiles.length} processed files\n`);

    if (allFiles.length === 0) {
      console.log('✅ No files to reindex');
      process.exit(0);
    }

    let totalProcessed = 0;
    let totalEmbeddingsGenerated = 0;
    let totalFailed = 0;

    for (const file of allFiles) {
      try {
        console.log(`\n📄 Processing: ${file.filename} (${file.id})`);

        // Get all chunks for this file
        const chunks = await db
          .select()
          .from(documentChunks)
          .where(eq(documentChunks.fileId, file.id));

        if (chunks.length === 0) {
          console.log(`  ⚠️  No chunks found for ${file.filename}, skipping...`);
          continue;
        }

        console.log(`  📊 Found ${chunks.length} chunks`);

        // Check how many already have embeddings
        const chunksWithEmbeddings = chunks.filter(c => c.embedding !== null).length;
        console.log(`  ✓ ${chunksWithEmbeddings} chunks already have embeddings`);

        // Get chunks without embeddings
        const chunksToProcess = chunks.filter(c => c.embedding === null);
        
        if (chunksToProcess.length === 0) {
          console.log(`  ✅ All chunks already have embeddings, skipping...`);
          totalProcessed++;
          continue;
        }

        console.log(`  🔄 Generating embeddings for ${chunksToProcess.length} chunks...`);

        // Generate embeddings in batches (to avoid rate limits and memory issues)
        const batchSize = 10;
        let processedInFile = 0;

        for (let i = 0; i < chunksToProcess.length; i += batchSize) {
          const batch = chunksToProcess.slice(i, i + batchSize);
          const texts = batch.map(chunk => chunk.content);

          try {
            console.log(`    Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunksToProcess.length / batchSize)}: Processing ${batch.length} chunks...`);
            
            const embeddingResults = await embeddingService.generateEmbeddings(texts);

            // Update chunks with embeddings
            for (let j = 0; j < batch.length; j++) {
              const chunk = batch[j];
              const embedding = embeddingResults[j];

              await db
                .update(documentChunks)
                .set({
                  embedding: embedding.embedding as any, // pgvector will handle the conversion
                })
                .where(eq(documentChunks.id, chunk.id));

              processedInFile++;
              totalEmbeddingsGenerated++;
            }

            console.log(`    ✓ Batch complete (${processedInFile}/${chunksToProcess.length} processed)`);

            // Small delay between batches to avoid rate limiting
            if (i + batchSize < chunksToProcess.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

          } catch (batchError) {
            console.error(`    ❌ Batch failed:`, batchError instanceof Error ? batchError.message : 'Unknown error');
            // Continue with next batch instead of failing completely
          }
        }

        console.log(`  ✅ Successfully generated ${processedInFile} embeddings for ${file.filename}`);
        totalProcessed++;

      } catch (fileError) {
        console.error(`  ❌ Failed to process ${file.filename}:`, fileError instanceof Error ? fileError.message : 'Unknown error');
        totalFailed++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 REINDEXING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Files processed successfully: ${totalProcessed}`);
    console.log(`❌ Files failed: ${totalFailed}`);
    console.log(`🔢 Total embeddings generated: ${totalEmbeddingsGenerated}`);
    console.log('='.repeat(60));

    // Verify results
    const verifyQuery = await db
      .select({
        totalChunks: sql<number>`count(*)::int`,
        chunksWithEmbeddings: sql<number>`count(${documentChunks.embedding})::int`
      })
      .from(documentChunks);

    console.log('\n📈 DATABASE STATUS:');
    console.log(`  Total chunks: ${verifyQuery[0].totalChunks}`);
    console.log(`  Chunks with embeddings: ${verifyQuery[0].chunksWithEmbeddings}`);
    console.log(`  Coverage: ${((verifyQuery[0].chunksWithEmbeddings / verifyQuery[0].totalChunks) * 100).toFixed(1)}%`);

    console.log('\n✅ Reindexing complete!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal error during reindexing:', error);
    process.exit(1);
  }
}

// Run the script
reindexAllDocuments();




