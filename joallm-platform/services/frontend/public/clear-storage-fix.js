// Utility script to clear corrupted storage data
// Run this in browser console to fix authentication issues

console.log('🔧 JoaLLM Storage Fix Utility');
console.log('============================');

// Function to clear corrupted storage
function clearCorruptedStorage() {
  console.log('🧹 Clearing corrupted storage data...');
  
  // Clear secure storage
  const keys = Object.keys(localStorage);
  let clearedCount = 0;
  
  keys.forEach(key => {
    if (key.startsWith('secure_')) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          // Try to parse as JSON to check if it's corrupted
          JSON.parse(value);
        }
      } catch (error) {
        console.log(`❌ Removing corrupted key: ${key}`);
        localStorage.removeItem(key);
        clearedCount++;
      }
    }
  });
  
  // Clear session storage
  sessionStorage.clear();
  
  console.log(`✅ Cleared ${clearedCount} corrupted storage entries`);
  console.log('🔄 Please refresh the page to continue');
  
  return clearedCount;
}

// Function to check storage health
function checkStorageHealth() {
  console.log('🔍 Checking storage health...');
  
  const secureKeys = Object.keys(localStorage).filter(key => key.startsWith('secure_'));
  let healthyCount = 0;
  let corruptedCount = 0;
  
  secureKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        JSON.parse(value);
        healthyCount++;
      }
    } catch (error) {
      console.log(`❌ Corrupted: ${key}`);
      corruptedCount++;
    }
  });
  
  console.log(`📊 Storage Health Report:`);
  console.log(`   ✅ Healthy entries: ${healthyCount}`);
  console.log(`   ❌ Corrupted entries: ${corruptedCount}`);
  console.log(`   📁 Total secure keys: ${secureKeys.length}`);
  
  return { healthy: healthyCount, corrupted: corruptedCount };
}

// Make functions available globally
window.clearCorruptedStorage = clearCorruptedStorage;
window.checkStorageHealth = checkStorageHealth;

console.log('🚀 Available commands:');
console.log('   clearCorruptedStorage() - Clear corrupted storage data');
console.log('   checkStorageHealth() - Check storage health status');
console.log('');
console.log('💡 Run checkStorageHealth() first to see what needs fixing');



