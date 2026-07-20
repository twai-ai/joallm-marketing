# Railway Deployment Guide

This guide provides step-by-step instructions for deploying the JoaLLM platform to Railway.

## Prerequisites

- Railway account
- GitHub repository connected to Railway
- Required API keys and credentials

## Environment Variables

### Backend Service

Set these environment variables in Railway for the backend service:

#### Database
- `DATABASE_URL` - PostgreSQL connection string (Railway will provide this if you add a PostgreSQL service)
- `DATABASE_HOST` - Database host (optional, extracted from DATABASE_URL)
- `DATABASE_PORT` - Database port (optional, extracted from DATABASE_URL)
- `DATABASE_NAME` - Database name (optional, extracted from DATABASE_URL)
- `DATABASE_USER` - Database user (optional, extracted from DATABASE_URL)
- `DATABASE_PASSWORD` - Database password (optional, extracted from DATABASE_URL)

#### Redis
- `REDIS_URL` - Redis connection string (Railway will provide this if you add a Redis service)
- `REDIS_HOST` - Redis host (optional, extracted from REDIS_URL)
- `REDIS_PORT` - Redis port (optional, extracted from REDIS_URL)

#### API Keys
- `OPENAI_API_KEY` - Your OpenAI API key
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `GROQ_API_KEY` - Your Groq API key
- `COHERE_API_KEY` - Your Cohere API key (optional)

#### Authentication & Security
- `JWT_SECRET` - Strong secret for JWT token signing (generate a secure random string)
- `JWT_EXPIRES_IN` - JWT expiration time (default: "7d")
- `API_KEY` - API key for service-to-service communication

#### File Storage (Cloudflare R2)
- `STORAGE_PROVIDER` - Set to "cloudflare-r2"
- `R2_ACCOUNT_ID` - Your Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID` - Your R2 access key ID
- `R2_SECRET_ACCESS_KEY` - Your R2 secret access key
- `R2_BUCKET_NAME` - Your R2 bucket name

#### Server Configuration
- `PORT` - Server port (Railway will set this automatically)
- `NODE_ENV` - Set to "production"
- `CORS_ORIGIN` - Comma-separated list of allowed origins (set to your frontend URLs)
- `LOG_LEVEL` - Logging level (default: "info")

### Frontend Services

Set these environment variables for both frontend services:

#### Frontend
- `VITE_API_URL` - Backend API URL (e.g., https://your-backend-service.railway.app)
- `VITE_ENABLE_ANALYTICS` - Enable analytics (true/false)
- `VITE_ENABLE_DEBUG_MODE` - Enable debug mode (true/false)
- `VITE_APP_ENV` - App environment (production/staging/development)

#### Landing Page
- `VITE_API_URL` - Backend API URL (e.g., https://your-backend-service.railway.app)
- `VITE_ENABLE_ANALYTICS` - Enable analytics (true/false)
- `VITE_ENABLE_DEBUG_MODE` - Enable debug mode (true/false)
- `VITE_APP_ENV` - App environment (production/staging/development)

## Deployment Steps

### 1. Connect Repository

1. Go to [Railway](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 2. Add Database Services

1. In your Railway project, click "New"
2. Add PostgreSQL service
3. Add Redis service
4. Note the connection URLs provided

### 3. Deploy Services

Railway will automatically detect the `railway.json` configuration and create three services:

1. **Backend** - API service
2. **Frontend** - Main React application
3. **Landing Page** - Marketing website

### 4. Configure Environment Variables

For each service, set the appropriate environment variables listed above.

### 5. Deploy

1. Railway will automatically build and deploy each service
2. Monitor the deployment logs for any issues
3. Check health endpoints:
   - Backend: `https://your-backend-service.railway.app/api/health`

## Service URLs

After deployment, Railway will provide URLs for each service:

- Backend: `https://your-backend-service.railway.app`
- Frontend: `https://your-frontend.railway.app`
- Landing Page: `https://your-landing-page.railway.app`

## Health Checks

The backend service includes comprehensive health checks:

- `/api/health` - Main health check endpoint
- `/api/health/ready` - Readiness check
- `/api/health/live` - Liveness check
- `/api/health/metrics` - Application metrics

## Monitoring

Railway provides built-in monitoring and logging:

- View logs in the Railway dashboard
- Monitor service health and performance
- Set up alerts for service failures

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify `DATABASE_URL` is correctly set
   - Ensure PostgreSQL service is running
   - Check database credentials

2. **Frontend Can't Connect to Backend**
   - Verify `VITE_API_URL` points to the correct backend URL
   - Check CORS configuration in backend
   - Ensure backend service is healthy

3. **Build Failures**
   - Check build logs in Railway dashboard
   - Verify all dependencies are properly installed
   - Ensure Node.js version compatibility

4. **Health Check Failures**
   - Verify health check endpoint is accessible
   - Check service logs for errors
   - Ensure all required environment variables are set

### Debug Commands

You can run these commands in Railway's console:

```bash
# Check environment variables
env

# Test database connection
npm run db:migrate

# Check service health
curl http://localhost:$PORT/api/health
```

## Security Considerations

1. **Environment Variables**
   - Never commit sensitive data to version control
   - Use Railway's environment variable management
   - Rotate API keys regularly

2. **CORS Configuration**
   - Set `CORS_ORIGIN` to your actual frontend URLs
   - Avoid using wildcards in production

3. **JWT Secret**
   - Use a strong, random JWT secret
   - Consider using Railway's secret management

## Scaling

Railway automatically handles scaling based on traffic. You can also manually adjust:

- Number of replicas
- Resource allocation
- Restart policies

## Updates

To update your deployment:

1. Push changes to your GitHub repository
2. Railway will automatically detect changes
3. Services will be rebuilt and redeployed
4. Monitor deployment logs for any issues

## Support

For Railway-specific issues:
- Check Railway documentation
- Contact Railway support
- Review Railway community forums

For application-specific issues:
- Check application logs
- Review this deployment guide
- Consult the main project documentation
