// Quick fix for auth token issues
// Run this in browser console to immediately fix the auth token problem

console.log('🔧 Fixing auth token issue...');

// Clear the corrupted auth token
localStorage.removeItem('secure_auth_token');
localStorage.removeItem('secure_refresh_token');

console.log('✅ Corrupted auth tokens cleared');
console.log('🔄 Please refresh the page to continue');

// Also clear any other potentially corrupted secure data
const keys = Object.keys(localStorage);
let clearedCount = 0;

keys.forEach(key => {
  if (key.startsWith('secure_')) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        JSON.parse(value);
      }
    } catch (error) {
      console.log(`❌ Removing corrupted key: ${key}`);
      localStorage.removeItem(key);
      clearedCount++;
    }
  }
});

if (clearedCount > 0) {
  console.log(`🧹 Cleared ${clearedCount} additional corrupted entries`);
}

console.log('🎉 Auth token fix complete! Refresh the page now.');



