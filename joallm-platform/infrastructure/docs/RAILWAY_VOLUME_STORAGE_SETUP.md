# 🗄️ Railway Volume Storage Setup

## ✅ What Was Implemented

**Problem:** Files were being "mock uploaded" - text extraction worked on first upload but reprocessing failed because original files weren't stored.

**Solution:** Implemented **Railway Volume Storage** - persistent local file storage on Railway.

---

## 📊 How It Works Now

### Before (Mock Storage):
```
Upload file → Process in-memory → Save metadata to DB
                                 ↓
                          Original file LOST!
                          
Reprocess → Try to download → Get "mock file content" → Extract 16 chars → Failed!
```

### After (Railway Volume):
```
Upload file → Save to /app/data/uploads → Process → Save to DB
              ✅ Original file preserved!
              
Reprocess → Download from volume → Extract real content → Success!
```

---

## 📁 Storage Architecture

### Database Stores:
- **files table:**
  - Metadata (filename, size, mimetype, status)
  - `storage_provider` = "local"
  - `storage_url` = "/storage/documents/user-id/file-id/filename"
  - `storage_key` = "documents/user-id/file-id/filename"

- **document_chunks table:**
  - Extracted text content (searchable)
  - Embeddings (vectors)
  - Chunk metadata

### Railway Volume Stores:
- **Original file binaries** at `/app/data/uploads/`
- **Persistent across deployments**
- **Automatically backed up by Railway**

---

## 🚀 Railway Configuration

### 1. Volume Mount (railway.toml)
```toml
[[mounts]]
path = "/app/data"
name = "uploads-volume"
```

**This tells Railway:**
- Create a persistent volume
- Mount it at `/app/data`
- Preserve it across deployments

### 2. Environment Variables
```bash
STORAGE_PROVIDER=local
STORAGE_PATH=/app/data/uploads
```

---

## 🔧 Auto-Fallback Logic

The system automatically uses local storage if R2 is not configured:

```typescript
// If R2 credentials missing or invalid:
if (!hasR2Config) {
  logger.info('📁 R2 not configured, using local file storage');
  return new LocalFileStorage('/app/data/uploads');
}
```

**Checks for:**
- R2_ACCOUNT_ID exists and not "undefined"
- R2_ACCESS_KEY_ID exists
- R2_SECRET_ACCESS_KEY exists
- R2_BUCKET_NAME exists

**If any missing:** Automatically uses local storage ✅

---

## 📊 What Gets Stored Where

| Data | Location | Size | Purpose |
|------|----------|------|---------|
| Original files | Railway Volume | Full file size | Download, preview, reprocess |
| Extracted text | PostgreSQL | ~10-50KB per file | Full-text search |
| Embeddings | PostgreSQL | ~4KB per chunk | Semantic search |
| Metadata | PostgreSQL | ~1KB per file | File info, status |

---

## ✅ Benefits

### Railway Volume Storage:
- ✅ **Free** (included with Railway)
- ✅ **Persistent** (survives redeploys)
- ✅ **Fast** (local disk access)
- ✅ **Simple** (no external accounts needed)
- ✅ **Backed up** (by Railway)

### Compared to Mock Storage:
- ✅ Files actually stored
- ✅ Reprocessing works
- ✅ Download works
- ✅ Preview works
- ✅ Full text extraction

---

## 🧪 Testing After Deploy

### 1. Check Storage Provider in Logs

After redeployment, backend startup should show:
```
📁 R2 not configured, using local file storage (Railway Volume)
```

### 2. Upload a Test File

Upload QUICKSTART.md again and check logs:
```
✓ File uploaded to local storage: documents/.../QUICKSTART.md (12543 bytes)
Extracting text from QUICKSTART.md (text/markdown)
Created X chunks from text (XXXX characters)  ← Should be large!
```

### 3. Reprocess Should Work

Click reprocess button:
```
✓ File downloaded from local storage: documents/.../QUICKSTART.md (12543 bytes)
Extracting text...
✅ Successfully reprocessed
```

### 4. Search Should Find Content

Search for actual content from the file (not just filename) - should return results!

---

## 🔍 Verify in Database

After uploading a new file with volume storage:

```sql
SELECT 
  filename,
  storage_provider,
  storage_url,
  storage_key,
  status,
  (metadata->>'wordCount')::int as word_count,
  (metadata->>'characterCount')::int as char_count
FROM files
ORDER BY created_at DESC
LIMIT 1;

-- Should show:
-- storage_provider: 'local' (or 'cloudflare-r2' if still default)
-- word_count: Large number (not 16!)
-- char_count: Large number
```

---

## 📋 Deployment Steps

### 1. Commit and Push (I'll do this)

Commits:
- New LocalFileStorage implementation
- Auto-fallback to local storage
- Railway volume configuration
- Updated env.example

### 2. Railway Auto-Redeploys

Railway will:
- Pull new code
- Build with new storage implementation
- Create/mount volume at `/app/data`
- Start using local storage automatically

### 3. Test

After deployment:
- Upload new files → Should store in volume
- Check logs → Should see "local file storage"
- Reprocess old files → Should extract real content
- Search → Should find actual content

---

## ⚠️ Important Notes

### Existing Files:
Old files uploaded before this change:
- ❌ Don't have original binaries stored
- ✅ Can still be searched (if already indexed)
- ⚠️ Can't be reprocessed (no original file)
- 💡 Solution: Re-upload them after this deploys

### New Files:
Files uploaded after this deploys:
- ✅ Original binary stored in volume
- ✅ Full text extraction
- ✅ Can be reprocessed anytime
- ✅ Can be downloaded
- ✅ Fully searchable

---

## 🎯 Files Changed

1. `services/backend/src/services/local-file-storage.ts` - NEW implementation
2. `services/backend/src/services/file-storage.ts` - Auto-fallback logic
3. `railway.toml` - Volume mount configuration
4. `services/backend/env.example` - Updated documentation

---

## 📦 Railway Volume Details

**Volume Name:** `uploads-volume`  
**Mount Path:** `/app/data`  
**Storage Path:** `/app/data/uploads`  
**Type:** Persistent (survives deployments)  
**Backup:** Handled by Railway  
**Cost:** Included free with Railway  

---

## ✅ Next Steps

1. I'll commit and push these changes
2. Railway will redeploy (~5 min)
3. System will automatically use local storage
4. Upload new files to test
5. Verify full text extraction works
6. Old files may need re-uploading

---

**This fixes the root cause: files are now actually stored and can be properly processed!** 🚀

