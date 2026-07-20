# 🚀 Deployment Instructions - Get Changes Live

**Current Status:** ✅ All changes saved locally, ready to deploy

---

## 📋 CURRENT SITUATION

### ✅ What's Done
All code changes are saved in your local files:
- File validation updates
- UI/UX improvements
- Bug fixes
- Platform URL integration
- Real numbers on landing page

### ❌ Why You Can't See Them
The changes are **only on your local machine**. They need to be:
1. Committed to git
2. Pushed to GitHub
3. Deployed to Railway (your hosting platform)

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Review Changed Files

Check what files were modified:
```bash
git status
```

You should see ~30 files modified/created.

---

### Step 2: Stage All Changes

Add all files to git:
```bash
git add .
```

Or add specific directories:
```bash
git add services/frontend/
git add services/landing-page/
git add services/backend/
```

---

### Step 3: Commit Changes

Create a commit with a descriptive message:
```bash
git commit -m "feat: Complete UI/UX trust fixes and landing page updates

- Added centralized file validation (remove Excel/PowerPoint, show Beta for PDF)
- Created status badge components (FileSupportBadge, FeatureStatusBadge)
- Fixed hamburger menu inconsistencies across frontend/landing
- Fixed React errors in DocumentPreviewModal
- Cleaned up console logs (production mode)
- Fixed RAG search sidebar navigation
- Increased document limit from 20 to 100
- Fixed CORS errors (undefined file IDs)
- Updated landing page with real numbers (20+ models, 4 providers, 35+ formats)
- Connected platform.joallm.ai URL throughout landing page
- Synchronized all changes between frontend and landing page

Fixes: #1 #2 #3 (if you have issue tracking)
"
```

---

### Step 4: Push to GitHub

Push to your main branch:
```bash
git push origin main
```

---

### Step 5: Deploy to Railway

Railway should auto-deploy when you push, but you can also:

**Option A: Automatic (if Railway is watching your repo)**
- Railway detects the push
- Builds and deploys automatically
- Check Railway dashboard for deployment status

**Option B: Manual Deploy**
```bash
# Using Railway CLI
railway up

# Or trigger from Railway dashboard
# Go to: https://railway.app
# Select your project
# Click "Deploy" on each service
```

---

## 🔍 VERIFY DEPLOYMENT

### Check Railway Dashboard

1. **Go to:** https://railway.app/dashboard
2. **Select your project:** joallm-platform
3. **Check deployments:**
   - Backend service
   - Frontend service
   - Landing-page service

**Look for:**
- ✅ Green checkmark (deployed successfully)
- 🟡 Yellow building icon (deploying now)
- ❌ Red X (deployment failed)

### Check Logs

For each service:
```bash
railway logs --service frontend
railway logs --service landing-page
railway logs --service backend
```

Look for:
- Build completion
- "Server listening on port..."
- Any errors

---

## 🧪 TEST AFTER DEPLOYMENT

### 1. Test Landing Page
Visit: Your landing page URL

Check:
- ✅ Hero stats show "20+", "4", "35+", "9"
- ✅ "Explore Platform →" button visible
- ✅ Click button → Opens platform.joallm.ai
- ✅ Navigation "Launch Platform →" works
- ✅ Mobile menu works

### 2. Test Platform
Visit: https://platform.joallm.ai/

Check:
- ✅ File upload works
- ✅ Can't upload .xlsx (blocked)
- ✅ PDF shows beta warning
- ✅ Preview button works (no errors)
- ✅ Console is clean
- ✅ RAG search sidebar works
- ✅ Can see 100 documents

### 3. Clear Browser Cache
If you still see old version:
```
Chrome: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
Firefox: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
Safari: Cmd+Option+R
```

Or open in incognito/private window.

---

## ⚠️ COMMON ISSUES

### Issue 1: Changes Not Committed
**Symptom:** `git status` shows modified files  
**Fix:** Run `git add .` then `git commit`

### Issue 2: Not Pushed to GitHub
**Symptom:** GitHub doesn't show latest commit  
**Fix:** Run `git push origin main`

### Issue 3: Railway Not Auto-Deploying
**Symptom:** Railway shows old deployment  
**Fix:** Manually trigger deploy from Railway dashboard

### Issue 4: Build Cached
**Symptom:** Deployment successful but shows old code  
**Fix:** 
- Railway: Click "Redeploy" with "Clear Build Cache"
- Browser: Hard refresh (Ctrl+Shift+R)

### Issue 5: Environment Variables
**Symptom:** Platform links broken or API errors  
**Fix:** Check Railway environment variables:
- `VITE_API_URL` is set correctly
- `CORS_ORIGIN` includes both domains

---

## 🔧 TROUBLESHOOTING

### Check if Changes are in Git

```bash
# See what's changed
git diff

# See what's staged
git diff --cached

# See commit history
git log --oneline -5
```

### Check Railway Deployment Status

```bash
# Login to Railway
railway login

# Check project status
railway status

# View recent deployments
railway logs
```

### Force Redeploy

If auto-deploy didn't trigger:
```bash
# Railway CLI
railway up --service landing-page
railway up --service frontend
railway up --service backend

# Or from dashboard:
# Click each service → "Deploy" → "Redeploy"
```

---

## 📊 DEPLOYMENT CHECKLIST

### Pre-Deploy ✓
- [x] All code changes saved
- [x] Files modified: 30+
- [x] No linter errors
- [x] No build errors
- [ ] Changes committed to git
- [ ] Changes pushed to GitHub

### Deploy ✓
- [ ] Railway detects push
- [ ] Backend builds successfully
- [ ] Frontend builds successfully
- [ ] Landing-page builds successfully
- [ ] All services healthy

### Post-Deploy ✓
- [ ] Landing page shows new numbers
- [ ] Platform link works
- [ ] File validation works
- [ ] Preview works without errors
- [ ] Console is clean
- [ ] Mobile menu works

---

## 🎯 QUICK FIX

**If you haven't committed yet, run these 3 commands:**

```bash
# 1. Stage all changes
git add .

# 2. Commit with message
git commit -m "feat: UI/UX fixes and landing page updates"

# 3. Push to trigger deployment
git push origin main
```

**Then wait 3-5 minutes for Railway to build and deploy.**

---

## 📞 NEED HELP?

### Check Build Status
- Railway Dashboard: https://railway.app
- GitHub Actions: (if you have CI/CD there)
- Check deployment logs for errors

### Common Build Times
- Backend: ~2-3 minutes
- Frontend: ~3-4 minutes  
- Landing Page: ~3-4 minutes
- **Total:** ~10 minutes for full deployment

### Still Not Working?
1. Check Railway dashboard for errors
2. Check browser console for errors
3. Try incognito/private window
4. Clear browser cache completely
5. Check if correct branch deployed

---

## ✅ VERIFICATION

After deploying, changes should be visible:

**Landing Page (joallm.ai):**
- Hero stats: "20+", "4", "35+", "9"
- Button: "Explore Platform →"
- Nav: "Launch Platform →"

**Platform (platform.joallm.ai):**
- Upload .xlsx → Blocked
- Upload .pdf → Beta warning
- Preview → No errors
- Console → Clean

---

**Let me know if you need help with the deployment process!**

