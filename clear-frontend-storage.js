#!/usr/bin/env node

/**
 * Frontend storage cleanup script
 * This script clears the frontend build and forces a clean restart
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 JoaLLM Frontend Storage Cleanup');
console.log('==================================');

const frontendDir = path.join(__dirname, 'services', 'frontend');

function clearFrontendStorage() {
  try {
    console.log('🧹 Clearing frontend build cache...');
    
    // Clear dist directory
    const distDir = path.join(frontendDir, 'dist');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
      console.log('  ✅ Cleared dist directory');
    }
    
    // Clear node_modules cache
    const nodeModulesDir = path.join(frontendDir, 'node_modules');
    if (fs.existsSync(nodeModulesDir)) {
      console.log('  ⏳ Clearing node_modules (this may take a moment)...');
      fs.rmSync(nodeModulesDir, { recursive: true, force: true });
      console.log('  ✅ Cleared node_modules');
    }
    
    // Clear package-lock.json
    const packageLockFile = path.join(frontendDir, 'package-lock.json');
    if (fs.existsSync(packageLockFile)) {
      fs.unlinkSync(packageLockFile);
      console.log('  ✅ Cleared package-lock.json');
    }
    
    console.log('\n🔄 Reinstalling dependencies...');
    process.chdir(frontendDir);
    execSync('npm install', { stdio: 'inherit' });
    
    console.log('\n🏗️  Building frontend...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('\n✅ Frontend cleanup complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Start your backend server');
    console.log('   2. Open a new browser tab (incognito recommended)');
    console.log('   3. Navigate to your application');
    console.log('   4. The auth token error should be resolved');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.log('\n💡 Manual steps:');
    console.log('   1. Delete the dist folder in services/frontend/');
    console.log('   2. Run: cd services/frontend && npm run build');
    console.log('   3. Open a new browser tab and test');
  }
}

// Check if we're in the right directory
if (!fs.existsSync(frontendDir)) {
  console.error('❌ Frontend directory not found. Please run this script from the project root.');
  process.exit(1);
}

clearFrontendStorage();



