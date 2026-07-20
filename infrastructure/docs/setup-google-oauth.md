# 🔐 Google OAuth Setup Guide

## Current Status
- ✅ **OAuth flow working** - Google redirects correctly
- ✅ **Authorization code received** - Backend gets the code
- ❌ **Token exchange failing** - Need real Google client secret

## 🚀 Quick Setup (5 minutes)

### Step 1: Get Google Client Secret
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Go to **"APIs & Services"** → **"Credentials"**
4. Find your OAuth 2.0 Client ID: `<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com`
5. Click on it to view details
6. Copy the **Client Secret** (starts with `GOCSPX-`)

### Step 2: Update Backend Configuration
```bash
# Edit the backend .env file
cd /Users/shyamshundar/Desktop/joallm-platform/services/backend
nano .env

# Replace this line:
GOOGLE_CLIENT_SECRET=GOCSPX-placeholder-secret

# With your real secret:
GOOGLE_CLIENT_SECRET=GOCSPX-your-actual-secret-here
```

### Step 3: Configure Redirect URIs
In Google Cloud Console, add these authorized redirect URIs:
- `http://localhost:3001/api/auth/google/callback`
- `http://127.0.0.1:3001/api/auth/google/callback`

### Step 4: Restart Backend
```bash
cd /Users/shyamshundar/Desktop/joallm-platform/services/backend
npm run dev
```

## 🎯 Alternative: Use Fallback Authentication

If you want to skip OAuth setup for now:

1. **Frontend will auto-login** as `support@joallm.ai`
2. **All API calls work** with real data from `joallm_dev`
3. **No Google setup needed** for development

## 🔍 Test OAuth

Once configured, test at:
- **OAuth Test Page**: `file:///Users/shyamshundar/Desktop/joallm-platform/test-oauth.html`
- **Frontend**: `http://localhost:5175/login`
- **Backend OAuth**: `http://localhost:3001/api/auth/google`

## 📋 Current Error Details

```
Error: invalid_client
Status: 401 Unauthorized
Cause: Using placeholder client secret instead of real one
```

The OAuth implementation is working perfectly - you just need the real Google client secret!





