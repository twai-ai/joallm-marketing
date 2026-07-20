# 🔑 Authentication Token Setup - Fix Refresh Redirect Issue

## 🐛 **Problem Identified:**

When you refresh the page, it redirects to the login page because:
1. The frontend uses **secure storage** (encrypted) for authentication tokens
2. We were setting the token with regular `localStorage.setItem()`
3. The frontend can't find the token in secure storage, so it thinks you're not authenticated

## ✅ **Solution:**

### **Method 1: Browser Console (Recommended)**

1. **Open the frontend:** `http://localhost:5175`
2. **Open Developer Tools:** Press F12
3. **Go to Console tab**
4. **Copy and paste this code:**

```javascript
// Set authentication token using the same system as the frontend
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsImVtYWlsIjoic3lzdGVtQGpvYWxsbS5haSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MTQ4OTM1NywiZXhwIjoxNzYxNTc1NzU3fQ.UmtfsZbXR3P5bazwRaPDUfZDEtROsFVdVCIfBQARd-A';

const user = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'system@joallm.ai',
  name: 'System Admin',
  role: 'admin',
  subscriptionTier: 'enterprise'
};

// Store using the same secure storage system as the frontend
localStorage.setItem('secure_auth_token', JSON.stringify(token));
localStorage.setItem('secure_user', JSON.stringify(user));

console.log('✅ Authentication token set successfully!');
console.log('🔄 Please refresh the page to apply changes.');
console.log('📧 User:', user.email);
console.log('👤 Role:', user.role);
```

5. **Press Enter** to run the code
6. **Refresh the page** (F5 or Ctrl+R)
7. **You should now stay on the JoaLLM interface** instead of being redirected to login

### **Method 2: Direct localStorage (Alternative)**

If Method 1 doesn't work, try this simpler approach:

```javascript
// Simple localStorage approach
localStorage.setItem('secure_auth_token', JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsImVtYWlsIjoic3lzdGVtQGpvYWxsbS5haSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MTQ4OTM1NywiZXhwIjoxNzYxNTc1NzU3fQ.UmtfsZbXR3P5bazwRaPDUfZDEtROsFVdVCIfBQARd-A'));

localStorage.setItem('secure_user', JSON.stringify({
  id: '00000000-0000-0000-0000-000000000000',
  email: 'system@joallm.ai',
  name: 'System Admin',
  role: 'admin',
  subscriptionTier: 'enterprise'
}));

console.log('✅ Token set! Refresh the page.');
```

## 🧪 **Testing:**

After setting the token and refreshing:

1. **You should stay on the JoaLLM interface** (no redirect to login)
2. **Try searching for "Railway"** in the search box
3. **Expected results:** 3 search results about Railway deployment
4. **Check browser console** for any errors

## 🔍 **Verify Token is Set:**

Run this in the console to check if the token is properly stored:

```javascript
// Check if token is stored
const token = localStorage.getItem('secure_auth_token');
const user = localStorage.getItem('secure_user');

console.log('Token stored:', !!token);
console.log('User stored:', !!user);

if (token) {
  console.log('Token:', JSON.parse(token));
}
if (user) {
  console.log('User:', JSON.parse(user));
}
```

## 🚨 **If Still Not Working:**

### **Check These:**

1. **Browser Console Errors:**
   - Look for any JavaScript errors
   - Check for network errors in Network tab

2. **Storage Verification:**
   - Go to Application/Storage tab in Dev Tools
   - Check Local Storage for `secure_auth_token` and `secure_user`

3. **Network Tab:**
   - Check if API calls are going to `localhost:3001`
   - Verify response status codes

4. **Backend Logs:**
   - Check backend terminal for incoming requests
   - Look for authentication errors

## 🎯 **Expected Behavior After Fix:**

✅ **No redirect to login** on page refresh  
✅ **Stay on JoaLLM interface**  
✅ **Search functionality works**  
✅ **"Railway" search returns 3 results**  
✅ **User shows as authenticated**  

## 📝 **Quick Commands:**

```bash
# Generate new token if needed
cd joallm-backend && node scripts/setup-auth.js

# Check backend is running
curl http://localhost:3001/api/health

# Test API directly
curl -X POST http://localhost:3001/api/rag/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{"query": "Railway", "limit": 3, "threshold": 0.1}'
```

The key issue was that the frontend uses **secure storage** (with `secure_` prefix and encryption), but we were setting the token with regular localStorage. This fix ensures the token is stored in the same format the frontend expects! 🚀
