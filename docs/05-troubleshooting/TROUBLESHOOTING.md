# Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "Unexpected end of JSON input" Error

**Problem:**
```
Error reading secure data (auth_token): SyntaxError: Unexpected end of JSON input
```

**Solution:**
1. Clear browser localStorage
2. Open browser console and run:
```javascript
localStorage.clear();
```
3. Refresh the page

**What was fixed:**
- Updated storage.ts to automatically clear corrupted data
- The error now self-corrects by removing the bad token

### Issue 2: Backend Connection Refused

**Problem:**
```
GET http://localhost:3001/api/models net::ERR_CONNECTION_REFUSED
POST http://localhost:3001/api/auth/login net::ERR_CONNECTION_REFUSED
```

**Solution:**

1. **Check if backend is running:**
```bash
# Check if backend is running on port 3001
curl http://localhost:3001/api/health
```

2. **Start the backend:**
```bash
# From the root directory
npm run dev:backend

# OR from backend directory
cd services/backend
npm run dev
```

3. **Check backend logs:**
You should see:
```
🚀 JoaLLM API server running on port 3001
📚 API Documentation available at http://localhost:3001/docs
🔗 Health check available at http://localhost:3001/api/health
```

4. **Verify environment variables:**
Make sure `.env` file exists in `services/backend/`:
```bash
cd services/backend
cp env.example .env
# Edit .env with your configuration
```

### Issue 3: Database Connection Issues

**Problem:**
Backend cannot connect to PostgreSQL

**Solution:**

1. **Start PostgreSQL:**
```bash
# Using Docker
npm run docker:up

# OR manually
docker-compose up -d postgres
```

2. **Check database connection:**
```bash
# Test connection
psql postgresql://postgres:postgres@localhost:5432/joallm

# Or using Docker
docker exec -it joallm-postgres psql -U postgres -d joallm
```

3. **Run migrations:**
```bash
cd services/backend
npm run db:generate
npm run db:migrate
```

### Issue 4: Redis Connection Issues

**Problem:**
Backend cannot connect to Redis

**Solution:**

1. **Start Redis:**
```bash
npm run docker:up
```

2. **Check Redis connection:**
```bash
# Test Redis
redis-cli -h localhost -p 6379 ping
# Should return: PONG

# Or using Docker
docker exec -it joallm-redis redis-cli ping
```

### Issue 5: Frontend Not Loading Models

**Problem:**
Frontend shows "Failed to fetch models" errors

**Cause:**
Backend is not running or not accessible

**Solution:**

1. Ensure backend is running (see Issue 2)
2. Check CORS configuration in backend
3. Verify API URL in frontend `.env`:
```bash
# services/commercial-frontend/.env
VITE_API_URL=http://localhost:3001
```

4. Check browser console for CORS errors

### Issue 6: Port Already in Use

**Problem:**
```
Error: Port 3001 is already in use
```

**Solution:**

1. **Find and kill the process:**
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

2. **Or change the port:**
Edit `services/backend/.env`:
```
PORT=3002
```

And update frontend `.env`:
```
VITE_API_URL=http://localhost:3002
```

### Issue 7: Authentication Errors

**Problem:**
Login fails or tokens are invalid

**Solution:**

1. **Clear localStorage:**
```javascript
localStorage.clear();
sessionStorage.clear();
```

2. **Check token expiration:**
Tokens expire after 24 hours. Log in again.

3. **Check JWT_SECRET:**
Make sure `JWT_SECRET` is set in backend `.env`

4. **Verify user exists:**
```bash
# If using database directly
psql postgresql://postgres:postgres@localhost:5432/joallm -c "SELECT email, role FROM users;"
```

### Issue 8: Role Assignment Issues

**Problem:**
User doesn't have correct role after changes

**Solution:**

1. **Clear corrupted data** (Issue 1)
2. **Re-register or check user in database:**
```sql
-- Check user roles
SELECT email, role FROM users;

-- Update user role if needed
UPDATE users SET role = 'casual' WHERE email = 'user@example.com';

-- Verify support@joallm.ai has superuser role
SELECT email, role FROM users WHERE email = 'support@joallm.ai';
```

### Issue 9: esbuild Version Mismatch Error

**Problem:**
```
Error [TransformError]: Cannot start service: Host version "0.25.11" does not match binary version "0.19.12"
```

**Cause:**
Cached binary versions of esbuild don't match the installed version (common with tsx/esbuild)

**Solution:**

1. **Clear all caches:**
```bash
rm -rf node_modules/.cache
rm -rf services/backend/node_modules/.cache
rm -rf services/*/node_modules/.cache
```

2. **Reinstall backend dependencies:**
```bash
cd services/backend
rm -rf node_modules dist
npm install
cd ../..
```

3. **Restart the backend:**
```bash
npm run dev:backend
```

**Alternative (if issue persists):**
```bash
# Full clean reinstall
rm -rf node_modules services/*/node_modules
npm install
```

### Issue 10: Build Errors

**Problem:**
`npm run build` fails

**Solution:**

1. **Clean install:**
```bash
rm -rf node_modules package-lock.json
rm -rf services/*/node_modules services/*/package-lock.json
npm install
```

2. **Check Node version:**
```bash
node -v  # Should be >= 18.0.0
```

3. **Build individual services:**
```bash
npm run build:backend
npm run build:commercial
npm run build:landing
```

## Quick Diagnostic Commands

```bash
# Check all services
curl http://localhost:3001/api/health  # Backend
curl http://localhost:5173              # Commercial Frontend
curl http://localhost:5174              # Landing Page

# Check Docker services
docker ps

# Check logs
docker logs joallm-postgres
docker logs joallm-redis

# Check database
psql postgresql://postgres:postgres@localhost:5432/joallm -c "SELECT COUNT(*) FROM users;"

# Check Redis
redis-cli -h localhost -p 6379 ping
```

## Getting More Help

1. Check logs in browser console (F12)
2. Check backend logs in terminal
3. Check `docs/ROLE_CHANGES.md` for role-related issues
4. Check `QUICKSTART.md` for setup instructions
5. Review `TESTING_CHECKLIST.md` for known issues

## Quick Reset

If all else fails, reset everything:

```bash
# Stop all services
docker-compose down
pkill -f "tsx watch"
pkill -f "vite"

# Clean up
rm -rf node_modules services/*/node_modules
rm -rf services/*/dist

# Clear browser storage
# Open browser console and run:
# localStorage.clear();
# sessionStorage.clear();

# Reinstall and start
npm install
npm run setup  # Start Docker services
npm run dev    # Start all services
```
