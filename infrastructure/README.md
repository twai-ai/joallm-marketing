# Infrastructure

This directory contains deployment configurations, infrastructure as code, and deployment scripts for the JoaLLM platform.

## Contents

- `railway.json` - Railway deployment configuration for all services
- `*.deploy.sh` - Deployment scripts
- `docker-compose.yml` - Local development environment (if needed)

## Railway Deployment

### Services Configuration

The platform deploys three separate services on Railway:

1. **Backend** - API service running on Node.js
2. **Commercial Frontend** - Commercial React application
3. **Landing Page** - Marketing website

### Environment Variables

Each service requires specific environment variables to be set in Railway:

#### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GROQ_API_KEY` - Groq API key
- `COHERE_API_KEY` - Cohere API key

#### Frontend Services
- `VITE_API_URL` - Backend API URL
- (Add other frontend-specific variables as needed)

### Deployment Steps

1. Connect repository to Railway
2. Railway will detect the `railway.json` configuration
3. Set environment variables in Railway dashboard
4. Deploy each service

## Local Development Setup

For local development, you can use Docker Compose:

```bash
cd infrastructure
docker-compose up
```

This will start PostgreSQL and Redis services locally.

## Monitoring

- Railway provides built-in monitoring and logging
- Set up health check endpoints for each service
- Monitor application logs through Railway dashboard


