# 🔍 Markdown (.md) Files Not Getting Indexed - Fix Guide

## ❌ Problem Identified

**Issue:** Markdown files upload successfully but don't appear in search results.

**Root Cause:** Files are being **processed** (text extracted, chunks created) but **not indexed** (embeddings not generated).

---

## 🔎 Why This Happens

### The Processing Pipeline:
1. **Upload** → File uploaded to server ✅
2. **Processing** → Text extracted, chunks created ✅  
3. **Indexing** → Embeddings generated for search ❌ **FAILS HERE**

### Why Indexing Fails:
- **Redis unavailable** → Queue system disabled → Indexing never triggers
- **Embedding service fails** → Silent failure (doesn't mark file as failed)
- **API keys missing** → Falls back to mock embeddings that may not work

---

## ✅ Quick Fix: Reprocess Files

### Option 1: Use the Reprocess Endpoint (API)

```bash
# Get your auth token from frontend (localStorage)
TOKEN="your-auth-token"

# Get list of uploaded files
curl -X GET "http://localhost:3001/api/files?status=processed" \
  -H "Authorization: Bearer $TOKEN"

# Reprocess each file by ID to generate embeddings
curl -X POST "http://localhost:3001/api/files/FILE_ID/reprocess" \
  -H "Authorization: Bearer $TOKEN"
```

### Option 2: Check File Status in Database

```sql
-- Connect to your database
psql $DATABASE_URL

-- Check files and their chunk/embedding status
SELECT 
  f.id, 
  f.filename, 
  f.status,
  f.mimetype,
  COUNT(dc.id) as chunk_count,
  COUNT(dc.embedding) as embeddings_count
FROM files f
LEFT JOIN document_chunks dc ON f.id = dc.file_id
WHERE f.filename LIKE '%.md'
GROUP BY f.id, f.filename, f.status, f.mimetype;

-- Files with chunks but no embeddings need reprocessing!
```

---

## 🔧 Permanent Fix: Ensure Queue System Works

### 1. Check Redis Status

```bash
# Local development - check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start Redis:
docker-compose up -d redis
# OR
brew services start redis
```

### 2. Check Backend Logs

```bash
# Look for these messages on startup:
✓ Queue system initialized successfully  # GOOD
⚠ Queue system unavailable                # BAD - Redis issue
```

### 3. Check Environment Variables

Make sure these are set in `services/backend/.env`:

```bash
# Redis (for queue system)
REDIS_URL=redis://localhost:6379

# Cohere API Key (for embeddings)
COHERE_API_KEY=your-actual-cohere-key-here

# Or OpenAI as fallback
OPENAI_API_KEY=your-actual-openai-key-here
```

---

## 🧪 Test the Fix

### 1. Upload a New Markdown File

```bash
curl -X POST "http://localhost:3001/api/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.md"

# Should return:
# {
#   "status": "processing",
#   "message": "File uploaded and queued for processing"
# }
```

### 2. Wait 10 Seconds, Then Check Status

```bash
curl -X GET "http://localhost:3001/api/files/FILE_ID" \
  -H "Authorization: Bearer $TOKEN"

# Should show: "status": "processed"
```

### 3. Search for Content from the Markdown File

```bash
curl -X POST "http://localhost:3001/api/rag/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "some text from your markdown file",
    "limit": 5
  }'

# Should return results with chunks from your markdown file
```

---

## 🛠️ Manual Reindexing Script

If you have many files to reindex, use this script:

```bash
#!/bin/bash

# Get your auth token
TOKEN="your-auth-token-here"
API_URL="http://localhost:3001"

# Get all processed files
echo "Fetching processed files..."
FILES=$(curl -s -X GET "$API_URL/api/files?status=processed" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.files[].id')

# Reprocess each file
for FILE_ID in $FILES; do
  echo "Reprocessing file: $FILE_ID"
  curl -X POST "$API_URL/api/files/$FILE_ID/reprocess" \
    -H "Authorization: Bearer $TOKEN"
  echo ""
  sleep 2  # Wait 2 seconds between requests
done

echo "✅ All files queued for reprocessing!"
```

Save as `reindex-files.sh`, make executable, and run:

```bash
chmod +x reindex-files.sh
./reindex-files.sh
```

---

## 🔍 Debugging Steps

### 1. Check if Embeddings Are Being Generated

```bash
# Check backend logs while uploading a file
tail -f logs/backend.log | grep -i "embedding"

# Should see:
# "Generating embeddings for X chunks"
# "Successfully indexed X chunks"
```

### 2. Check Database for Missing Embeddings

```sql
-- Count files with chunks but no embeddings
SELECT COUNT(DISTINCT f.id) as files_without_embeddings
FROM files f
INNER JOIN document_chunks dc ON f.id = dc.file_id
WHERE dc.embedding IS NULL;

-- If > 0, those files need reprocessing
```

### 3. Test Embedding Service Directly

```bash
# Check if Cohere API key works
curl https://api.cohere.ai/v1/embed \
  -H "Authorization: Bearer YOUR_COHERE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["test"],
    "model": "embed-english-v3.0",
    "input_type": "search_document"
  }'

# Should return embeddings array, not an error
```

---

## 📊 Expected vs Actual Behavior

### ✅ Expected (Working):
1. Upload .md file → Status: "uploading"
2. Processing starts → Status: "processing"
3. Text extracted, chunks created
4. Embeddings generated → Status: "processed"
5. File searchable in RAG

### ❌ Actual (Broken):
1. Upload .md file → Status: "uploading"
2. Processing starts → Status: "processing"  
3. Text extracted, chunks created
4. **Indexing never happens** → Status: "processed" ⚠️
5. **File NOT searchable** → No embeddings ❌

---

## 🎯 Solution Priority

### Immediate (Do Now):
1. ✅ Check if Redis is running
2. ✅ Check if COHERE_API_KEY is set
3. ✅ Reprocess your markdown files using the `/reprocess` endpoint

### Short Term (This Week):
1. ✅ Monitor backend logs for indexing failures
2. ✅ Set up proper error alerts
3. ✅ Test with new uploads

### Long Term (Next Sprint):
1. Add synchronous indexing fallback (if Redis unavailable)
2. Add frontend indicator showing "indexed" vs "processed"
3. Add automatic retry for failed indexing
4. Add bulk reindex button in UI

---

## 🚨 Common Errors

### Error: "Queue system unavailable"
**Cause:** Redis not running  
**Fix:** Start Redis (`docker-compose up -d redis`)

### Error: "Embeddings generation failed"
**Cause:** API keys not set or invalid  
**Fix:** Set `COHERE_API_KEY` or `OPENAI_API_KEY` in `.env`

### Error: "Document status 'processed' but no search results"
**Cause:** Embeddings not generated (indexing skipped)  
**Fix:** Use `/reprocess` endpoint to generate embeddings

---

## ✅ Verification Checklist

After applying fixes:
- [ ] Redis is running (`redis-cli ping` returns `PONG`)
- [ ] Backend logs show "Queue system initialized successfully"
- [ ] COHERE_API_KEY or OPENAI_API_KEY is set in `.env`
- [ ] Upload new .md file and check it appears in search
- [ ] Reprocess old files using `/reprocess` endpoint
- [ ] Verify files have embeddings in database
- [ ] Search works for markdown content

---

## 📞 Need Help?

If markdown files still don't get indexed after these fixes:

1. **Check backend logs** for specific error messages
2. **Run database query** to confirm chunks exist but embeddings don't
3. **Test embedding service** with curl to verify API keys work
4. **Check Railway logs** if deployed (same issues apply)

The issue is **NOT with markdown parsing** (that works fine).  
The issue is **with embedding generation** (indexing step).

---

**Last Updated:** November 8, 2025  
**Status:** Diagnostic guide ready  
**Next Step:** Check Redis & API keys, then reprocess files

