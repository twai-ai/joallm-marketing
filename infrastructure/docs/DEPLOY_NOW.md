# 🚀 Deploy to Railway NOW - Quick Start

## Status: ✅ READY

All fixes have been applied. Follow these commands to deploy in the next 15 minutes.

---

## Step 1: Generate Secrets (2 minutes)

```bash
# Run these commands and SAVE the output
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "API_KEY=$(openssl rand -base64 32)"
```

**💾 SAVE THESE VALUES!** You'll need them in Step 5.

---

## Step 2: Install Railway CLI (1 minute)

```bash
npm install -g @railway/cli
railway login
```

This will open your browser. Login with GitHub.

---

## Step 3: Initialize Project (1 minute)

```bash
cd /Users/aeishwary/JoaLLM-platform/joallm-platform
railway init
```

Select "Create new project" and give it a name (e.g., "joallm-platform").

---

## Step 4: Add Databases (1 minute)

```bash
# Add PostgreSQL
railway add --database postgresql

# Add Redis  
railway add --database redis
```

---

## Step 5: Set Environment Variables (5 minutes)

Go to https://railway.app/dashboard and set these for the **backend** service:

### Required Variables:
```
NODE_ENV=production
LOG_LEVEL=info
JWT_SECRET=<paste-from-step-1>
API_KEY=<paste-from-step-1>
GROQ_API_KEY=<YOUR_GROQ_API_KEY>
COHERE_API_KEY=<YOUR_COHERE_API_KEY>
GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>
CORS_ORIGIN=http://localhost:5173
```

### Optional (add if you have them):
```
OPENAI_API_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>
```

> 💡 We'll update CORS_ORIGIN after deployment in Step 8

---

## Step 6: Deploy (3 minutes)

```bash
railway up
```

This will build and deploy all three services. Watch the logs for any errors.

---

## Step 7: Get Your URLs (1 minute)

```bash
# Get backend URL
railway domain --service backend

# Get frontend URL
railway domain --service frontend

# Get landing page URL
railway domain --service landing-page
```

**💾 SAVE THESE URLS!**

---

## Step 8: Update Environment Variables (2 minutes)

Now that you have the URLs, update these in Railway Dashboard:

### Backend service - Update:
```
CORS_ORIGIN=https://<frontend-url>.railway.app,https://<landing-url>.railway.app
GOOGLE_REDIRECT_URI=https://<backend-url>.railway.app/api/auth/google/callback
```

### Frontend service - Add:
```
VITE_API_URL=https://<backend-url>.railway.app
VITE_APP_ENV=production
```

### Landing Page service - Add:
```
VITE_API_URL=https://<backend-url>.railway.app
VITE_APP_ENV=production
```

After updating, Railway will automatically redeploy the services.

---

## Step 9: Run Database Setup (2 minutes)

```bash
# Run migrations
railway run --service backend npm run db:migrate

# Setup models (optional but recommended)
railway run --service backend npm run setup:models
```

---

## Step 10: Test Your Deployment (2 minutes)

```bash
# Test backend health
curl https://<backend-url>.railway.app/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

Open in browser:
- Frontend: `https://<frontend-url>.railway.app`
- Landing: `https://<landing-url>.railway.app`

---

## Step 11: Update Google OAuth (IMPORTANT!)

1. Go to https://console.cloud.google.com/
2. Navigate to APIs & Services → Credentials
3. Click on your OAuth 2.0 Client ID
4. Add to **Authorized redirect URIs**:
   - `https://<backend-url>.railway.app/api/auth/google/callback`
5. Add to **Authorized JavaScript origins**:
   - `https://<frontend-url>.railway.app`
   - `https://<landing-url>.railway.app`
6. Click **Save**

---

## ✅ You're Live!

Your app is now deployed at:
- 🎨 **Frontend**: `https://<frontend-url>.railway.app`
- 🏠 **Landing**: `https://<landing-url>.railway.app`
- 🔧 **API**: `https://<backend-url>.railway.app`

---

## 🧪 Quick Test Checklist

- [ ] Can access landing page
- [ ] Can access frontend app
- [ ] Can register new user
- [ ] Can login with Google
- [ ] Can create chat session
- [ ] Can send messages
- [ ] No console errors

---

## 🆘 If Something Goes Wrong

### Build Error: "patch-package: not found"?
**Already fixed!** The latest config uses `npm install --legacy-peer-deps`.

If you still see this:
1. Make sure you have the latest code
2. Check that `railway.json` uses `npm install --legacy-peer-deps`
3. See `RAILWAY_BUILD_FIX.md` for detailed solution

### Backend won't start?
```bash
railway logs --service backend
```
Check for missing environment variables.

### Frontend can't connect?
Make sure `VITE_API_URL` is set correctly in frontend service variables.

### CORS errors?
Make sure `CORS_ORIGIN` in backend includes your frontend URL.

### Database errors?
```bash
railway run --service backend npm run db:migrate
```

---

## 📚 More Help

- **Detailed Guide**: See `RAILWAY_DEPLOYMENT_CHECKLIST.md`
- **Troubleshooting**: See `infrastructure/docs/RAILWAY_DEPLOYMENT.md`
- **Railway Docs**: https://docs.railway.app

---

## 🎉 Success!

If all steps completed successfully, your JoaLLM platform is now live!

Share your URLs and start using your AI-powered platform.

---

**Total Time**: ~15-20 minutes
**Difficulty**: Easy
**Status**: ✅ Ready to deploy

