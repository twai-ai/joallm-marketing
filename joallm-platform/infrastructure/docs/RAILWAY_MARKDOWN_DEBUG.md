# 🔍 Railway: Markdown Files Not Indexed - Debug Guide

## ✅ Confirmed Setup
- Redis: **Connected** ✅
- Cohere API Key: **Set** ✅
- Backend: **Deployed** ✅

## ❌ Problem
Markdown files upload successfully but **don't appear in search results**.

---

## 🔎 Debug Steps (Railway-Specific)

### Step 1: Check Railway Backend Logs

```bash
# In Railway dashboard, go to:
# Backend Service → Deployments → Click latest deployment → View Logs

# Look for these specific messages:
```

**What to search for in logs:**

#### A) Queue Initialization (on startup)
```
Search: "Queue system"

✅ GOOD: "✓ Queue system initialized successfully"
❌ BAD: "⚠ Queue system unavailable"
```

#### B) File Upload (when you upload .md file)
```
Search: "Processing document"

✅ GOOD: "Processing document: filename.md"
Should see: "Successfully processed document: filename.md"
```

#### C) Embedding Generation (critical!)
```
Search: "Indexing document" OR "embedding"

✅ GOOD: 
- "Indexing document: file-id"
- "Generating embeddings for X chunks"
- "Successfully indexed X chunks"

❌ BAD (means it's failing):
- "Failed to index document"
- "Embeddings generation failed"
- "All embedding services failed"
- No indexing messages at all
```

---

### Step 2: Check Specific Error Messages

**Common Railway Errors:**

#### Error 1: "Connection timeout" or "ETIMEDOUT"
**Meaning:** Railway → Cohere API network issue  
**Fix:** Cohere API might be blocked, add retry logic

#### Error 2: "Authentication failed" or "401"
**Meaning:** Cohere API key invalid  
**Fix:** Verify COHERE_API_KEY in Railway variables

#### Error 3: "Rate limit exceeded" or "429"  
**Meaning:** Too many requests to Cohere  
**Fix:** Add rate limiting or upgrade Cohere plan

#### Error 4: No error, just silence
**Meaning:** Queue worker not processing jobs  
**Fix:** Redis connection issue or worker not starting

---

### Step 3: Test Manually via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View live logs (filtered)
railway logs --service backend | grep -i "indexing\|embedding\|queue"

# Run a command to test
railway run --service backend node -e "console.log('Test')"
```

---

### Step 4: Check Database Directly

Use Railway's database connection:

```bash
# In Railway dashboard:
# PostgreSQL service → Connect → Copy connection string

# Connect
psql "your-railway-postgres-connection-string"

# Check files and their embeddings
SELECT 
  f.id, 
  f.filename, 
  f.status,
  f.mimetype,
  f.processing_error,
  COUNT(dc.id) as total_chunks,
  COUNT(dc.embedding) as chunks_with_embeddings,
  (COUNT(dc.embedding)::float / NULLIF(COUNT(dc.id), 0) * 100)::int as index_percentage
FROM files f
LEFT JOIN document_chunks dc ON f.id = dc.file_id
WHERE f.filename LIKE '%.md'
GROUP BY f.id, f.filename, f.status, f.mimetype, f.processing_error
ORDER BY f.created_at DESC
LIMIT 10;

-- This shows:
-- total_chunks: How many text chunks were created
-- chunks_with_embeddings: How many have embeddings (searchable)
-- index_percentage: 0% = not indexed, 100% = fully indexed
```

**Expected results:**
- ✅ `index_percentage` = **100%** → File fully indexed, should be searchable
- ❌ `index_percentage` = **0%** → File not indexed, won't appear in search
- ⚠️ `index_percentage` = **50%** → Partial indexing (unusual, indicates error mid-process)

---

### Step 5: Manual Reindex via Railway

```bash
# Get your backend URL
BACKEND_URL="https://your-backend.railway.app"

# Get auth token (from your frontend, localStorage)
TOKEN="your-jwt-token"

# List files
curl "$BACKEND_URL/api/files" \
  -H "Authorization: Bearer $TOKEN"

# Reprocess a specific file
curl -X POST "$BACKEND_URL/api/files/FILE_ID/reprocess" \
  -H "Authorization: Bearer $TOKEN"

# Should return:
{
  "message": "File reprocessing started",
  "fileId": "...",
  "status": "processing"
}

# Wait 30 seconds, then check logs for indexing messages
```

---

## 🎯 Most Likely Issues

### Issue 1: Queue Worker Not Starting ⭐ MOST COMMON

**Symptom:** Logs show "Successfully processed" but never "Indexing document"

**Root Cause:** Worker process not running in Railway deployment

**Check:**
```bash
# In Railway logs, search for worker start message:
"Document indexing worker initialized"

# If missing, the worker isn't running!
```

**Fix:** The worker starts automatically with the backend, but Railway might be killing it. Check:
- Railway → Backend → Settings → Start Command
- Should be: `node dist/index.js` (which starts workers)

---

### Issue 2: Embedding Generation Failing Silently ⭐

**Symptom:** Logs show "Indexing document" but then "Failed to index" or silence

**Root Cause:** Cohere API call failing

**Check logs for:**
```
"Failed to generate embeddings"
"Cohere embeddings failed"
"OpenAI embeddings failed"
"Using mock embeddings"
```

**Fix:** 
1. Verify COHERE_API_KEY is correct in Railway
2. Check Cohere dashboard for API usage/errors
3. Try adding OPENAI_API_KEY as fallback

---

### Issue 3: Database Schema Issue ⭐

**Symptom:** "Cannot insert embedding" or "column does not exist"

**Root Cause:** `embedding` column not configured as `vector` type

**Check:**
```sql
-- In Railway PostgreSQL
\d document_chunks

-- Should show:
-- embedding | vector | 

-- If shows "text" or missing, need to migrate!
```

**Fix:** Run migrations:
```bash
# Via Railway CLI
railway run --service backend npm run db:migrate
```

---

## 🔧 Quick Diagnostic Script

Run this in Railway logs to see what's happening:

```bash
# Filter logs for the full indexing flow
railway logs --service backend --tail 1000 | grep -E "Queue system|Processing document|Indexing document|Generating embeddings|Successfully indexed"

# Should see a flow like:
1. "Queue system initialized successfully"
2. "Processing document: file.md"
3. "Indexing document: file-id"
4. "Generating embeddings for X chunks"
5. "Successfully indexed X chunks"

# If any step is missing, that's where it's failing!
```

---

## 🎯 Action Items

Based on your Railway logs, identify which scenario:

### Scenario A: No "Indexing document" messages
→ **Queue worker not running**  
→ Check worker initialization logs  
→ Verify Redis connection

### Scenario B: "Indexing document" but "Failed to index"
→ **Embedding generation failing**  
→ Check Cohere API key  
→ Check Cohere API status  
→ Look for specific error message

### Scenario C: "Successfully indexed" but still not searchable
→ **Database issue**  
→ Check embedding column exists  
→ Check embeddings are actually stored  
→ Run database query above

---

## 📊 Expected Timeline

With Redis + Cohere working correctly:

1. **Upload .md file** → Returns immediately (queued)
2. **Wait 5-10 seconds** → Processing happens in background
3. **Wait 10-20 seconds** → Indexing happens (embeddings generated)
4. **File now searchable** → Should appear in RAG search results

If it takes longer than 30 seconds total, something is wrong.

---

## 🚨 Emergency Fix: Force Synchronous Indexing

If queue system is broken and you need files indexed NOW, we can bypass the queue and index immediately on upload. But this will slow down uploads significantly.

Let me know if you want this emergency fix.

---

## 📞 Next Steps

**Tell me what you see in your Railway logs:**

1. Search for "Queue system" - what does it say?
2. Search for "Indexing document" - any results?
3. Search for "embedding" - what errors appear?
4. Run the database query - what's the `index_percentage`?

With this info, I can pinpoint the exact issue! 🎯

