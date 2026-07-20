#!/usr/bin/env node

/**
 * Script to reindex all processed documents to generate embeddings
 * This will process all files that are in 'processed' status but don't have embeddings
 */

import { config } from '../dist/config/config.js';
import { ragService } from '../dist/services/rag-service.js';
import { db } from '../dist/database/connection.js';
import { files, documentChunks } from '../dist/database/schema.js';
import { eq, sql } from 'drizzle-orm';

async function reindexAllDocuments() {
  console.log('🔄 Starting document reindexing process...\n');

  try {
    // Get all processed files
    const processedFiles = await db
      .select({
        id: files.id,
        filename: files.filename,
        status: files.status
      })
      .from(files)
      .where(eq(files.status, 'processed'));

    console.log(`📄 Found ${processedFiles.length} processed files`);

    if (processedFiles.length === 0) {
      console.log('ℹ️  No processed files found. Upload some documents first.');
      return;
    }

    // Check which files need reindexing
    const filesToReindex = [];
    
    for (const file of processedFiles) {
      // Check if this file has chunks without embeddings
      const chunksWithoutEmbeddings = await db
        .select({ count: sql`count(*)` })
        .from(documentChunks)
        .where(
          sql`${documentChunks.fileId} = ${file.id} AND ${documentChunks.embedding} IS NULL`
        );

      const count = chunksWithoutEmbeddings[0].count;
      if (count > 0) {
        filesToReindex.push({ ...file, chunksToIndex: count });
      }
    }

    console.log(`🔍 Found ${filesToReindex.length} files that need reindexing`);

    if (filesToReindex.length === 0) {
      console.log('✅ All files are already indexed!');
      return;
    }

    // Reindex each file
    let successCount = 0;
    let errorCount = 0;

    for (const file of filesToReindex) {
      try {
        console.log(`\n📝 Reindexing: ${file.filename} (${file.chunksToIndex} chunks)`);
        
        await ragService.indexDocument(file.id);
        
        console.log(`✅ Successfully indexed: ${file.filename}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to index ${file.filename}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n🎉 Reindexing completed!`);
    console.log(`✅ Successfully indexed: ${successCount} files`);
    if (errorCount > 0) {
      console.log(`❌ Failed to index: ${errorCount} files`);
    }

    // Show final statistics
    const finalStats = await db
      .select({
        totalChunks: sql`count(*)`,
        chunksWithEmbeddings: sql`count(${documentChunks.embedding})`
      })
      .from(documentChunks);

    const stats = finalStats[0];
    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total chunks: ${stats.totalChunks}`);
    console.log(`   Chunks with embeddings: ${stats.chunksWithEmbeddings}`);
    console.log(`   Coverage: ${((stats.chunksWithEmbeddings / stats.totalChunks) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Reindexing process failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the reindexing
reindexAllDocuments().catch(console.error);
