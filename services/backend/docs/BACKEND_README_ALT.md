# JoaLLM Backend

A comprehensive Node.js backend for the JoaLLM platform - a Swiss Army Knife for Large Language Models.

## Features

- **Multi-LLM Support**: OpenAI GPT models and Anthropic Claude models
- **RAG (Retrieval-Augmented Generation)**: Document upload, processing, chunking, and vector search
- **Real-time Chat**: Streaming chat responses with session management
- **File Processing**: PDF, TXT, MD, DOC, DOCX support with background processing
- **Vector Database**: PostgreSQL with pgvector for semantic search
- **Background Jobs**: Redis-based queue system for document processing
- **API Documentation**: Auto-generated Swagger/OpenAPI documentation

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Fastify (high-performance HTTP server)
- **Database**: PostgreSQL with pgvector extension
- **Queue**: Redis with BullMQ
- **File Storage**: Cloudflare R2 / AWS S3
- **LLM Providers**: OpenAI, Anthropic
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Logging**: Winston

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- Redis 6+
- OpenAI API key
- Anthropic API key

### Installation

1. Clone the repository and install dependencies:
```bash
cd joallm-backend
npm install
```

2. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

3. Run database migrations:
```bash
npm run db:migrate
```

4. Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001` with documentation at `http://localhost:3001/docs`.

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/joallm

# Redis
REDIS_URL=redis://localhost:6379

# API Keys
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# File Storage
STORAGE_PROVIDER=cloudflare-r2
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=joallm-documents

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## API Endpoints

### Health Check
- `GET /api/health` - Service health status
- `GET /api/health/ready` - Readiness check
- `GET /api/health/live` - Liveness check

### Models
- `GET /api/models` - List available LLM models
- `GET /api/models/:modelId` - Get model details
- `GET /api/models/:modelId/parameters` - Get default parameters

### Chat
- `POST /api/chat/send` - Send chat message (non-streaming)
- `POST /api/chat/stream` - Send chat message (streaming)
- `GET /api/chat/history/:sessionId` - Get chat history
- `DELETE /api/chat/session/:sessionId` - Delete chat session

### Files
- `POST /api/files/upload` - Upload document
- `GET /api/files` - List uploaded files
- `GET /api/files/:fileId/status` - Get file processing status
- `DELETE /api/files/:fileId` - Delete file
- `GET /api/files/:fileId/download` - Download file

### RAG (Retrieval-Augmented Generation)
- `POST /api/rag/search` - Search documents using RAG
- `GET /api/rag/chunks/:fileId` - Get document chunks
- `POST /api/rag/reindex/:fileId` - Reindex document
- `GET /api/rag/stats` - Get RAG system statistics

## Database Schema

The database includes the following main tables:

- **users** - User accounts and profiles
- **chat_sessions** - Chat conversation sessions
- **messages** - Individual chat messages
- **files** - Uploaded documents
- **document_chunks** - Text chunks with vector embeddings
- **workflows** - Saved workflow definitions
- **workflow_executions** - Workflow execution logs
- **api_usage** - API usage tracking

## File Processing Pipeline

1. **Upload**: File uploaded via `/api/files/upload`
2. **Storage**: File stored in Cloudflare R2 or S3
3. **Processing**: Background job extracts text and creates chunks
4. **Indexing**: Chunks are embedded and stored in vector database
5. **Search**: RAG search finds relevant chunks for queries

## Background Jobs

The system uses Redis queues for background processing:

- **document-processing**: File upload, text extraction, chunking
- **document-indexing**: Generate embeddings and store in vector DB

## Deployment

### Docker

```bash
docker build -t joallm-backend .
docker run -p 3001:3001 --env-file .env joallm-backend
```

## Development

### Database Migrations

```bash
# Generate migration
npm run db:generate

# Run migrations
npm run db:migrate

# Open Drizzle Studio
npm run db:studio
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Fastify API   │    │   PostgreSQL    │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   + pgvector    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌────────┴────────┐
                       │                 │
                ┌──────▼──────┐   ┌──────▼──────┐
                │    Redis    │   │  File Storage│
                │   (Queue)   │   │ (R2/S3)     │
                └─────────────┘   └─────────────┘
                       │
                ┌──────▼──────┐
                │   LLM APIs  │
                │ OpenAI +    │
                │ Anthropic   │
                └─────────────┘
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.


