# Document Upload and Processing Guide

## ✅ What's Been Fixed

### 1. **Document Processing Pipeline**
- ✅ Fixed embedding storage to use proper vector types instead of JSON strings
- ✅ Updated schema to include `indexedAt` timestamp for tracking
- ✅ Ensured documents are properly vectorized during upload
- ✅ Added comprehensive metadata tracking

### 2. **Vector Storage**
- ✅ Documents are now stored with proper pgvector embeddings (1024 dimensions for Cohere)
- ✅ Embeddings are generated immediately during upload processing
- ✅ Status tracking shows "processed" when document is ready for search

### 3. **Processing Flow**
```
Upload → Extract Text → Create Chunks → Generate Embeddings → Store Vectors → Mark as "processed"
```

## 🚀 How It Works Now

### When a User Uploads a Document:

1. **Upload**: File is uploaded via `/api/files/upload`
2. **Processing**: Status changes to "processing"
3. **Text Extraction**: Document content is extracted based on file type
4. **Chunking**: Text is split into semantic chunks (1000 chars with 200 overlap)
5. **Vectorization**: Each chunk gets Cohere embeddings (1024 dimensions)
6. **Storage**: Chunks and embeddings stored in PostgreSQL with pgvector
7. **Completion**: Status changes to "processed" with metadata

### File Status Tracking:
- `uploaded` → `processing` → `processed` (ready for search)
- `failed` (if processing fails)

## 🧪 Testing the Upload Process

### 1. **Backend Server is Running**
```bash
cd joallm-backend
DATABASE_URL=postgresql://shyamshundar@localhost:5432/joallm_dev npm run dev
```

### 2. **Upload via Frontend**
- Go to the frontend application
- Navigate to the Knowledge Manager or File Upload section
- Upload a document (PDF, TXT, MD, DOCX, etc.)
- Watch the status change from "uploaded" → "processing" → "processed"

### 3. **Verify Processing**
```bash
# Check the most recent upload
node scripts/test-document-upload.js

# Test RAG search on uploaded documents
node scripts/test-rag.js
```

### 4. **Check Database**
```sql
-- Check file status and metadata
SELECT filename, status, metadata->>'chunks' as chunks, 
       metadata->>'embeddingModel' as model,
       metadata->>'indexedAt' as indexed_at
FROM files 
ORDER BY created_at DESC 
LIMIT 5;

-- Check embeddings coverage
SELECT f.filename, 
       COUNT(dc.id) as total_chunks,
       COUNT(dc.embedding) as chunks_with_embeddings
FROM files f
LEFT JOIN document_chunks dc ON f.id = dc.file_id
WHERE f.status = 'processed'
GROUP BY f.id, f.filename;
```

## 📊 What Users See

### During Upload:
- **Immediate feedback**: "File uploaded successfully"
- **Processing status**: "Processing document..."
- **Completion**: "Document processed and ready for search"

### In File List:
- **Status**: "processed" (green indicator)
- **Metadata**: Shows chunks count, embedding model, processing time
- **Searchable**: Document appears in RAG search results

### In Search Results:
- **Relevant chunks** from the document
- **Similarity scores** showing relevance
- **Source attribution** with filename and chunk info

## 🔧 Technical Details

### Supported File Types:
- **Documents**: PDF, DOC, DOCX, TXT, MD, RTF
- **Images**: JPG, PNG, GIF, WebP (with OCR)
- **Code**: JS, TS, Python, Java, etc.
- **Data**: JSON, CSV, XML, YAML
- **Archives**: ZIP, RAR (extracted)

### Embedding Configuration:
- **Primary**: Cohere embed-english-v3.0 (1024 dimensions)
- **Fallback**: OpenAI text-embedding-ada-002 (1536 dimensions)
- **Development**: Mock embeddings for testing

### Chunking Strategy:
- **Size**: 1000 characters per chunk
- **Overlap**: 200 characters between chunks
- **Semantic breaks**: Respects sentence and paragraph boundaries

## 🎯 Expected Behavior

### ✅ Success Case:
1. User uploads document
2. Status shows "processing" briefly
3. Status changes to "processed"
4. Document appears in search results
5. RAG queries return relevant content

### ❌ Failure Cases:
- **File type not supported**: Clear error message
- **Processing fails**: Status shows "failed" with error details
- **Embedding generation fails**: Falls back to mock embeddings
- **Storage issues**: Proper error handling and logging

## 🚨 Troubleshooting

### Document Not Processing:
```bash
# Check server logs
tail -f logs/app.log

# Check database status
psql -d joallm_dev -c "SELECT filename, status, processing_error FROM files WHERE status = 'failed';"

# Reindex failed documents
node scripts/reindex-all-documents.js
```

### No Search Results:
```bash
# Check embeddings coverage
node scripts/test-document-upload.js

# Test RAG functionality
node scripts/test-rag.js

# Verify vector storage
psql -d joallm_dev -c "SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL;"
```

### Performance Issues:
- Check embedding service API limits
- Monitor database connection pool
- Verify pgvector extension is working
- Check Redis queue status

## 📈 Monitoring

### Key Metrics to Track:
- **Upload success rate**: % of successful uploads
- **Processing time**: Average time from upload to processed
- **Embedding coverage**: % of chunks with embeddings
- **Search performance**: Response times for RAG queries
- **Error rates**: Failed uploads and processing errors

### Logs to Monitor:
- File upload events
- Document processing progress
- Embedding generation status
- Search query performance
- Error messages and stack traces

## 🎉 Summary

The document upload and processing pipeline is now fully functional:

✅ **Automatic vectorization** during upload
✅ **Proper status tracking** for user feedback  
✅ **Cohere embeddings** with pgvector storage
✅ **Comprehensive error handling**
✅ **Ready for RAG search** immediately after processing

Users can now upload documents and they will be automatically processed, vectorized, and made available for semantic search within seconds!
