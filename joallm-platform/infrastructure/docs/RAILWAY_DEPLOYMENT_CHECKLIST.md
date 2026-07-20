# Railway Deployment Checklist

## ✅ Status: Ready for Deployment

All necessary fixes have been applied. Your code is now ready for Railway deployment.

---

## 🔧 Changes Made

### 1. Fixed railway.json Configuration
- ✅ Changed `services/commercial-frontend` → `services/frontend`
- ✅ Updated service name from `commercial-frontend` → `frontend`

### 2. Updated setup-railway.sh Script
- ✅ Changed all references from `commercial-frontend` → `frontend`
- ✅ Updated variable names: `COMMERCIAL_URL` → `FRONTEND_URL`
- ✅ Updated log messages and commands

---

## 🚀 Deployment Steps

### Step 1: Generate Security Keys

Run these commands to generate strong secrets:

```bash
# Generate JWT_SECRET
echo "JWT_SECRET=$(openssl rand -base64 32)"

# Generate API_KEY
echo "API_KEY=$(openssl rand -base64 32)"
```

**Save these values!** You'll need them in Step 4.

### Step 2: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 3: Initialize Railway Project

```bash
cd /Users/aeishwary/JoaLLM-platform/joallm-platform
railway init
```

This will:
- Create a new Railway project
- Link it to your local directory
- Railway will auto-detect the `railway.json` configuration

### Step 4: Add Database Services

```bash
# Add PostgreSQL
railway add --database postgresql

# Add Redis
railway add --database redis
```

Railway will automatically set `DATABASE_URL` and `REDIS_URL` environment variables.

### Step 5: Set Backend Environment Variables

**Option A: Using Railway Dashboard (Recommended)**

1. Go to https://railway.app/dashboard
2. Select your project
3. Click on "backend" service
4. Go to "Variables" tab
5. Add the following variables:

```
NODE_ENV=production
LOG_LEVEL=info

# Security (use the values you generated in Step 1)
JWT_SECRET=<your-generated-jwt-secret>
API_KEY=<your-generated-api-key>

# API Keys (you have these already)
OPENAI_API_KEY=<your-openai-key>
GROQ_API_KEY=<YOUR_GROQ_API_KEY>
COHERE_API_KEY=<YOUR_COHERE_API_KEY>
ANTHROPIC_API_KEY=<your-anthropic-key-if-you-have-one>

# Google OAuth
GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>

# CORS (you'll update this after deployment)
CORS_ORIGIN=https://localhost:5173
```

**Option B: Using CLI**

```bash
railway variables --service backend --set "NODE_ENV=production"
railway variables --service backend --set "JWT_SECRET=<your-jwt-secret>"
# ... etc for all variables
```

### Step 6: Deploy to Railway

```bash
railway up
```

This will deploy all three services:
- backend
- frontend
- landing-page

### Step 7: Get Service URLs

After deployment completes:

```bash
# Get backend URL
railway domain --service backend

# Get frontend URL
railway domain --service frontend

# Get landing page URL
railway domain --service landing-page
```

**Save these URLs!**

### Step 8: Update Environment Variables with Real URLs

Now update these variables with the actual Railway URLs:

**Backend Service - Update:**
```bash
CORS_ORIGIN=https://<your-frontend-url>.railway.app,https://<your-landing-url>.railway.app
GOOGLE_REDIRECT_URI=https://<your-backend-url>.railway.app/api/auth/google/callback
```

**Frontend Service - Set:**
```bash
VITE_API_URL=https://<your-backend-url>.railway.app
VITE_APP_ENV=production
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG_MODE=false
```

**Landing Page Service - Set:**
```bash
VITE_API_URL=https://<your-backend-url>.railway.app
VITE_APP_ENV=production
```

### Step 9: Run Database Migrations

```bash
railway run --service backend npm run db:migrate
```

This will:
- Create all necessary database tables
- Set up the pgvector extension
- Initialize the schema

### Step 10: Setup Models (Optional but Recommended)

```bash
railway run --service backend npm run setup:models
```

This seeds the database with default LLM models.

### Step 11: Update Google OAuth Settings

1. Go to https://console.cloud.google.com/
2. Navigate to your OAuth credentials
3. Add your Railway URLs to authorized redirect URIs:
   - `https://<your-backend-url>.railway.app/api/auth/google/callback`
4. Add to authorized JavaScript origins:
   - `https://<your-frontend-url>.railway.app`
   - `https://<your-landing-url>.railway.app`

### Step 12: Test Your Deployment

```bash
# Test backend health
curl https://<your-backend-url>.railway.app/api/health

# Test frontend
open https://<your-frontend-url>.railway.app

# Test landing page
open https://<your-landing-url>.railway.app
```

---

## 🧪 Verification Checklist

After deployment, verify these items:

- [ ] Backend health check returns 200 OK
- [ ] Frontend loads without errors
- [ ] Landing page loads without errors
- [ ] Can register a new user
- [ ] Can login with Google OAuth
- [ ] Can create a chat session
- [ ] Can send messages in chat
- [ ] Can upload documents (if using R2)
- [ ] No CORS errors in browser console
- [ ] Database connection is working
- [ ] Redis connection is working

---

## 📊 Monitoring Your Deployment

### View Logs

```bash
# Backend logs
railway logs --service backend

# Frontend logs
railway logs --service frontend

# Landing page logs
railway logs --service landing-page
```

### Check Service Status

```bash
railway status
```

### View Metrics

Go to Railway Dashboard → Your Project → Select Service → Metrics tab

---

## 🔒 Security Post-Deployment

### Immediate Actions:

1. **Verify Secrets**: Ensure JWT_SECRET and API_KEY are strong random strings
2. **Check CORS**: Verify CORS_ORIGIN only includes your actual frontend URLs
3. **Google OAuth**: Update OAuth credentials in Google Console
4. **Remove Debug**: Ensure VITE_ENABLE_DEBUG_MODE=false in production

### Recommended Actions:

1. **Enable Railway Security**:
   - Set up custom domains (more professional)
   - Enable automatic SSL
   - Configure health checks

2. **Monitor Logs**:
   - Check for authentication failures
   - Monitor error rates
   - Watch for unusual traffic patterns

3. **Backup Strategy**:
   - Railway automatically backs up PostgreSQL
   - Consider exporting database periodically
   - Keep environment variables backed up securely

---

## 🆘 Troubleshooting

### Backend Won't Start

**Check:**
```bash
railway logs --service backend
```

**Common Issues:**
- DATABASE_URL not set → Check if PostgreSQL service is added
- Build failed → Check if all dependencies are in package.json
- Migration failed → Check database permissions

**Fix:**
```bash
# Restart service
railway restart --service backend

# Run migrations manually
railway run --service backend npm run db:migrate
```

### Frontend Can't Connect to Backend

**Check:**
- VITE_API_URL is set correctly in frontend service variables
- CORS_ORIGIN includes frontend URL in backend service variables
- Backend health check is passing

**Fix:**
```bash
# Update frontend API URL
railway variables --service frontend --set "VITE_API_URL=https://<backend-url>.railway.app"

# Update backend CORS
railway variables --service backend --set "CORS_ORIGIN=https://<frontend-url>.railway.app"

# Restart both services
railway restart --service frontend
railway restart --service backend
```

### Database Connection Issues

**Check:**
```bash
# View database connection string
railway variables --service backend | grep DATABASE_URL
```

**Fix:**
```bash
# Restart PostgreSQL service
railway restart --service postgresql

# Check database health
railway run --service backend npm run db:migrate
```

### Build Failures

**Check build logs:**
```bash
railway logs --service <service-name>
```

**Common issues:**
- Missing dependencies → Check package.json
- TypeScript errors → Run `npm run build` locally first
- Out of memory → Contact Railway support for increased limits
- `patch-package: not found` error → Fixed in latest config (uses `npm ci` instead of `npm install`)

**Fix for patch-package error:**
If you see "patch-package: not found", the build command needs to use `--legacy-peer-deps` flag:
```bash
# In railway.json, ensure buildCommand is:
"buildCommand": "npm install --legacy-peer-deps && npm run build"
```

This is already fixed in the latest configuration.

---

## 📈 Optimization Tips

### After Initial Deployment:

1. **Add Custom Domains**:
   ```bash
   railway domain add <service-name> <your-domain.com>
   ```

2. **Enable Automatic Deploys**:
   - Link Railway to your GitHub repository
   - Enable auto-deploy on push to main branch

3. **Set Up Monitoring**:
   - Add health check monitoring
   - Set up alerts for downtime
   - Monitor resource usage

4. **Performance**:
   - Monitor response times in Railway dashboard
   - Scale services if needed (Railway auto-scales)
   - Consider adding Redis caching for frequent queries

---

## 🎉 Success!

Once all steps are complete, your application is live at:

- **Frontend App**: `https://<your-frontend>.railway.app`
- **Landing Page**: `https://<your-landing>.railway.app`
- **Backend API**: `https://<your-backend>.railway.app`

Share these URLs with your users and start testing!

---

## 📞 Support Resources

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Railway Status**: https://status.railway.app

For application-specific issues, check:
- `infrastructure/docs/RAILWAY_DEPLOYMENT.md`
- `infrastructure/docs/TROUBLESHOOTING.md`

---

## 🔄 Updating Your Deployment

When you make code changes:

```bash
# Commit your changes
git add .
git commit -m "Your changes"
git push origin main

# If auto-deploy is enabled, Railway will automatically deploy
# Otherwise, manually deploy:
railway up
```

---

**Last Updated**: $(date)
**Status**: ✅ Ready for Production Deployment

