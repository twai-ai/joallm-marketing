#!/usr/bin/env node

/**
 * Script to reprocess all uploaded files with new Cohere embeddings
 */

const API_BASE_URL = 'http://localhost:3001';

async function reprocessFiles() {
  try {
    console.log('🔄 Starting file reprocessing with Cohere embeddings...\n');
    
    // Get all files
    const response = await fetch(`${API_BASE_URL}/api/files`);
    const data = await response.json();
    
    if (!data.files) {
      console.error('❌ Failed to fetch files');
      return;
    }
    
    // Filter files that need reprocessing (uploaded or failed)
    const filesToReprocess = data.files.filter(file => file.status === 'uploaded' || file.status === 'failed');
    
    if (filesToReprocess.length === 0) {
      console.log('✅ No files need reprocessing. All files are already processed!');
      return;
    }
    
    console.log(`📁 Found ${filesToReprocess.length} files to reprocess:`);
    filesToReprocess.forEach(file => {
      console.log(`   - ${file.filename} (${file.id})`);
    });
    console.log('');
    
    // Process each file
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of filesToReprocess) {
      try {
        console.log(`🔄 Reprocessing: ${file.filename}...`);
        
        const reprocessResponse = await fetch(`${API_BASE_URL}/api/files/${file.id}/reprocess`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        
        if (reprocessResponse.ok) {
          const result = await reprocessResponse.json();
          console.log(`   ✅ Success: ${result.message}`);
          successCount++;
        } else {
          const error = await reprocessResponse.json();
          console.log(`   ❌ Failed: ${error.message}`);
          errorCount++;
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n📊 Reprocessing Summary:');
    console.log(`   ✅ Successfully processed: ${successCount} files`);
    console.log(`   ❌ Failed: ${errorCount} files`);
    console.log(`   📁 Total files: ${filesToReprocess.length}`);
    
    if (successCount > 0) {
      console.log('\n🎉 Reprocessing completed! Your files are now searchable with Cohere embeddings.');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  }
}

// Run the script
reprocessFiles();
