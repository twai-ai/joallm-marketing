# Deployment Runbook

## Pre-Deployment Checklist

### Environment Variables
Ensure all required environment variables are set:

```bash
# Critical (must be set in production)
JWT_SECRET=<strong-random-key>
API_KEY=<strong-random-key>
ENCRYPTION_KEY=<64-char-hex-key>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>

# Database
DATABASE_URL=<postgresql-connection-string>
REDIS_URL=<redis-connection-string>

# Optional LLM Provider Keys
OPENAI_API_KEY=<if-using-openai>
ANTHROPIC_API_KEY=<if-using-anthropic>
GROQ_API_KEY=<if-using-groq>
COHERE_API_KEY=<required-for-embeddings>
```

### Generate Secure Keys

```bash
# JWT Secret (256-bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key (256-bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# API Key (256-bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Railway Deployment

### Initial Setup

1. **Install Railway CLI**:
```bash
npm install -g @railway/cli
railway login
```

2. **Link Project**:
```bash
railway link
```

3. **Set Environment Variables**:
```bash
railway variables set JWT_SECRET="<value>"
railway variables set ENCRYPTION_KEY="<value>"
railway variables set API_KEY="<value>"
# ... set all required variables
```

4. **Deploy**:
```bash
railway up
```

### Deploy Specific Service

```bash
# Deploy backend only
cd services/backend
railway up

# Deploy frontend only
cd services/frontend
railway up
```

## Database Migrations

### Run Migrations

```bash
# On Railway (automatic on deploy)
# Migrations run in services/backend/src/index.ts

# Manual migration (if needed)
cd services/backend
npm run db:migrate
```

### Rollback Migration

```bash
# Drizzle doesn't have built-in rollback
# Manual process:
1. Identify problematic migration
2. Write a reverse migration
3. Apply manually via psql or Drizzle Studio
```

## Deployment Process

### 1. Pre-Deployment

```bash
# Run tests locally
npm test

# Build locally to verify
npm run build

# Check for linting errors
npm run lint
```

### 2. Deploy to Railway

```bash
# Commit and push to main branch
git add .
git commit -m "Deploy: <description>"
git push origin main

# Railway auto-deploys on push to main
# Monitor at: https://railway.app/project/<project-id>
```

### 3. Post-Deployment Verification

```bash
# Check health endpoint
curl https://your-backend-url.railway.app/api/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-..."
}

# Check frontend
curl https://your-frontend-url.railway.app

# Verify logs
railway logs -s backend
railway logs -s frontend
```

## Rollback Procedure

### Quick Rollback

```bash
# Railway dashboard:
1. Go to Deployments
2. Find last working deployment
3. Click "Redeploy"

# Or via CLI:
railway redeploy <deployment-id>
```

### Manual Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Railway will auto-deploy the reverted version
```

## Monitoring Post-Deployment

### Check Logs

```bash
# Backend logs
railway logs -s backend --tail 100

# Frontend logs
railway logs -s frontend --tail 100

# Follow logs in real-time
railway logs -s backend --follow
```

### Performance Metrics

```bash
# Response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-api.railway.app/api/health

# Database connections
railway run -s backend "npm run db:studio"
```

## Common Issues & Solutions

### Issue: Database Connection Failed

```bash
# Check DATABASE_URL
railway variables get DATABASE_URL

# Verify PostgreSQL is running
railway status

# Check logs for connection errors
railway logs -s backend | grep -i "database"
```

### Issue: Redis Connection Failed

```bash
# Check REDIS_URL
railway variables get REDIS_URL

# Verify Redis is running
railway status

# Background workers may fail without Redis
```

### Issue: Build Failed

```bash
# Check build logs
railway logs -s backend --deployment <deployment-id>

# Common causes:
# - Missing dependencies
# - TypeScript errors
# - Environment variables not set

# Fix and redeploy
```

### Issue: High Memory Usage

```bash
# Check metrics in Railway dashboard
# Increase memory limit if needed

# Or optimize:
# - Enable caching
# - Reduce connection pool size
# - Check for memory leaks
```

## Scaling

### Horizontal Scaling

```bash
# Railway dashboard:
1. Go to Settings
2. Increase replica count
3. Configure load balancer

# Currently running single instance (MVP)
```

### Vertical Scaling

```bash
# Railway dashboard:
1. Go to Settings
2. Increase memory/CPU limits
3. Apply changes (restarts service)
```

## Backup & Recovery

### Database Backup

```bash
# Manual backup
railway run -s backend "pg_dump $DATABASE_URL > backup.sql"

# Automated backups (Railway feature)
# Configure in Railway dashboard under Database settings
```

### Restore from Backup

```bash
# Restore database
railway run -s backend "psql $DATABASE_URL < backup.sql"

# Verify data
railway run -s backend "npm run db:studio"
```

## Emergency Contacts

- **DevOps Lead**: [Add contact]
- **Backend Lead**: [Add contact]
- **Railway Support**: https://railway.app/help

## Post-Deployment Tasks

- [ ] Verify health checks passing
- [ ] Check error rates in monitoring
- [ ] Review performance metrics
- [ ] Update deployment log
- [ ] Notify team in Slack/Discord
- [ ] Monitor for 30 minutes post-deploy



