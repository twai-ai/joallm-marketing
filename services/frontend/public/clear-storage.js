// Clear localStorage script - run this in browser console
console.log('🧹 Clearing JoaLLM storage...');

// Clear all localStorage
localStorage.clear();
console.log('✅ localStorage cleared');

// Clear all sessionStorage
sessionStorage.clear();
console.log('✅ sessionStorage cleared');

// Clear specific JoaLLM keys
const keysToRemove = [
  'active_chat_session',
  'secure_active_chat_session',
  'chat-sessions',
  'activeSessionId',
  'messages',
  'user_role',
  'theme',
  'settings'
];

keysToRemove.forEach(key => {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
  console.log(`🗑️ Removed: ${key}`);
});

console.log('🎉 Storage cleared! Please refresh the page.');
