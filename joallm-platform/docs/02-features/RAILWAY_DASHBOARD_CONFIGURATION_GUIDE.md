# 🚂 Railway Dashboard Configuration Guide

**Purpose:** Configure Railway services properly for monorepo deployments  
**Time Required:** ~15 minutes  
**Status:** ✅ CRITICAL FIX - DO THIS NOW

---

## 🎯 WHAT THIS FIXES

✅ Stops Railway from skipping frontend/backend deployments  
✅ Ensures each service deploys when its files change  
✅ Prevents technical debt accumulation  
✅ Gets your 17-hour-old frontend deployment up to date  

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### **STEP 1: Open Railway Dashboard**

1. Go to https://railway.app/
2. Select your project: **`joallm-platform`**
3. You'll see 3-4 services listed

---

### **STEP 2: Configure FRONTEND Service** ⚡ CRITICAL

1. **Click on the `frontend` service** (or `joallm-frontend`)

2. **Go to Settings tab**

3. **Scroll to "Service Settings" section**

4. **Configure these settings:**

   **Root Directory:**
   ```
   services/frontend
   ```
   
   **Watch Paths:** (Add if available, otherwise skip)
   ```
   services/frontend/**
   ```
   
   **Build Command:** (should already be set)
   ```
   docker build --build-arg VITE_API_URL=$VITE_API_URL --build-arg VITE_API_BASE_URL=$VITE_API_BASE_URL --build-arg VITE_APP_ENV=production -f Dockerfile .
   ```
   
   **Dockerfile Path:**
   ```
   Dockerfile
   ```
   (NOT `/services/frontend/Dockerfile` - relative to root directory!)

5. **Click "Save"**

---

### **STEP 3: Configure BACKEND Service** ⚡ CRITICAL

1. **Click on the `backend` service** (or `joallm-backend`)

2. **Go to Settings tab**

3. **Configure these settings:**

   **Root Directory:**
   ```
   services/backend
   ```
   
   **Watch Paths:** (Add if available)
   ```
   services/backend/**
   ```
   
   **Dockerfile Path:**
   ```
   Dockerfile
   ```
   (Relative to root directory!)

4. **Click "Save"**

---

### **STEP 4: Configure LANDING PAGE Service** ⚡ CRITICAL

1. **Click on the `landing-page` service**

2. **Go to Settings tab**

3. **Configure these settings:**

   **Root Directory:**
   ```
   services/landing-page
   ```
   
   **Watch Paths:**
   ```
   services/landing-page/**
   ```
   
   **Dockerfile Path:**
   ```
   Dockerfile
   ```

4. **Click "Save"**

---

## 🚀 STEP 5: MANUAL REDEPLOY FRONTEND (CRITICAL)

Your frontend is 17 hours behind! Force a new deployment:

1. **Go to FRONTEND service**
2. **Click "Deployments" tab**
3. **Click the "Deploy" button** (top right)
4. **Select:** "Redeploy latest commit"
5. **Click "Deploy"**

This will deploy commit `4be71b9` (latest) which includes:
- Header redesign
- Knowledge Manager enhancements
- Logo/Theme toggle improvements
- All missing UI/UX changes

---

## 🚀 STEP 6: VERIFY DEPLOYMENT

**Watch the deployment logs:**

1. Click on the new deployment (should say "BUILDING")
2. Watch logs for:
   - ✅ "Building services/frontend..."
   - ✅ "npm install"
   - ✅ "npm run build"
   - ✅ "Deployment successful"

**Expected time:** 5-8 minutes

---

## ✅ STEP 7: VERIFICATION CHECKLIST

After deployment completes, test:

### **Frontend Verification:**
- [ ] Visit https://platform.joallm.ai/
- [ ] Header should show NEW design (purple Database icon)
- [ ] Theme toggle should look updated
- [ ] Logo should be new style
- [ ] Knowledge Manager should have bulk actions
- [ ] Model selector should be enhanced

### **Backend Verification:**
- [ ] Backend should have monitoring active
- [ ] API endpoints responding correctly
- [ ] Database migrations completed

### **Landing Page Verification:**
- [ ] Visit https://joallm.ai/
- [ ] Mobile menu should work
- [ ] "Launch Platform" buttons should work
- [ ] Navigation updated

---

## 🎯 HOW TO CHECK IF IT WORKED

### **Before Fix:**
```
Railway Dashboard → Deployments
- 5 deployments showing "SKIPPED"
- Active deployment 17+ hours old
```

### **After Fix:**
```
Railway Dashboard → Deployments
- New deployment shows "ACTIVE" with recent timestamp
- Future commits with frontend/** changes will auto-deploy
- Docs-only commits will correctly skip
```

---

## 📊 WHAT CHANGED

### **railway.json Updated:**
```json
{
  "name": "frontend",
  "watchPaths": [
    "services/frontend/**",    // ✅ ADDED
    "shared/**",               // ✅ ADDED
    "package.json",            // ✅ ADDED
    "package-lock.json"        // ✅ ADDED
  ]
}
```

**Now Railway knows:**
- Deploy frontend IF `services/frontend/**` changes
- Deploy backend IF `services/backend/**` changes
- Skip IF only root docs change

---

## 🔧 ADVANCED: Railway CLI Method (Alternative)

If dashboard config doesn't work, use Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Force deploy frontend
railway up --service frontend

# Force deploy backend
railway up --service backend

# Force deploy landing page
railway up --service landing-page
```

---

## ⚠️ COMMON ISSUES

### **Issue 1: Watch Paths Field Not Visible**

Some Railway plans don't show "Watch Paths" in UI.

**Solution:** Use railway.json (already done ✅) + set Root Directory

---

### **Issue 2: Still Skipping After Config**

**Possible causes:**
- Root Directory not saved
- Railway cache needs clearing
- Need to trigger manual deploy once

**Solution:**
- Verify all settings saved
- Manual deploy once
- Future commits should auto-deploy

---

### **Issue 3: "Dockerfile not found" Error**

**Cause:** Dockerfile Path is absolute instead of relative

**Fix:**
```
❌ Wrong: /services/frontend/Dockerfile
✅ Right: Dockerfile (relative to Root Directory)
```

---

## 📋 POST-CONFIGURATION CHECKLIST

After configuring Railway dashboard:

- [ ] Root Directory set for all 3 services
- [ ] Watch Paths configured in railway.json
- [ ] Dockerfile Path is relative (just "Dockerfile")
- [ ] Manual frontend deploy triggered
- [ ] Deployment logs show successful build
- [ ] Frontend shows latest Header design
- [ ] Backend shows latest monitoring
- [ ] Landing page shows updated buttons
- [ ] No more SKIPPED deployments for code changes

---

## 🎯 TESTING THE FIX

**Make a test commit:**

1. Change ONE file in frontend:
   ```bash
   echo "// test" >> services/frontend/src/test.txt
   git add .
   git commit -m "test(frontend): verify watch paths working"
   git push
   ```

2. **Watch Railway dashboard**
   - Should see "BUILDING" status within 1 minute
   - Should NOT say "SKIPPED"
   - Deployment should complete successfully

3. **If it deploys:** ✅ Configuration working!
4. **If it skips:** ⚠️ Need to check Root Directory setting

---

## 🚨 IMPORTANT NOTES

### **DO THIS BEFORE CONTINUING DEVELOPMENT:**

Railway configuration is THE blocker. Until this is fixed:
- ❌ Don't make more frontend changes
- ❌ Don't create "trigger" commits
- ❌ Don't mix docs with code commits

**After configuration:**
- ✅ Frontend auto-deploys when you change frontend files
- ✅ Backend auto-deploys when you change backend files  
- ✅ Docs changes correctly skip (saves time!)
- ✅ Clean, predictable deployments

---

## 📞 IF YOU NEED HELP

**Railway Support:**
- Dashboard: Help icon → "Contact Support"
- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app/

**Common questions:**
- "How to configure watch paths for monorepo?"
- "Why are my deployments being skipped?"
- "How to set root directory for service?"

---

**Configuration time: ~15 minutes**  
**Benefit: Eliminates all technical debt from skipped deployments**  

**DO THIS NOW before making any new changes!** 🎯

