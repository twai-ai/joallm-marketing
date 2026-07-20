# Railway Deployment Guide

## Overview

This guide covers deploying the JoaLLM platform to Railway, a platform-as-a-service that simplifies deployment with automatic builds, deployments, and infrastructure management.

## Prerequisites

- Railway account (https://railway.app)
- Git repository connected to Railway
- PostgreSQL and Redis databases provisioned in Railway

## Environment Variables Setup

### Required Variables

All services require these critical environment variables to be set in Railway:

#### Backend Service

```bash
# Security (REQUIRED - generate strong random keys)
JWT_SECRET=<64-char-hex-key>
API_KEY=<64-char-hex-key>
ENCRYPTION_KEY=<64-char-hex-key>

# Database (provided by Railway PostgreSQL plugin)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (provided by Railway Redis plugin)
REDIS_URL=${{Redis.REDIS_URL}}

# Google OAuth
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=https://your-backend-url.railway.app/api/auth/google/callback

# LLM Provider Keys (Optional - users can provide their own)
OPENAI_API_KEY=<optional>
ANTHROPIC_API_KEY=<optional>
GROQ_API_KEY=<optional>
COHERE_API_KEY=<recommended-for-embeddings>

# Server Config
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-frontend-url.railway.app,https://your-landing-url.railway.app
FRONTEND_URL=https://your-frontend-url.railway.app
LOG_LEVEL=info
```

#### Frontend Service

```bash
NODE_ENV=production
VITE_API_URL=https://your-backend-url.railway.app
VITE_API_BASE_URL=https://your-backend-url.railway.app
VITE_APP_ENV=production
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG_MODE=false
```

#### Landing Page Service

```bash
NODE_ENV=production
VITE_API_URL=https://your-backend-url.railway.app
VITE_APP_ENV=production
```

## Step-by-Step Deployment

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Or link existing project
railway link
```

### 2. Provision Databases

In Railway dashboard:
1. Click "+ New" → "Database" → "PostgreSQL"
2. Click "+ New" → "Database" → "Redis"
3. Note the connection URLs provided

### 3. Deploy Backend

```bash
cd services/backend

# Set environment variables (example)
railway variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
railway variables set API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
railway variables set ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Set database URLs (use Railway's provided values)
railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}'
railway variables set REDIS_URL='${{Redis.REDIS_URL}}'

# Set OAuth credentials
railway variables set GOOGLE_CLIENT_ID="your-client-id"
railway variables set GOOGLE_CLIENT_SECRET="your-secret"

# Deploy
railway up
```

### 4. Deploy Frontend

```bash
cd services/frontend

# Set environment variables
railway variables set VITE_API_URL="https://your-backend.railway.app"
railway variables set VITE_API_BASE_URL="https://your-backend.railway.app"
railway variables set NODE_ENV="production"

# Deploy
railway up
```

### 5. Deploy Landing Page

```bash
cd services/landing-page

# Set environment variables
railway variables set VITE_API_URL="https://your-backend.railway.app"
railway variables set NODE_ENV="production"

# Deploy
railway up
```

## Automated Deployment via GitHub

### Setup GitHub Integration

1. In Railway dashboard, go to project settings
2. Connect GitHub repository
3. Configure auto-deploy:
   - Branch: `main`
   - Service: Select each service
   - Root Directory: Set to service path (e.g., `services/backend`)

### Deployment Trigger

Once configured, deployments trigger automatically on:
- Push to `main` branch
- Pull request merge
- Manual trigger in Railway dashboard

## Database Migrations

Migrations run automatically on backend startup via `src/index.ts`:

```typescript
await initializeDatabase();
await runMigrations();
```

### Manual Migration (if needed)

```bash
railway run -s backend npm run db:migrate
```

## Health Checks

Railway automatically monitors the health endpoint:

```bash
# Backend health check
curl https://your-backend.railway.app/api/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-..."
}
```

## Monitoring & Logs

### View Logs

```bash
# Real-time logs
railway logs -s backend --follow

# Recent logs
railway logs -s backend --tail 100

# Filter by level
railway logs -s backend | grep ERROR
```

### Metrics

Available in Railway dashboard:
- CPU usage
- Memory usage
- Network traffic
- Request count
- Response times

## Scaling

### Horizontal Scaling

```bash
# Increase replicas (Pro plan required)
railway scale -s backend --replicas 3
```

### Vertical Scaling

Adjust in Railway dashboard:
1. Go to service settings
2. Increase memory/CPU limits
3. Service will restart with new limits

## Troubleshooting

### Common Issues

#### 1. Build Fails

```bash
# Check build logs
railway logs -s backend --deployment <id>

# Common causes:
# - Missing environment variables
# - TypeScript compilation errors
# - Dependency installation failures

# Solution: Fix errors and redeploy
```

#### 2. Database Connection Error

```bash
# Verify DATABASE_URL is set
railway variables get DATABASE_URL

# Check PostgreSQL status
railway status

# Restart database if needed
railway restart -s postgres
```

#### 3. High Memory Usage

```bash
# Check metrics in dashboard
# Increase memory limit or optimize:
# - Enable caching
# - Reduce connection pool
# - Check for memory leaks
```

#### 4. CORS Errors

```bash
# Verify CORS_ORIGIN includes frontend URL
railway variables get CORS_ORIGIN

# Update if needed
railway variables set CORS_ORIGIN="https://frontend.railway.app,https://landing.railway.app"
```

## Rollback

### Via Dashboard

1. Go to Deployments tab
2. Find last working deployment
3. Click "Redeploy"

### Via CLI

```bash
# List deployments
railway deployments

# Redeploy specific deployment
railway redeploy <deployment-id>
```

## Custom Domains

### Add Custom Domain

1. In Railway dashboard, go to service settings
2. Click "Add Domain"
3. Enter your domain (e.g., api.joallm.com)
4. Configure DNS:
   - Type: CNAME
   - Name: api (or @)
   - Value: <provided-by-railway>

### SSL Certificates

Railway automatically provisions SSL certificates via Let's Encrypt.

## Cost Optimization

### Tips to Reduce Costs

1. **Right-size services**: Start with smallest instance, scale up if needed
2. **Use caching**: Redis caching reduces database queries
3. **Optimize queries**: Add indexes, use connection pooling
4. **Monitor usage**: Check Railway usage dashboard regularly
5. **Implement rate limiting**: Prevent abuse and excessive usage

### Estimated Costs (Railway)

- Starter Plan: $5/month
  - 512 MB RAM, 1 vCPU
  - Good for development/testing

- Pro Plan: $20/month
  - 8 GB RAM, 8 vCPUs shared
  - Good for production (100-1000 users)

- Database costs separate:
  - PostgreSQL: ~$5-10/month
  - Redis: ~$5/month

## Security Checklist

Before going to production:

- [ ] All secrets set in Railway (not in code)
- [ ] HTTPS enabled (automatic on Railway)
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Database backups configured
- [ ] Monitoring alerts set up
- [ ] Health checks passing
- [ ] Security headers configured
- [ ] Input validation enabled
- [ ] API keys encrypted at rest

## Support

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Support**: help@railway.app



