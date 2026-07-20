/**
 * Script to set authentication token in browser console
 * This uses the same secure storage system as the frontend
 */

// Copy and paste this into the browser console
function setAuthToken() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsImVtYWlsIjoic3lzdGVtQGpvYWxsbS5haSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MTQ4OTM1NywiZXhwIjoxNzYxNTc1NzU3fQ.UmtfsZbXR3P5bazwRaPDUfZDEtROsFVdVCIfBQARd-A';
  
  const user = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'system@joallm.ai',
    name: 'System Admin',
    role: 'admin',
    subscriptionTier: 'enterprise'
  };

  // Use the same storage system as the frontend
  // This will encrypt and store the data properly
  if (typeof window !== 'undefined' && window.localStorage) {
    // Simple encryption (same as frontend)
    const encrypt = (text) => {
      const key = 'joallm-secret-key-2024';
      const encrypted = CryptoJS.AES.encrypt(text, key).toString();
      return encrypted;
    };

    // Store token securely
    const encryptedToken = encrypt(JSON.stringify(token));
    localStorage.setItem('secure_auth_token', encryptedToken);

    // Store user securely
    const encryptedUser = encrypt(JSON.stringify(user));
    localStorage.setItem('secure_user', encryptedUser);

    console.log('✅ Authentication token set successfully!');
    console.log('🔄 Please refresh the page to apply changes.');
    console.log('📧 User:', user.email);
    console.log('👤 Role:', user.role);
  } else {
    console.error('❌ This script must be run in a browser environment');
  }
}

// Alternative: Direct localStorage approach (simpler)
function setAuthTokenSimple() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsImVtYWlsIjoic3lzdGVtQGpvYWxsbS5haSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MTQ4OTM1NywiZXhwIjoxNzYxNTc1NzU3fQ.UmtfsZbXR3P5bazwRaPDUfZDEtROsFVdVCIfBQARd-A';
  
  const user = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'system@joallm.ai',
    name: 'System Admin',
    role: 'admin',
    subscriptionTier: 'enterprise'
  };

  // Store directly in localStorage (will be picked up by the frontend)
  localStorage.setItem('secure_auth_token', JSON.stringify(token));
  localStorage.setItem('secure_user', JSON.stringify(user));

  console.log('✅ Authentication token set successfully!');
  console.log('🔄 Please refresh the page to apply changes.');
  console.log('📧 User:', user.email);
  console.log('👤 Role:', user.role);
}

// Run the simple version
setAuthTokenSimple();
