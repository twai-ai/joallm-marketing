# JoaLLM Database Exploration Report

**Generated:** November 7, 2025  
**Database:** PostgreSQL 15.14 with pgvector extension  

---

## 📊 Overview

### Database Infrastructure
- **PostgreSQL Version:** 15.14 (Debian, ARM64)
- **Extensions Installed:**
  - `plpgsql` v1.0 - Procedural language
  - `vector` v0.8.1 - Vector data type with IVFFLAT and HNSW support
- **Total Database Size:** 11 MB
- **Container:** `joallm-postgres` (Running, Healthy)
- **Connection:** `postgres:postgres@localhost:5432/joallm`

### Redis Infrastructure
- **Container:** `joallm-redis` 
- **Keys in DB0:** 32 keys (2 with expiry, avg TTL: ~15 seconds)
- **Primary Usage:** Bull queue job management
  - Document processing queue (45 jobs processed)
  - Document indexing queue (10 completed, 1 failed)

---

## 📋 Database Schema

### Tables Overview (15 tables total)

| Table | Row Count | Total Size | Table Size | Index Size | Status |
|-------|-----------|------------|------------|------------|--------|
| **document_chunks** | 42 | 2.4 MB | 32 KB | 2.1 MB | ⚠️ Metadata issues |
| **files** | 43 | 144 KB | 40 KB | 64 KB | ✅ Active |
| **search_history** | 41 | 80 KB | 8 KB | 64 KB | ✅ Active |
| **messages** | 16 | 112 KB | 16 KB | 48 KB | ✅ Active |
| **chat_sessions** | 4 | 96 KB | 8 KB | 80 KB | ✅ Active |
| **users** | 2 | 64 KB | 8 KB | 48 KB | ✅ Active |
| **models** | 0 | 72 KB | 0 | 64 KB | 📝 Empty |
| **rag_search_sessions** | 0 | 48 KB | 0 | 40 KB | 📝 Empty |
| **rag_search_queries** | 0 | 40 KB | 0 | 32 KB | 📝 Empty |
| **workflows** | 0 | 40 KB | 0 | 32 KB | 📝 Empty |
| **workflow_executions** | 0 | 48 KB | 0 | 40 KB | 📝 Empty |
| **api_usage** | 0 | 40 KB | 0 | 32 KB | 📝 Empty |
| **survey_responses** | 0 | 40 KB | 0 | 32 KB | 📝 Empty |
| **survey_analytics** | 0 | 32 KB | 0 | 24 KB | 📝 Empty |
| **vector_extension** | 0 | 16 KB | 0 | 8 KB | 📝 System table |

---

## 👥 Users Data

### Current Users (2 total)

```
ID: afbaeb96-5e5c-4524-83b9-d787aa75b4d2
Email: support@joallm.ai
Name: Aeishwary Mishra
Role: casual
Subscription: free
Created: 2025-11-06 06:07:34

ID: acda20bf-790c-4672-a1ed-aea361b3f882
Email: test@example.com
Name: Test User
Role: casual
Subscription: free
Created: 2025-11-06 06:06:45
```

---

## 💬 Chat Sessions Data

### Active Sessions (4 total)

1. **THyKL3pZ** - "Deploying Docker Containers on Cloud Platforms"
   - Model: gpt-4-turbo
   - Auto-titled: Yes
   - Created: 2025-11-07 03:38:44

2. **g2LEwZLf** - "Docker: Containerization Platform"
   - Model: gpt-4-turbo
   - Auto-titled: Yes
   - Created: 2025-11-07 03:38:43

3. **7cVWufWN** - "Prometheus and Grafana Monitoring Solution"
   - Model: gpt-4-turbo
   - Auto-titled: Yes
   - Created: 2025-11-06 06:22:18

4. **Y55Mqnnm** - "Initial Greeting Conversation"
   - Model: gpt-4-turbo
   - Auto-titled: Yes
   - Created: 2025-11-06 06:09:21

### Recent Messages (16 total)

Latest conversation topics:
- Railway deployment discussions
- Docker deployment on cloud platforms
- Containerization concepts
- General platform exploration

---

## 📄 Files & RAG System

### Uploaded Files (43 total)

**Most Recent Files:**
1. ROLE_DISPLAY_NAME_UPDATE.md (1.4 KB, processed)
2. ROLE_CHANGES.md (5.6 KB, processed)
3. ISSUES_FIXED.md (5.1 KB, processed)
4. DYNAMIC_RAG_SUGGESTIONS_FEATURE.md (11.8 KB, processed)
5. CURRENT_ISSUES_AND_FIXES.md (3.8 KB, processed)
6. CRITICAL_FIXES_IMPLEMENTATION.md (8.8 KB, processed)
7. TYOM.md (4.5 KB, processed)
8. TROUBLESHOOTING.md (6.4 KB, processed)
9. RESTRUCTURE_SUMMARY.md (3.8 KB, processed)
10. QUICKSTART.md (3.2 KB, processed)

**File Statistics:**
- All files are markdown documentation
- All files have status: "processed"
- No user_id assigned (uploaded system files)
- Total uploaded content: ~260 KB

### Document Chunks (42 total)

⚠️ **ISSUE DETECTED:** All chunks show suspiciously small metadata:
- Each file has only 1 chunk (should be multiple for proper RAG)
- Metadata reports only 15 characters per chunk
- Actual content appears intact but chunking may be broken

**Sample Chunk Structure:**
```json
{
  "content": "# B A C K E N D  E N V I R O N M E N T...",
  "chunk_index": 0,
  "metadata": {
    "startChar": 0,
    "endChar": 16,
    "wordCount": 2,
    "characterCount": 15
  },
  "embedding": [1024-dimensional vector]
}
```

**Vector Index:**
- Index Type: IVFFLAT (Inverted File with Flat Compression)
- Similarity Metric: Cosine distance
- Lists: 100
- Embedding Dimensions: 1024 (Cohere embed-english-v3.0)
- Index Size: 2.1 MB (majority of table size)

---

## 🔍 Search History (41 searches)

### Recent Search Queries:

1. "How does the RAG system work?" (5 results, success)
2. "How do I set up the frontend development environment?" (5 results, success)
3. "frontend" (5 results, avg score: 0.453, 474ms)
4. "What are the main features of JoaLLM?" (5 results, success)
5. "RAG implementation cohere embeddings" (3 results, avg score: 0.493, 366ms)
6. "frontend react" (3 results, avg score: 0.532, 421ms)
7. "backend setup" (3 results, avg score: 0.717, 558ms)

**Search Performance:**
- Average search time: ~400ms
- Average similarity scores: 0.45-0.72
- All searches successful
- Typical result count: 3-5 documents

---

## 🔗 Database Relationships

### Foreign Key Constraints (11 total)

**User-Centric Relationships:**
- `users` ← `chat_sessions` (cascade delete)
- `users` ← `files` (cascade delete)
- `users` ← `workflows` (cascade delete)
- `users` ← `workflow_executions` (cascade delete)
- `users` ← `rag_search_sessions` (cascade delete)
- `users` ← `search_history` (set null on delete)
- `users` ← `api_usage` (cascade delete)

**Content Relationships:**
- `files` ← `document_chunks` (cascade delete)
- `chat_sessions` ← `messages` (cascade delete)
- `rag_search_sessions` ← `rag_search_queries` (cascade delete)
- `workflows` ← `workflow_executions` (cascade delete)

---

## 📈 Indexes Overview

### Document Chunks Indexes:
1. `document_chunks_pkey` - Primary key (btree on id)
2. `document_chunks_file_id_idx` - Foreign key lookup (btree)
3. `document_chunks_chunk_index_idx` - Chunk ordering (btree)
4. `document_chunks_embedding_ivfflat_idx` - **Vector similarity search** (ivfflat, cosine)

### Performance Indexes:
- All tables have btree indexes on primary keys
- User ID indexes on all user-related tables
- Timestamp indexes for time-based queries
- GIN index on `models.capabilities` for JSONB searches
- UUID-based primary keys throughout

---

## ⚙️ Bull Queue Status (Redis)

### Document Processing Queue:
- **Job ID Counter:** 45
- **Failed Jobs:** 1
- **Status:** Active

### Document Indexing Queue:
- **Job ID Counter:** 43
- **Completed Jobs:** 10
- **Status:** Active

### Queue Keys Found:
- `bull:document-processing:*` - File upload processing
- `bull:document-indexing:*` - Embedding generation and indexing
- Event streams for job monitoring
- Metadata tracking

---

## 🔍 Key Findings

### ✅ Strengths:

1. **Proper Vector Search Setup**
   - pgvector extension properly installed
   - IVFFLAT index created with appropriate parameters
   - 1024-dimensional embeddings (Cohere)

2. **Good Data Integrity**
   - Foreign key constraints properly set up
   - Cascade deletes configured
   - Proper indexing strategy

3. **Active Usage**
   - Real user data and conversations
   - Search history shows actual queries
   - Document processing pipeline active

4. **Clean Schema Design**
   - UUID-based primary keys
   - JSONB for flexible metadata
   - Proper timestamp tracking
   - Comprehensive indexes

### ⚠️ Issues to Address:

1. **Document Chunking Problem**
   - All files have only 1 chunk each
   - Metadata shows incorrect character counts (15 chars)
   - May impact RAG search quality
   - Likely bug in chunking service

2. **Empty Tables**
   - `models` table empty (dynamic model management not populated)
   - No RAG search sessions (feature not being used)
   - No workflow data (feature unused)
   - No survey responses

3. **Missing User Associations**
   - Uploaded files have no user_id
   - Search history has null user associations
   - May cause permission/tracking issues

4. **Queue Health**
   - 1 failed job in document processing
   - Should investigate and retry

### 💡 Recommendations:

1. **Fix Document Chunking**
   - Investigate chunking logic in backend
   - Re-index existing documents with proper chunking
   - Add validation for chunk size and count

2. **Populate Models Table**
   - Run seed script for dynamic models
   - Keep models table in sync with available providers

3. **Associate Files with Users**
   - Update file upload to capture user_id
   - Backfill existing files if possible

4. **Monitor Queue Health**
   - Set up alerting for failed jobs
   - Implement automatic retry logic
   - Track job processing times

5. **Consider Index Tuning**
   - IVFFLAT lists=100 may need adjustment as data grows
   - Consider HNSW index for better performance at scale

---

## 🔧 Quick Access Commands

### PostgreSQL:
```bash
# Connect to database
docker exec -it joallm-postgres psql -U postgres -d joallm

# Check table sizes
docker exec joallm-postgres psql -U postgres -d joallm -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Check row counts
docker exec joallm-postgres psql -U postgres -d joallm -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
```

### Redis:
```bash
# Connect to Redis
docker exec -it joallm-redis redis-cli

# Check keys
docker exec joallm-redis redis-cli --scan

# Check queue status
docker exec joallm-redis redis-cli ZCARD bull:document-processing:failed
docker exec joallm-redis redis-cli ZCARD bull:document-indexing:completed
```

---

## 📝 Schema Reference

### Core Tables:

**users** - User accounts and authentication
- Authentication via email/password
- Role-based access (casual, admin, premium, superuser)
- Subscription tiers (free, pro, enterprise)
- Usage statistics tracking
- API key storage (encrypted JSONB)

**chat_sessions** - Conversation management
- Short IDs for URL sharing
- Model and parameter tracking
- Auto-titling support
- Session activity status

**messages** - Chat message history
- Role-based messages (user, assistant, system)
- Attachment support (images, files)
- Token usage tracking
- Rich metadata

**files** - File upload management
- Multi-provider storage (Cloudflare R2, AWS S3)
- Processing status tracking
- Rich metadata (pages, language, word count)
- Embedding model tracking

**document_chunks** - RAG knowledge base
- Text chunking with metadata
- Vector embeddings (1024-dim)
- Page and character position tracking
- Indexed for fast similarity search

**workflows** - Visual workflow builder
- Node-based workflow definition
- Public/template sharing
- JSON-based storage

**models** - Dynamic model registry
- Provider-agnostic model management
- Capability tracking
- Cost and performance metadata

**search_history** - RAG search analytics
- Query tracking
- Performance metrics
- Success/failure logging

---

## 🎯 Summary

The JoaLLM database is well-structured with proper vector search capabilities and good data integrity. There are 2 active users, 4 chat sessions with 16 messages, and 43 processed documents in the RAG system. The main issue to address is the document chunking problem where files are not being properly split into multiple chunks, which could impact RAG search quality. The infrastructure is solid with proper indexing, foreign keys, and queue management in place.

**Database Health:** ✅ Good (with minor issues to fix)  
**Vector Search:** ✅ Operational  
**Job Queues:** ✅ Active  
**Data Quality:** ⚠️ Needs chunking fix


