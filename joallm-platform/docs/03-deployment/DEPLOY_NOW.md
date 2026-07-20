# 🚀 Deploy Now - Quick Action Guide

## ⏱️ Total Time: 20 Minutes

All code is ready. Follow these 4 steps to deploy everything:

---

## Step 1: Deploy Frontend (5 min)

### Railway Dashboard:
1. Go to https://railway.app/project/f390b4b7-764f-40ad-9da9-ac1b1284484c
2. Click **joallm-platform** → **Deployments** → **Deploy**
3. Wait 2-3 minutes
4. Click **joallm-landing-page** → **Deployments** → **Deploy**
5. Wait 2-3 minutes
6. Check Activity log: Both should show "Deployment successful"

---

## Step 2: Set Environment Variables (3 min)

### Railway Dashboard → joallm-backend → Variables:

Copy and paste these:

```
GROQ_API_KEY=<YOUR_GROQ_API_KEY>
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
COHERE_API_KEY=<YOUR_COHERE_API_KEY>
GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>
STORAGE_PROVIDER=volume
STORAGE_PATH=/app/data/uploads
VOLUME_MOUNT_PATH=/app/data
GOOGLE_REDIRECT_URI=https://joallm-backend-production.up.railway.app/api/auth/google/callback
CORS_ORIGIN=https://platform.joallm.ai,https://joallm.ai
FRONTEND_URL=https://platform.joallm.ai
```

Click **Save** → Backend will redeploy (~2 min)

---

## Step 3: Seed Database (2 min)

### Terminal:

```bash
cd services/backend
railway run npm run seed
```

### Expected Output:
```
🌱 Starting database seeding...
Inserting 38 models...
✅ Models inserted successfully
Inserting vector extension marker...
✅ Vector extension marker inserted

📊 Verification:
   Models: 38
   Vector Extension: 1

✅ Database seeding completed successfully!
```

---

## Step 4: Test Everything (10 min)

### 1. Open Platform
- Go to https://platform.joallm.ai
- Hard refresh: **Cmd + Shift + R**
- Login with Google

### 2. Test Model Selection
- Open chat
- Click model dropdown
- ✅ Should show **38 models**

### 3. Test Knowledge Manager
- Upload a test file
- Search for keywords
- ✅ **Yellow highlighting** should appear
- Check console: Session ID logged

### 4. Test Chat
- Send a message
- ✅ Streaming response works
- ✅ Auto-title generated

### 5. Verify Database
```bash
railway connect postgres
```

Then:
```sql
SELECT COUNT(*) FROM models; -- Should be 38
SELECT COUNT(*) FROM vector_extension; -- Should be 1
SELECT COUNT(*) FROM rag_search_sessions; -- Should be >0
SELECT COUNT(*) FROM api_usage; -- Should be >0
```

---

## ✅ Success Checklist

After completing all 4 steps, verify:

- [ ] Frontend deployed (check Activity log)
- [ ] Landing page deployed (check Activity log)
- [ ] Backend has API keys (check Variables)
- [ ] Models table has 38 rows
- [ ] vector_extension has 1 row
- [ ] Keyword highlighting visible
- [ ] Model dropdown works
- [ ] RAG sessions tracked
- [ ] API usage logged

---

## 🆘 Quick Fixes

### Frontend Not Updating?
```bash
# Clear browser cache completely
Cmd + Shift + R (hard refresh)
# Or open in incognito mode
```

### Seed Script Fails?
```bash
# Try manual SQL
railway connect postgres
\i src/database/seed-models.sql
INSERT INTO vector_extension (id) VALUES ('pgvector') ON CONFLICT DO NOTHING;
```

### Backend Won't Start?
```bash
# Check logs
railway logs --service joallm-backend

# Check environment variables
railway variables --service joallm-backend
```

---

## 📞 Support

If anything goes wrong:
1. Check `SYSTEM_INTEGRATION_COMPLETE.md` for detailed troubleshooting
2. Review Railway logs for error messages
3. Verify all environment variables are set correctly
4. Test database connection: `railway connect postgres`

---

**Status**: ✅ Code Complete, Ready to Deploy
**Next**: Execute these 4 steps and you're live!

