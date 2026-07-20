# Quick Start Guide

## Installation Issues Fixed ✅

The dependency installation issue has been resolved. Here's what was fixed and how to proceed.

## Problem Solved

The error was caused by corrupted `node_modules` due to workspace symlinks. This has been fixed by:
1. Removing all node_modules and package-lock files
2. Reinstalling dependencies fresh

## Environment Setup

Before running the services, you need to set up environment variables.

### Backend Setup

1. Copy the environment template:
```bash
cd services/backend
cp env.example .env
```

2. Edit `.env` with your configuration:
```bash
# Required variables
DATABASE_URL=postgresql://user:password@localhost:5432/joallm
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
PORT=3001

# LLM API Keys (at least one is required)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GROQ_API_KEY=your-groq-key
COHERE_API_KEY=your-cohere-key
```

3. Start the database and Redis:
```bash
# Using Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15
docker run -d -p 6379:6379 redis:7
```

### Frontend Setup

1. For commercial-frontend and landing-page:
```bash
cd services/commercial-frontend
# Create .env if needed
echo "VITE_API_URL=http://localhost:3001" > .env

cd ../landing-page
echo "VITE_API_URL=http://localhost:3001" > .env
```

## Running Services

### Option 1: Run All Services (Recommended for testing)
```bash
npm run dev
```

### Option 2: Run Individual Services

Backend only:
```bash
npm run dev:backend
```

Commercial frontend only:
```bash
npm run dev:commercial
```

Landing page only:
```bash
npm run dev:landing
```

## Service URLs

Once running:
- Backend API: http://localhost:3001
- Commercial Frontend: http://localhost:5173
- Landing Page: http://localhost:5174

## Database Setup

Initialize the database:
```bash
cd services/backend
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
```

## Troubleshooting

### Issue: "Cannot find module" errors
**Solution**: Run `npm install` again from the root directory

### Issue: Database connection errors
**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correct

### Issue: Redis connection errors
**Solution**: Ensure Redis is running and REDIS_URL is correct

### Issue: API key errors
**Solution**: Ensure at least one LLM API key is configured in backend .env

### Issue: Port already in use
**Solution**: Kill the process using the port or change the PORT in .env

## Next Steps

1. Set up environment variables (see above)
2. Start database and Redis
3. Run database migrations
4. Start the services with `npm run dev`
5. Open http://localhost:5173 for the commercial frontend
6. Open http://localhost:5174 for the landing page

## Additional Resources

- [Backend Documentation](./docs/BACKEND_README.md)
- [Environment Setup Guide](./docs/BACKEND_ENVIRONMENT_SETUP.md)
- [Restructure Summary](./docs/RESTRUCTURE_SUMMARY.md)

## Need Help?

If you encounter issues:
1. Check the error messages
2. Verify environment variables are set
3. Ensure database and Redis are running
4. Try reinstalling dependencies: `rm -rf node_modules && npm install`
