# Railway pgvector Fix Guide

## Problem
Railway's default Postgres template doesn't include the pgvector extension, which is required for RAG (Retrieval-Augmented Generation) functionality.

## Quick Solution: Use pgvector Template

### Option A: Deploy New pgvector Database

1. **In Railway Dashboard:**
   - Click **"+ New"** → **"Database"**
   - Search for **"PostgreSQL with pgvector"** or **"pgvector"**
   - Click **"Deploy"**

2. **Migrate Your Data (if needed):**
   ```bash
   # Backup old database
   railway run pg_dump $DATABASE_URL > backup.sql
   
   # Restore to new database
   railway run psql $NEW_DATABASE_URL < backup.sql
   ```

3. **Update Backend Environment Variable:**
   - Go to **Backend Service** → **Variables**
   - Update: `DATABASE_URL=${{Postgres-pgvector.DATABASE_URL}}`
   - (Use exact service name of your pgvector database)

### Option B: Install Extension Manually (If Available)

1. **Railway Dashboard** → **Postgres Service**
2. **Click "Extensions" tab**
3. **Search for "vector"**
4. **Click "Install"** if available

**Note:** This only works if your Postgres image already includes pgvector binaries.

## Option C: Custom Postgres Deployment

If Railway doesn't have pgvector in their template gallery, deploy a custom one:

### 1. Create Postgres with pgvector Dockerfile

Create `services/postgres-pgvector/Dockerfile`:

```dockerfile
FROM postgres:16-alpine

# Install build dependencies
RUN apk add --no-cache \
    git \
    build-base \
    clang15 \
    llvm15

# Install pgvector
RUN git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git /tmp/pgvector && \
    cd /tmp/pgvector && \
    make clean && \
    make OPTFLAGS="" && \
    make install && \
    rm -rf /tmp/pgvector

# Cleanup build dependencies
RUN apk del git build-base clang15 llvm15
```

### 2. Add to railway.json

```json
{
  "services": [
    {
      "name": "postgres-pgvector",
      "source": "services/postgres-pgvector",
      "variables": {
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "generate-secure-password-here",
        "POSTGRES_DB": "joallm"
      }
    }
  ]
}
```

### 3. Deploy and Connect

```bash
railway up
```

## Verification

After setting up pgvector, verify it's installed:

### Method 1: Railway Shell
```bash
railway run --service Postgres psql $DATABASE_URL
```

Then in psql:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Method 2: Check Backend Logs
Your backend should now successfully run this during startup:
```
🔄 Running database migrations...
✅ Database migrations completed successfully
```

## Common Issues

### Issue 1: "extension 'vector' is not available"
**Cause:** Postgres image doesn't include pgvector
**Solution:** Use Option A (pgvector template) or Option C (custom Dockerfile)

### Issue 2: "permission denied to create extension"
**Cause:** Database user doesn't have SUPERUSER privileges
**Solution:** 
```sql
ALTER USER postgres WITH SUPERUSER;
```

### Issue 3: Migration fails with pgvector error
**Cause:** Extension not installed before running migrations
**Solution:** 
1. Install pgvector first
2. Redeploy backend
3. Migrations will run automatically

## Railway Templates to Try

Search in Railway template gallery for:
- **"PostgreSQL with pgvector"**
- **"Postgres pgvector"**
- **"Vector database"**

## Alternative: Use Separate Vector Database

If pgvector setup is too complex, consider:
- **Pinecone** (vector database service)
- **Weaviate** (Railway template available)
- **Qdrant** (Railway template available)

Then update your RAG service to use the external vector DB instead of pgvector.

## Recommended Approach

**For JoaLLM Platform:** Use Railway's pgvector template if available, otherwise use Option C (custom Dockerfile).

**Why:**
- ✅ Full control over Postgres version
- ✅ pgvector guaranteed to be installed
- ✅ Can update pgvector version independently
- ✅ Works with your existing Drizzle migrations

## After Setup Checklist

- [ ] pgvector extension installed
- [ ] Backend `DATABASE_URL` updated
- [ ] Backend redeployed successfully
- [ ] Migrations ran without errors
- [ ] Tables created with vector columns
- [ ] RAG functionality tested

## Test pgvector

After setup, test with a simple query:

```sql
-- Create test table
CREATE TABLE test_vectors (
  id SERIAL PRIMARY KEY,
  embedding vector(1536)
);

-- Insert test vector
INSERT INTO test_vectors (embedding) 
VALUES ('[0.1, 0.2, 0.3, ...]'::vector);

-- Test similarity search
SELECT * FROM test_vectors 
ORDER BY embedding <-> '[0.1, 0.2, 0.3, ...]'::vector 
LIMIT 5;
```

If these work, pgvector is properly configured! 🎉

