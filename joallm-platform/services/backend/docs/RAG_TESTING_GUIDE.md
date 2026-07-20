# RAG Testing Guide

## ✅ RAG Service is NOW Working!

The RAG (Retrieval Augmented Generation) service has been fixed and is now operational.

## 🔧 What Was Fixed:

1. ✅ **Background Workers** - Added document processing and indexing workers to `index.ts`
2. ✅ **Pgvector Extension** - Installed in PostgreSQL for vector embeddings
3. ✅ **Cohere API** - Configured for generating embeddings
4. ✅ **Redis** - Running for job queue management

## 📊 Current RAG Status:

```bash
# Check RAG stats
curl http://localhost:3001/api/rag/stats
```

## 🧪 How to Test RAG

### Step 1: Login and Get Token

```bash
# Login as support user
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"support@joallm.ai","password":"test"}' | jq -r '.accessToken'
```

Save the token to a variable:
```bash
TOKEN="your-token-here"
```

### Step 2: Upload a Document

**Option A: Upload a text file**
```bash
# Create a test document
cat > test-rag.txt << 'EOF'
This is a comprehensive guide about artificial intelligence and machine learning.

Key Topics:
- Natural Language Processing (NLP) allows computers to understand human language
- Computer Vision enables machines to interpret visual information
- Deep Learning uses neural networks with multiple layers
- Large Language Models like GPT can generate human-like text
- Supervised learning requires labeled training data
- Unsupervised learning finds patterns in unlabeled data
- Reinforcement learning learns through trial and error

Applications:
- Chatbots and virtual assistants
- Image recognition and classification
- Speech recognition and synthesis
- Recommendation systems
- Autonomous vehicles
- Medical diagnosis
EOF

# Upload the file
curl -X POST http://localhost:3001/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-rag.txt"
```

**Option B: From the Frontend**
1. Open http://localhost:5173
2. Login with `support@joallm.ai` / `test`
3. Go to "Documents" or "Files" section
4. Upload a PDF, TXT, MD, DOC, or DOCX file
5. Wait for processing (check status)

### Step 3: Check Processing Status

```bash
# List your files
curl -s http://localhost:3001/api/files \
  -H "Authorization: Bearer $TOKEN" | jq '.files[]'
```

Look for:
- `"status": "processed"` - File is ready for RAG
- `"status": "processing"` - Still being processed
- `"status": "failed"` - Processing failed (check logs)

### Step 4: Test RAG Search

```bash
# Search for content
curl -X POST http://localhost:3001/api/rag/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "What is machine learning?",
    "limit": 5
  }' | jq
```

**Expected Response:**
```json
{
  "query": "What is machine learning?",
  "results": [
    {
      "id": "chunk-id",
      "content": "...relevant text...",
      "score": 0.85,
      "metadata": {
        "fileId": "...",
        "filename": "test-rag.txt",
        "chunkIndex": 0
      }
    }
  ],
  "totalResults": 3,
  "searchTime": 145
}
```

### Step 5: Test RAG Chat

```bash
# Have a conversation with your documents
curl -X POST http://localhost:3001/api/rag/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "Explain deep learning in simple terms",
    "includeContext": true
  }' | jq
```

**Expected Response:**
```json
{
  "response": "Deep learning is a type of machine learning that uses neural networks with multiple layers...",
  "sources": [
    {
      "id": "...",
      "filename": "test-rag.txt",
      "content": "Deep Learning uses neural networks with multiple layers",
      "score": 0.92,
      "chunkIndex": 1
    }
  ],
  "conversationId": "conv_123",
  "timestamp": "2025-11-06T..."
}
```

### Step 6: Advanced RAG Search

**Hybrid Search (Vector + Keyword):**
```bash
curl -X POST http://localhost:3001/api/rag/search/hybrid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "neural networks",
    "limit": 5,
    "searchType": "hybrid",
    "vectorWeight": 0.7,
    "keywordWeight": 0.3
  }' | jq
```

**Search in Specific Files:**
```bash
curl -X POST http://localhost:3001/api/rag/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "AI applications",
    "fileIds": ["file-id-1", "file-id-2"],
    "limit": 3
  }' | jq
```

## 🐛 Troubleshooting

### Issue: Files show "failed" status

**Check 1: Are workers running?**
```bash
# Should see log: "🔧 Document processing workers started"
curl http://localhost:3001/api/health
```

**Check 2: Is Cohere API key valid?**
```bash
# Check backend .env file
grep COHERE_API_KEY services/backend/.env
```

**Check 3: Check BullMQ jobs**
```bash
# Check if jobs are in the queue
# (You'd need a BullMQ board or Redis CLI for this)
```

### Issue: No search results

**Possible causes:**
1. **File not processed yet** - Wait a minute after upload
2. **No embeddings generated** - Check if Cohere API key is working
3. **Query too specific** - Try broader search terms
4. **Threshold too high** - Lower the `threshold` parameter (default: 0.7)

**Solution:**
```bash
# Try with lower threshold
curl -X POST http://localhost:3001/api/rag/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "AI",
    "limit": 5,
    "threshold": 0.1
  }' | jq
```

### Issue: "Processing failed" error

**Check backend logs:**
```bash
# If using npm run dev
# Logs will appear in the terminal

# Common causes:
# 1. Redis not running
# 2. Database connection failed
# 3. API key invalid/expired
```

## 📈 Performance Tips

1. **Chunk Size**: Default is 1000 characters with 200 overlap
2. **Search Limit**: Start with 5 results, increase if needed
3. **Threshold**: 0.7 is good for precise results, 0.3-0.5 for broader results
4. **File Types**: PDF, TXT, MD work best; DOCX requires additional processing

## 🎯 RAG Best Practices

1. **Upload Related Documents**: RAG works better with multiple related documents
2. **Clear Queries**: Be specific in your search/chat queries
3. **Monitor Processing**: Check file status before searching
4. **Use Hybrid Search**: Combines semantic and keyword matching
5. **Include Context**: Enable `includeContext` in chat for better responses

## 🔍 RAG API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rag/stats` | GET | Get RAG system statistics |
| `/api/rag/search` | POST | Search documents by semantic similarity |
| `/api/rag/chat` | POST | Chat with your knowledge base |
| `/api/rag/search/hybrid` | POST | Hybrid search (vector + keyword) |
| `/api/rag/query/enhance` | POST | Enhance query before searching |
| `/api/rag/context/optimize` | POST | Optimize retrieved context |
| `/api/rag/reindex/:fileId` | POST | Reindex a specific document |
| `/api/rag/chunks/:fileId` | GET | Get chunks for a document |
| `/api/files/upload` | POST | Upload document for RAG |
| `/api/files` | GET | List your documents |

## 📚 Example Use Cases

### 1. Document Q&A System
Upload PDFs/docs, then ask questions about them

### 2. Knowledge Base Search
Search across multiple documents for specific information

### 3. Context-Aware Chat
Have conversations that reference your uploaded documents

### 4. Research Assistant
Upload research papers, ask for summaries or specific findings

### 5. Code Documentation
Upload code docs, search for specific functions or examples

---

## 🎉 RAG is Ready!

You can now:
- ✅ Upload documents (PDF, TXT, MD, DOC, DOCX)
- ✅ Search your documents semantically
- ✅ Chat with your knowledge base
- ✅ Get AI-powered answers from your documents

**Happy Testing! 🚀**


