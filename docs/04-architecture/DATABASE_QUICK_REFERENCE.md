# Database Quick Reference Guide

Quick reference for common database operations in JoaLLM platform.

## 🚀 Quick Start

### Health Check
```bash
./scripts/check-database-health.sh
```

### Query Helper
```bash
# View all commands
./scripts/db-query-helper.sh help

# Common queries
./scripts/db-query-helper.sh users
./scripts/db-query-helper.sh files
./scripts/db-query-helper.sh chunks
./scripts/db-query-helper.sh search
./scripts/db-query-helper.sh queue
```

## 📚 Database Overview

### Connection Details
- **Host:** localhost
- **Port:** 5432
- **Database:** joallm
- **User:** postgres
- **Password:** postgres
- **Container:** joallm-postgres

### Extensions
- **pgvector v0.8.1** - Vector similarity search
- **plpgsql v1.0** - Procedural language

## 📊 Current Data Summary

| Resource | Count | Notes |
|----------|-------|-------|
| Users | 2 | Both on free tier |
| Chat Sessions | 4 | All using GPT-4 Turbo |
| Messages | 16 | Active conversations |
| Files | 43 | All markdown docs |
| Document Chunks | 42 | ⚠️ Chunking issues |
| Searches | 41 | Good performance |

## 🗂️ Core Tables

### users
User accounts and authentication
```sql
-- View all users
SELECT id, email, name, role, subscription_tier 
FROM users;
```

### chat_sessions
Conversation management
```sql
-- Recent sessions
SELECT short_id, title, model, created_at 
FROM chat_sessions 
ORDER BY created_at DESC 
LIMIT 10;
```

### messages
Chat history
```sql
-- Recent messages with session info
SELECT cs.short_id, m.role, LEFT(m.content, 100) as preview
FROM messages m
JOIN chat_sessions cs ON m.session_id = cs.id
ORDER BY m.created_at DESC
LIMIT 20;
```

### files
Uploaded documents
```sql
-- File status overview
SELECT original_name, status, 
       pg_size_pretty(size::bigint) as size,
       created_at
FROM files
ORDER BY created_at DESC;
```

### document_chunks
RAG knowledge base
```sql
-- Chunk statistics by file
SELECT f.original_name,
       COUNT(dc.id) as chunks,
       AVG(LENGTH(dc.content))::int as avg_length,
       COUNT(CASE WHEN dc.embedding IS NOT NULL THEN 1 END) as embeddings
FROM files f
LEFT JOIN document_chunks dc ON f.id = dc.file_id
GROUP BY f.id, f.original_name;
```

### search_history
RAG search analytics
```sql
-- Search performance
SELECT query, 
       results_count, 
       search_time,
       ROUND(average_score::numeric, 3) as score
FROM search_history
ORDER BY created_at DESC
LIMIT 20;
```

## 🔍 Vector Search

### Embedding Details
- **Dimensions:** 1024
- **Model:** Cohere embed-english-v3.0
- **Index Type:** IVFFLAT
- **Similarity:** Cosine distance
- **Lists:** 100

### Perform Vector Search
```sql
-- Example: Find similar documents (requires embedding)
SELECT 
    dc.id,
    f.original_name,
    dc.content,
    dc.embedding <=> '[your_embedding_vector]'::vector as distance
FROM document_chunks dc
JOIN files f ON dc.file_id = f.id
ORDER BY dc.embedding <=> '[your_embedding_vector]'::vector
LIMIT 5;
```

### Reindex Documents
```bash
cd services/backend
npm run reindex-documents
```

## 📈 Performance Monitoring

### Table Sizes
```bash
./scripts/db-query-helper.sh size
```

Or directly:
```sql
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;
```

### Index Usage
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Vacuum and Analyze
```bash
./scripts/db-query-helper.sh vacuum
```

## 🔧 Maintenance Tasks

### Backup Database
```bash
docker exec joallm-postgres pg_dump -U postgres joallm > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker exec -i joallm-postgres psql -U postgres joallm
```

### Clear All Data (Careful!)
```sql
-- Delete all data (keeps schema)
TRUNCATE users, chat_sessions, messages, files, 
         document_chunks, workflows, search_history 
CASCADE;
```

### Reset Database
```bash
cd services/backend
npm run db:reset
npm run db:migrate
npm run db:seed
```

## 📊 Queue Management (Redis)

### Check Queue Status
```bash
./scripts/db-query-helper.sh queue
```

### Direct Redis Commands
```bash
# Connect to Redis
docker exec -it joallm-redis redis-cli

# View all keys
KEYS bull:*

# Check queue length
ZCARD bull:document-processing:failed
ZCARD bull:document-indexing:completed

# Get current job ID
GET bull:document-processing:id
```

### Clear Failed Jobs
```bash
docker exec joallm-redis redis-cli DEL bull:document-processing:failed
docker exec joallm-redis redis-cli DEL bull:document-indexing:failed
```

## ⚠️ Known Issues

### Document Chunking Problem
**Symptom:** Files have only 1 chunk each with ~15 characters  
**Impact:** Reduced RAG search quality  
**Fix:** Re-run document indexing

```bash
cd services/backend
npm run reindex-documents
```

### Files Without User Association
**Symptom:** 43 files have `user_id = NULL`  
**Impact:** Permission and tracking issues  
**Fix:** Update files to assign users

```sql
-- Assign all files to a specific user
UPDATE files 
SET user_id = 'your-user-uuid'
WHERE user_id IS NULL;
```

### Empty Models Table
**Symptom:** No models in database  
**Impact:** Frontend may not show available models  
**Fix:** Run seed script

```bash
cd services/backend
npm run db:seed-models
```

## 🔌 Direct Connection

### PostgreSQL Shell
```bash
docker exec -it joallm-postgres psql -U postgres -d joallm
```

Common psql commands:
```
\dt                 List tables
\d+ table_name      Describe table
\di                 List indexes
\dx                 List extensions
\l                  List databases
\du                 List users
\q                  Quit
```

### Redis CLI
```bash
docker exec -it joallm-redis redis-cli
```

Common Redis commands:
```
KEYS *              List all keys
INFO keyspace       Database info
GET key             Get value
DEL key             Delete key
FLUSHDB             Clear current database (careful!)
```

## 📝 Useful Queries

### User Activity Summary
```sql
SELECT 
    u.name,
    COUNT(DISTINCT cs.id) as sessions,
    COUNT(DISTINCT m.id) as messages,
    COUNT(DISTINCT f.id) as files,
    COUNT(DISTINCT sh.id) as searches
FROM users u
LEFT JOIN chat_sessions cs ON u.id = cs.user_id
LEFT JOIN messages m ON cs.id = m.session_id
LEFT JOIN files f ON u.id = f.user_id
LEFT JOIN search_history sh ON u.id = sh.user_id
GROUP BY u.id, u.name;
```

### File Processing Status
```sql
SELECT 
    status,
    COUNT(*) as count,
    pg_size_pretty(SUM(size)::bigint) as total_size
FROM files
GROUP BY status;
```

### Search Performance Stats
```sql
SELECT 
    DATE(created_at) as date,
    COUNT(*) as searches,
    AVG(search_time) as avg_time_ms,
    AVG(average_score) as avg_score,
    AVG(results_count) as avg_results
FROM search_history
WHERE success = true
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Model Usage
```sql
SELECT 
    model,
    COUNT(*) as sessions
FROM chat_sessions
GROUP BY model
ORDER BY sessions DESC;
```

## 🚨 Emergency Procedures

### Database Won't Start
```bash
# Check logs
docker logs joallm-postgres

# Restart container
docker restart joallm-postgres

# Check health
docker exec joallm-postgres pg_isready -U postgres
```

### Redis Won't Start
```bash
# Check logs
docker logs joallm-redis

# Restart container
docker restart joallm-redis

# Check health
docker exec joallm-redis redis-cli ping
```

### Out of Disk Space
```bash
# Check database size
docker exec joallm-postgres psql -U postgres -d joallm -c "SELECT pg_size_pretty(pg_database_size('joallm'));"

# Vacuum to reclaim space
./scripts/db-query-helper.sh vacuum

# Clear old search history
docker exec joallm-postgres psql -U postgres -d joallm -c "DELETE FROM search_history WHERE created_at < NOW() - INTERVAL '30 days';"
```

## 📖 Related Documentation

- [DATABASE_EXPLORATION.md](../DATABASE_EXPLORATION.md) - Detailed exploration report
- [services/backend/src/database/schema.ts](../services/backend/src/database/schema.ts) - Schema definition
- [services/backend/docs/RAG_SYSTEM.md](../services/backend/docs/RAG_SYSTEM.md) - RAG documentation

## 🛠️ Tools

- **Health Check:** `./scripts/check-database-health.sh`
- **Query Helper:** `./scripts/db-query-helper.sh`
- **Reindex Script:** `services/backend/scripts/reindex-all-documents.ts`
- **Migration Tool:** `npm run db:migrate` (in services/backend)
- **Seed Data:** `npm run db:seed` (in services/backend)




