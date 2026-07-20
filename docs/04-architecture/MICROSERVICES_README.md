# JoaLLM Microservices Architecture

This document describes the microservices architecture implementation for the JoaLLM platform, which decomposes the monolithic backend into specialized services.

## Architecture Overview

The platform is now decomposed into the following services:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Landing Page  │    │   API Gateway   │
│   (Port 5173)   │    │   (Port 3005)   │    │   (Port 3000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                └────────────────────────┼────────────────────────┐
                                                         │                        │
                                                         ▼                        ▼
                                               ┌─────────────────┐    ┌─────────────────┐
                                               │  Auth Service   │    │  Chat Service   │
                                               │  (Port 3001)    │    │  (Port 3002)    │
                                               └─────────────────┘    └─────────────────┘
                                                         │                        │
                                                         ▼                        ▼
                                               ┌─────────────────┐    ┌─────────────────┐
                                               │  RAG Service    │    │  File Service   │
                                               │  (Port 3003)    │    │  (Port 3004)    │
                                               └─────────────────┘    └─────────────────┘
                                                         │                        │
                                                         └────────────────────────┼────────────────────────┐
                                                                                   │                        │
                                                                                   ▼                        ▼
                                                                         ┌─────────────────┐    ┌─────────────────┐
                                                                         │   PostgreSQL    │    │     Redis       │
                                                                         │   (Port 5432)   │    │   (Port 6379)   │
                                                                         └─────────────────┘    └─────────────────┘
```

## Services

### 1. API Gateway (Port 3000)
- **Purpose**: Central entry point for all client requests
- **Responsibilities**:
  - Request routing to appropriate services
  - Load balancing across service instances
  - Circuit breaker pattern implementation
  - Rate limiting and throttling
  - Service health monitoring
  - CORS handling
- **Technology**: Fastify, Redis
- **Health Check**: `GET /health`

### 2. Auth Service (Port 3001)
- **Purpose**: User authentication and authorization
- **Responsibilities**:
  - User registration and login
  - JWT token generation and validation
  - Password management
  - User profile management
  - Session management
- **Technology**: Fastify, PostgreSQL, Redis, JWT
- **Health Check**: `GET /api/auth/health`
- **Database**: `joallm_auth`

### 3. Chat Service (Port 3002)
- **Purpose**: Chat functionality and LLM interactions
- **Responsibilities**:
  - Chat session management
  - Message handling and storage
  - LLM provider integration (OpenAI, Anthropic, Groq, etc.)
  - Streaming responses
  - Auto-title generation
- **Technology**: Fastify, PostgreSQL, Redis, Multiple LLM APIs
- **Health Check**: `GET /health`
- **Database**: `joallm_chat`

### 4. RAG Service (Port 3003)
- **Purpose**: Retrieval-Augmented Generation functionality
- **Responsibilities**:
  - Document processing and indexing
  - Vector embeddings generation
  - Semantic search
  - Context retrieval for LLM queries
- **Status**: Placeholder for future implementation
- **Technology**: TBD (likely Fastify, PostgreSQL with pgvector, Redis)

### 5. File Service (Port 3004)
- **Purpose**: File upload and management
- **Responsibilities**:
  - File upload handling
  - File storage management
  - File processing and validation
  - File metadata management
- **Status**: Placeholder for future implementation
- **Technology**: TBD (likely Fastify, Cloud storage integration)

## Event-Driven Communication

The services communicate through an event-driven architecture using Redis as the message broker:

### Event Types
- **User Events**: `user.created`, `user.updated`, `user.deleted`, `user.login`, `user.logout`
- **Chat Events**: `chat.session.created`, `chat.session.updated`, `chat.message.sent`
- **File Events**: `file.uploaded`, `file.processed`, `file.deleted`
- **RAG Events**: `rag.document.indexed`, `rag.search.performed`
- **System Events**: `system.health.check`, `system.service.up`, `system.service.down`

### Event Bus Implementation
- **Technology**: Redis Pub/Sub
- **Features**: 
  - Reliable message delivery
  - Event replay capabilities
  - Dead letter queue handling
  - Event validation and schema enforcement

## Database Schema

Each service owns its specific data:

### Auth Service Database (`joallm_auth`)
- `users` - User accounts and profiles
- `user_sessions` - Active user sessions and refresh tokens

### Chat Service Database (`joallm_chat`)
- `chat_sessions` - Chat conversation sessions
- `messages` - Individual chat messages

### Shared Database (`joallm`)
- Used for shared data and cross-service queries
- Contains models, system configuration, etc.

## Deployment

### Development
```bash
# Start all services
docker-compose -f docker-compose.yml -f docker-compose.microservices.yml up

# Start specific services
docker-compose -f docker-compose.yml -f docker-compose.microservices.yml up api-gateway auth-service chat-service
```

### Production
```bash
# Build and start all services
docker-compose -f docker-compose.yml -f docker-compose.microservices.yml up --build -d
```

## Environment Configuration

Copy `env.microservices.example` to `.env.microservices` and configure:

```bash
cp env.microservices.example .env.microservices
```

Key environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `SERVICE_API_KEY` - Inter-service authentication
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. - LLM provider API keys

## Service Discovery and Load Balancing

The API Gateway implements:
- **Service Registry**: Tracks healthy service instances
- **Health Checks**: Monitors service availability
- **Load Balancing**: Round-robin, least-connections, random strategies
- **Circuit Breaker**: Prevents cascading failures
- **Retry Logic**: Automatic retry with exponential backoff

## Monitoring and Observability

### Health Endpoints
- Gateway: `GET /health` - Basic health check
- Gateway: `GET /health/detailed` - Detailed service status
- Gateway: `GET /services` - Service registry status
- Gateway: `GET /circuit-breakers` - Circuit breaker status

### Logging
- Structured JSON logging
- Service-specific log levels
- Centralized log aggregation (in production)

### Metrics
- Request/response times
- Error rates
- Service availability
- Circuit breaker states

## Development Workflow

### Adding a New Service
1. Create service directory in `services/`
2. Add service configuration to `docker-compose.microservices.yml`
3. Implement health check endpoint
4. Add service to API Gateway routing
5. Update service registry configuration

### Service Communication
- **Synchronous**: HTTP/REST API calls through API Gateway
- **Asynchronous**: Event publishing/subscribing through Redis
- **Authentication**: Service-to-service using API keys

## Security Considerations

- **Service Authentication**: API keys for inter-service communication
- **JWT Tokens**: User authentication and authorization
- **CORS**: Configured for specific origins
- **Rate Limiting**: Per-user and per-service rate limits
- **Input Validation**: Zod schemas for request validation
- **SQL Injection**: Parameterized queries with Drizzle ORM

## Scalability

### Horizontal Scaling
- Each service can be scaled independently
- Load balancer distributes traffic across instances
- Database read replicas for read-heavy workloads

### Vertical Scaling
- Resource allocation per service
- Memory and CPU optimization
- Database connection pooling

## Migration from Monolith

The microservices architecture maintains backward compatibility:
- Same API endpoints
- Same authentication flow
- Same database schemas (initially)
- Gradual migration of functionality

## Troubleshooting

### Common Issues
1. **Service Unavailable**: Check service health and circuit breaker status
2. **Database Connection**: Verify PostgreSQL is running and accessible
3. **Redis Connection**: Verify Redis is running and accessible
4. **API Key Issues**: Check service API key configuration
5. **CORS Issues**: Verify CORS origin configuration

### Debug Commands
```bash
# Check service logs
docker-compose logs auth-service
docker-compose logs chat-service
docker-compose logs api-gateway

# Check service health
curl http://localhost:3000/health/detailed

# Check circuit breaker status
curl http://localhost:3000/circuit-breakers
```

## Future Enhancements

1. **Service Mesh**: Istio or Linkerd for advanced traffic management
2. **Distributed Tracing**: Jaeger or Zipkin for request tracing
3. **Metrics Collection**: Prometheus and Grafana for monitoring
4. **Message Queues**: Apache Kafka for high-throughput event processing
5. **API Versioning**: Semantic versioning for API evolution
6. **Blue-Green Deployment**: Zero-downtime deployments
7. **Auto-scaling**: Kubernetes HPA based on metrics

