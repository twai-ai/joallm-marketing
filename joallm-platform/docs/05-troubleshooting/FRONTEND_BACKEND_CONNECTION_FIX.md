# Frontend-Backend Connection Fix for Railway

## Problem Identified
The frontend and landing page services were failing to connect to the backend in Railway deployment because they were using hardcoded `localhost` URLs for API calls.

## Root Causes

### 1. Missing Environment Variables
- **Frontend** and **Landing Page** were using default `VITE_API_URL: 'http://localhost:3001'`
- In Railway production, they need to use the backend's public domain

### 2. CORS Configuration
- Backend's CORS was configured for localhost origins only
- Needed to allow frontend and landing page domains in production

### 3. Build-Time Environment Variables
- Vite bundles environment variables at **build time**, not runtime
- Dockerfiles weren't accepting environment variables during the build stage

## Solutions Applied

### 1. Updated railway.json Configuration

#### Backend Service
Added CORS configuration to allow frontend and landing page origins:
```json
{
  "name": "backend",
  "environment": {
    "NODE_ENV": "production",
    "CORS_ORIGIN": "${{frontend.RAILWAY_PUBLIC_DOMAIN}},${{landing-page.RAILWAY_PUBLIC_DOMAIN}}"
  }
}
```

#### Frontend Service
Added API URL environment variables:
```json
{
  "name": "frontend",
  "environment": {
    "NODE_ENV": "production",
    "VITE_API_URL": "${{backend.RAILWAY_PUBLIC_DOMAIN}}",
    "VITE_API_BASE_URL": "${{backend.RAILWAY_PUBLIC_DOMAIN}}",
    "VITE_APP_ENV": "production"
  }
}
```

#### Landing Page Service
Added API URL environment variables:
```json
{
  "name": "landing-page",
  "environment": {
    "NODE_ENV": "production",
    "VITE_API_URL": "${{backend.RAILWAY_PUBLIC_DOMAIN}}",
    "VITE_APP_ENV": "production"
  }
}
```

### 2. Updated Dockerfiles for Build-Time Variables

#### Frontend Dockerfile
Added ARG and ENV declarations to accept environment variables during build:
```dockerfile
# Accept build arguments for environment variables
ARG VITE_API_URL
ARG VITE_API_BASE_URL
ARG VITE_APP_ENV=production

# Set environment variables for build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_ENV=${VITE_APP_ENV}
```

#### Landing Page Dockerfile
Similar updates for landing page:
```dockerfile
# Accept build arguments for environment variables
ARG VITE_API_URL
ARG VITE_APP_ENV=production

# Set environment variables for build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_ENV=${VITE_APP_ENV}
```

## How It Works

### Railway Variable References
Railway allows services to reference each other using the syntax:
```
${{SERVICE_NAME.RAILWAY_PUBLIC_DOMAIN}}
```

This automatically resolves to the public URL of the service (e.g., `https://backend-production-xxxx.up.railway.app`)

### Build Flow
1. **Railway sets environment variables** from `railway.json` during deployment
2. **Docker build** receives these as ARG parameters
3. **Vite build** embeds the environment variables into the JavaScript bundle
4. **Runtime** - The built application uses the correct backend URL

### CORS Flow
1. **Frontend** sends request to backend with `Origin: https://frontend-production-xxxx.up.railway.app`
2. **Backend** checks CORS configuration from `CORS_ORIGIN` environment variable
3. **Backend** allows the request if the origin is in the allowed list
4. **Response** is sent back to frontend with proper CORS headers

## Files Changed

1. `infrastructure/railway.json` - Added environment variables for all services
2. `services/frontend/Dockerfile` - Added build-time environment variable support
3. `services/landing-page/Dockerfile` - Added build-time environment variable support

## Verification Steps

After deploying these changes to Railway:

1. **Check Backend Logs** - Verify CORS_ORIGIN is set correctly
2. **Check Frontend Logs** - Verify VITE_API_URL is embedded in the build
3. **Test API Calls** - Open browser console and verify requests go to the correct backend URL
4. **Test CORS** - Verify no CORS errors in browser console

## Expected Behavior

### Before Fix
- ❌ Frontend tries to call `http://localhost:3001/api/*`
- ❌ Requests fail with network errors
- ❌ CORS errors if backend was reachable

### After Fix
- ✅ Frontend calls `https://backend-production-xxxx.up.railway.app/api/*`
- ✅ Backend accepts requests from frontend origin
- ✅ All API calls work correctly

## Railway Deployment Notes

### Environment Variable Propagation
Railway automatically:
1. Injects environment variables from `railway.json`
2. Passes them as build args to Docker
3. Makes them available at runtime

### Service References
When using `${{SERVICE_NAME.VARIABLE}}`:
- Railway resolves these **after** all services are created
- Services must be defined in the same `railway.json`
- Use the exact service name (e.g., "backend", "frontend", "landing-page")

### Build Order
Railway builds services in dependency order:
1. **Backend** builds first (no dependencies)
2. **Frontend** builds second (references backend)
3. **Landing Page** builds third (references backend)

## Troubleshooting

### If Frontend Still Can't Connect

1. **Check Railway Environment Variables**
   ```bash
   railway logs backend --tail 50
   # Look for: "CORS Origin: https://..."
   ```

2. **Check Build Logs**
   ```bash
   railway logs frontend --tail 100
   # Look for: "VITE_API_URL: https://..."
   ```

3. **Inspect Built Frontend Code**
   - Open browser DevTools → Sources
   - Search for "localhost:3001"
   - Should find backend Railway domain instead

4. **Test CORS Manually**
   ```bash
   curl -H "Origin: https://frontend-production-xxxx.up.railway.app" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://backend-production-xxxx.up.railway.app/api/health
   ```

### Common Issues

**Issue**: Frontend still uses localhost
- **Cause**: Environment variables not passed during build
- **Fix**: Rebuild with `railway up --detach`

**Issue**: CORS errors in browser
- **Cause**: Backend CORS_ORIGIN not set correctly
- **Fix**: Set CORS_ORIGIN in Railway dashboard manually

**Issue**: 403 Forbidden errors
- **Cause**: JWT/authentication issues, not CORS
- **Fix**: Check JWT_SECRET and authentication flow

## Related Files

### Frontend Configuration
- `services/frontend/src/config/env.ts` - Environment variable validation
- `services/frontend/src/config/api.ts` - API endpoint configuration

### Landing Page Configuration
- `services/landing-page/src/config/env.ts` - Environment variable validation
- `services/landing-page/src/config/api.ts` - API endpoint configuration

### Backend Configuration
- `services/backend/src/config/config.ts` - CORS origin configuration
- `services/backend/src/index.ts` - CORS middleware setup

## Next Steps

1. **Push changes to GitHub**
2. **Railway will auto-deploy** from the main branch
3. **Monitor build logs** for each service
4. **Test the deployed application** to verify connectivity
5. **Check browser console** for any remaining errors

## Success Criteria

✅ Backend deploys successfully  
✅ Frontend builds with correct VITE_API_URL  
✅ Landing page builds with correct VITE_API_URL  
✅ No CORS errors in browser console  
✅ API calls reach the backend  
✅ Authentication and data fetching work correctly  

