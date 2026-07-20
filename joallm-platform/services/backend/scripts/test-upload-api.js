#!/usr/bin/env node

/**
 * Test script to upload a document via the API and verify processing
 */

import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testDocumentUpload() {
  console.log('🧪 Testing document upload via API...\n');

  try {
    // Read the test document
    const testDocPath = './test-document.txt';
    const fileBuffer = fs.readFileSync(testDocPath);
    
    console.log(`📄 Uploading test document: ${testDocPath}`);
    console.log(`   Size: ${fileBuffer.length} bytes`);

    // Create form data
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: 'test-document.txt',
      contentType: 'text/plain'
    });

    // Upload the file
    const response = await fetch('http://localhost:3001/api/files/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': 'Bearer test-token' // You might need to adjust this
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Upload failed: ${response.status} ${response.statusText}`);
      console.log(`   Error: ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log(`✅ Upload successful!`);
    console.log(`   File ID: ${result.fileId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);

    // Wait a moment for processing
    console.log(`\n⏳ Waiting for document processing...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check the file status
    const statusResponse = await fetch(`http://localhost:3001/api/files/${result.fileId}/status`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      console.log(`📊 File Status:`);
      console.log(`   Status: ${statusResult.status}`);
      console.log(`   Chunks: ${statusResult.metadata?.chunks || 'N/A'}`);
      console.log(`   Embedding Model: ${statusResult.metadata?.embeddingModel || 'N/A'}`);
      console.log(`   Indexed At: ${statusResult.metadata?.indexedAt || 'N/A'}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testDocumentUpload().catch(console.error);
