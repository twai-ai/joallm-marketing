# RAG Search Session Implementation

## Overview
Implemented comprehensive RAG search session tracking following the same pattern as chat sessions, allowing users to maintain search history and context across their RAG search sessions.

## Database Schema Changes

### New Tables Added

#### 1. `rag_search_sessions` Table
- **Purpose**: Track RAG search sessions
- **Fields**:
  - `id`: UUID primary key
  - `user_id`: Foreign key to users table
  - `short_id`: Unique short identifier (8 characters)
  - `title`: Session title
  - `search_type`: Type of search (vector, keyword, hybrid)
  - `parameters`: JSON object with search parameters
  - `document_ids`: Array of document IDs to search within
  - `is_active`: Boolean flag for active sessions
  - `created_at`, `updated_at`: Timestamps

#### 2. `rag_search_queries` Table
- **Purpose**: Track individual search queries within sessions
- **Fields**:
  - `id`: UUID primary key
  - `session_id`: Foreign key to rag_search_sessions
  - `query`: Original search query
  - `enhanced_query`: Query after enhancement/rewriting
  - `results_count`: Number of results returned
  - `search_time`: Search duration in milliseconds
  - `average_score`: Average similarity score of results
  - `search_type`: Type of search performed
  - `parameters`: Search parameters used
  - `success`: Boolean flag for successful searches
  - `error_message`: Error message if search failed
  - `created_at`: Timestamp

### Migration
- Created migration file: `0008_add_rag_search_sessions.sql`
- Includes proper indexes for performance
- Includes foreign key constraints
- Includes table comments for documentation

## API Endpoints

### 1. Create RAG Search Session
```
POST /api/rag/sessions
```
- Creates a new RAG search session
- Generates unique short ID
- Returns session details including ID and short ID

### 2. Get All RAG Search Sessions
```
GET /api/rag/sessions?page=1&limit=20&search=query
```
- Lists all RAG search sessions with pagination
- Includes search functionality
- Returns session count and query count per session

### 3. Get Session Queries
```
GET /api/rag/sessions/:sessionId/queries?page=1&limit=50
```
- Retrieves all queries for a specific session
- Includes pagination
- Returns detailed query information

## Session Tracking Integration

### Search Endpoints Updated
Both regular search and hybrid search endpoints now support session tracking:

#### Regular Search
```
POST /api/rag/search
```
- Added optional `sessionId` parameter
- Logs queries to session when `sessionId` provided
- Updates session `updatedAt` timestamp

#### Hybrid Search
```
POST /api/rag/search/hybrid
```
- Added optional `sessionId` parameter
- Logs queries to session when `sessionId` provided
- Updates session `updatedAt` timestamp

### Session Logging Features
- **Automatic Query Logging**: All searches with sessionId are automatically logged
- **Performance Tracking**: Records search time and result counts
- **Error Handling**: Logs failed searches with error messages
- **Session Updates**: Updates session timestamp on each query

## User Role Update

### Default Role Changed
- Updated user schema to include 'casual' role
- Changed default role from 'user' to 'casual'
- Updated enum: `['casual', 'user', 'admin', 'premium']`

## Frontend Theme Fixes

### Login Screen Theme
- Updated login page background to use JoaLLM brand colors
- Changed from blue gradient to `bg-joa-bg bg-joa-network`
- Updated form buttons to use `bg-joa-primary` instead of blue
- Applied consistent JoaLLM branding across login and register forms

## File Upload Support Verification

### Comprehensive File Type Support
The Knowledge Manager already supports a wide range of file types:

#### Documents
- PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- OpenDocument formats: ODT, ODS, ODP

#### Text Files
- TXT, MD, Markdown, CSV, HTML, XML, RTF

#### Images
- JPG, JPEG, PNG, GIF, WebP, BMP, TIFF, SVG

#### Archives
- ZIP, RAR, 7Z

#### Data Formats
- JSON, YAML, YML

#### Code Files
- JS, TS, PY, Java, C, C++, C#, PHP, Ruby, Go, Rust, SQL

#### Ebooks
- EPUB, MOBI

#### Other
- VCF, MSG, EML

## Testing Results

### Backend API Testing
✅ **Session Creation**: Successfully creates RAG search sessions
✅ **Search with Session**: Successfully tracks searches in sessions
✅ **Query Retrieval**: Successfully retrieves session queries
✅ **Session Management**: Proper session lifecycle management

### Example API Usage

#### Create Session
```bash
curl -X POST http://localhost:3001/api/rag/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title": "Railway Search Session", "searchType": "hybrid"}'
```

#### Search with Session Tracking
```bash
curl -X POST http://localhost:3001/api/rag/search/hybrid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query": "Railway", "limit": 3, "threshold": 0.1, "sessionId": "<session-id>"}'
```

#### Get Session Queries
```bash
curl -X GET http://localhost:3001/api/rag/sessions/<session-id>/queries \
  -H "Authorization: Bearer <token>"
```

## Benefits

1. **Search History**: Users can track their search history across sessions
2. **Context Preservation**: Maintains search context and parameters
3. **Performance Analytics**: Tracks search performance and result quality
4. **User Experience**: Better search experience with session management
5. **Data Insights**: Provides valuable analytics on search patterns

## Next Steps

The backend implementation is complete and tested. The next step would be to update the frontend to:
1. Create and manage RAG search sessions
2. Display session history
3. Show query history within sessions
4. Integrate session tracking with the search interface

## Files Modified

### Backend
- `src/database/schema.ts` - Added RAG session tables
- `src/database/migrations/0008_add_rag_search_sessions.sql` - Migration
- `src/routes/rag.ts` - Added session endpoints and tracking

### Frontend
- `src/pages/LoginPage.tsx` - Updated theme
- `src/components/common/FormValidation.tsx` - Updated button themes

## Database Migration
Run the migration to create the new tables:
```bash
psql postgresql://shyamshundar@localhost:5432/joallm_dev -f src/database/migrations/0008_add_rag_search_sessions.sql
```
