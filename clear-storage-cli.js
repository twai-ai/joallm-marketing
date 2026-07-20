#!/usr/bin/env node

/**
 * CLI script to clear corrupted browser storage
 * This script helps fix authentication token issues
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔧 JoaLLM Storage Cleanup Tool');
console.log('==============================');

// Function to find browser storage directories
function findBrowserStorageDirs() {
  const homeDir = os.homedir();
  const possibleDirs = [];
  
  // Chrome/Chromium
  const chromeDir = path.join(homeDir, '.config', 'google-chrome', 'Default', 'Local Storage', 'leveldb');
  if (fs.existsSync(chromeDir)) {
    possibleDirs.push({ browser: 'Chrome', path: chromeDir });
  }
  
  // Chrome (alternative location)
  const chromeAltDir = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Local Storage', 'leveldb');
  if (fs.existsSync(chromeAltDir)) {
    possibleDirs.push({ browser: 'Chrome (macOS)', path: chromeAltDir });
  }
  
  // Edge
  const edgeDir = path.join(homeDir, '.config', 'microsoft-edge', 'Default', 'Local Storage', 'leveldb');
  if (fs.existsSync(edgeDir)) {
    possibleDirs.push({ browser: 'Edge', path: edgeDir });
  }
  
  // Firefox
  const firefoxDir = path.join(homeDir, '.mozilla', 'firefox');
  if (fs.existsSync(firefoxDir)) {
    const profiles = fs.readdirSync(firefoxDir).filter(dir => dir.includes('.default'));
    profiles.forEach(profile => {
      const storageDir = path.join(firefoxDir, profile, 'storage', 'default');
      if (fs.existsSync(storageDir)) {
        possibleDirs.push({ browser: 'Firefox', path: storageDir });
      }
    });
  }
  
  return possibleDirs;
}

// Function to clear localhost storage
function clearLocalhostStorage(storageDir) {
  try {
    const files = fs.readdirSync(storageDir);
    let clearedCount = 0;
    
    files.forEach(file => {
      if (file.includes('localhost') || file.includes('127.0.0.1') || file.includes('3000')) {
        const filePath = path.join(storageDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`  ✅ Removed: ${file}`);
          clearedCount++;
        } catch (error) {
          console.log(`  ❌ Failed to remove ${file}: ${error.message}`);
        }
      }
    });
    
    return clearedCount;
  } catch (error) {
    console.log(`  ❌ Error accessing directory: ${error.message}`);
    return 0;
  }
}

// Main execution
async function main() {
  console.log('🔍 Searching for browser storage directories...\n');
  
  const storageDirs = findBrowserStorageDirs();
  
  if (storageDirs.length === 0) {
    console.log('❌ No browser storage directories found.');
    console.log('💡 Try manually clearing storage in your browser:');
    console.log('   1. Open Developer Tools (F12)');
    console.log('   2. Go to Application tab');
    console.log('   3. Clear Local Storage');
    console.log('   4. Refresh the page');
    return;
  }
  
  console.log(`📁 Found ${storageDirs.length} browser storage directory(ies):\n`);
  
  let totalCleared = 0;
  
  storageDirs.forEach(({ browser, path: storagePath }) => {
    console.log(`🌐 ${browser}:`);
    console.log(`   📂 ${storagePath}`);
    
    const cleared = clearLocalhostStorage(storagePath);
    totalCleared += cleared;
    
    if (cleared > 0) {
      console.log(`   ✅ Cleared ${cleared} file(s)`);
    } else {
      console.log(`   ℹ️  No localhost files found`);
    }
    console.log('');
  });
  
  console.log('🎉 Storage cleanup complete!');
  console.log(`📊 Total files cleared: ${totalCleared}`);
  console.log('\n🔄 Next steps:');
  console.log('   1. Close all browser tabs for localhost:3000');
  console.log('   2. Restart your browser');
  console.log('   3. Navigate back to your application');
  console.log('   4. The auth token error should be resolved');
  
  if (totalCleared === 0) {
    console.log('\n⚠️  No localhost storage files were found.');
    console.log('   This might mean:');
    console.log('   - The storage is in a different location');
    console.log('   - The browser is using a different storage method');
    console.log('   - You need to clear storage manually in the browser');
  }
}

// Run the script
main().catch(console.error);



