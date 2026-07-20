# Fix 403 Forbidden Error - Frontend/Platform

## ✅ Vite Configuration Fixed

**Commits Applied:**
- `e1db9d3` - Fix frontend vite preview configuration
- `66094de` - Fix landing page vite preview configuration

**Changes Made:**
- Changed `host` to `0.0.0.0` (allows Railway to access)
- Made `port` dynamic from environment variable
- Removed `allowedHosts` restriction

---

## 🎯 Critical: Railway Environment Variables

The 403 error is most likely because **VITE_API_URL is not set** or **CORS is misconfigured**.

### Step 1: Check Frontend Environment Variables

**Go to Railway Console:**

1. Click **frontend** (platform) service
2. Go to **Variables** tab
3. **Verify these variables exist:**

```bash
VITE_API_URL=https://joallm-backend-production.up.railway.app
VITE_APP_ENV=production
NODE_ENV=production
```

**If missing, add them NOW!**

**Important**: Replace `joallm-backend-production.up.railway.app` with your actual backend URL from:
- Backend service → Settings → Domains → Copy the Railway URL

---

### Step 2: Check Backend CORS Configuration

**Go to Railway Console:**

1. Click **backend** service
2. Go to **Variables** tab
3. **Verify CORS_ORIGIN includes your frontend URL:**

```bash
CORS_ORIGIN=https://platform.joallm.ai,https://joallm-frontend-production.up.railway.app,https://joallm.ai
```

**Must include:**
- Your custom domain: `https://platform.joallm.ai`
- Railway domain for frontend: `https://your-frontend.railway.app`
- Landing page: `https://joallm.ai`

**If missing or incomplete, update it!**

---

## 🔍 Debugging Steps

### Check #1: What URL is Frontend Calling?

Open browser console (F12) on your frontend and look for:

```
Failed to load resource: https://localhost:3001/api/...
```

**If you see `localhost`**: VITE_API_URL is not set in Railway!

**If you see the correct backend URL**: It's a CORS issue.

---

### Check #2: Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Refresh the page
4. Look for red (failed) requests
5. Click on a failed request
6. Check **Headers** tab

**Look for:**
```
Request URL: https://joallm-backend-production.up.railway.app/api/...
Status Code: 403 Forbidden
```

**Check Response Headers:**
- If you see `access-control-allow-origin` header → CORS is configured but rejecting
- If NO CORS headers → Backend isn't allowing the origin

---

### Check #3: Backend Logs

1. Go to Railway → **backend** service
2. Go to **Deployments** tab
3. Check logs for CORS errors:

```
CORS blocked request from: https://platform.joallm.ai
```

---

## ✅ Complete Fix Checklist

- [ ] Vite configs updated (✅ Already done in commits)
- [ ] Frontend has `VITE_API_URL` set to backend URL
- [ ] Frontend has `VITE_APP_ENV=production`
- [ ] Backend has `CORS_ORIGIN` including frontend URL
- [ ] Backend is running and healthy (`/api/health` returns 200)
- [ ] Frontend redeployed after adding variables
- [ ] Backend redeployed after updating CORS
- [ ] Custom domains are configured correctly
- [ ] Browser console shows no `localhost` URLs

---

## 🚀 Quick Fix Commands

### If VITE_API_URL is Missing:

**In Railway Console (Frontend Service → Variables):**

Add:
```
VITE_API_URL = https://joallm-backend-production.up.railway.app
VITE_APP_ENV = production
```

(Replace with your actual backend URL)

### If CORS is Missing/Wrong:

**In Railway Console (Backend Service → Variables):**

Update `CORS_ORIGIN` to:
```
https://platform.joallm.ai,https://YOUR-FRONTEND.railway.app,https://joallm.ai
```

---

## 🧪 Test After Fixes

### Test 1: Backend Health

```bash
curl https://joallm-backend-production.up.railway.app/api/health
```

Should return:
```json
{"status":"ok",...}
```

### Test 2: CORS Preflight

```bash
curl -X OPTIONS https://joallm-backend-production.up.railway.app/api/models \
  -H "Origin: https://platform.joallm.ai" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

Should see:
```
< access-control-allow-origin: https://platform.joallm.ai
```

### Test 3: Frontend Access

1. Open https://platform.joallm.ai
2. Open browser console (F12)
3. Look for API calls in Network tab
4. Should see 200 OK responses, not 403

---

## 📋 Environment Variables Summary

### Frontend Service:
```bash
NODE_ENV=production
VITE_API_URL=https://joallm-backend-production.up.railway.app
VITE_APP_ENV=production
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG_MODE=false
```

### Landing Page Service:
```bash
NODE_ENV=production
VITE_API_URL=https://joallm-backend-production.up.railway.app
VITE_APP_ENV=production
```

### Backend Service (CORS):
```bash
CORS_ORIGIN=https://platform.joallm.ai,https://joallm-frontend-production.railway.app,https://joallm.ai
```

---

## 🆘 Still Getting 403?

### Check These:

1. **Railway Domain vs Custom Domain**:
   - Try accessing via Railway domain: `https://your-frontend.railway.app`
   - If works there but not on custom domain → DNS issue

2. **Cloudflare/Proxy**:
   - If using Cloudflare, check security settings
   - Temporarily disable to test

3. **Backend Actually Running**:
   - Go to backend service in Railway
   - Check status is "Active" (green)
   - Check logs for errors

4. **Database Connected**:
   - Backend needs DATABASE_URL and REDIS_URL
   - Check backend logs for "Connected to PostgreSQL"

---

## 🎯 Most Common Solution

**90% of 403 errors are fixed by:**

1. Setting `VITE_API_URL` in frontend service
2. Adding frontend URL to `CORS_ORIGIN` in backend service
3. Redeploying both services

**Try this first!**

---

**Status**: Vite configs fixed ✅  
**Next Step**: Set environment variables in Railway console


