# Patch Package Build Fix

## Problem
Railway deployment was failing with the error:
```
npm error command sh -c patch-package
npm error sh: patch-package: not found
```

This occurred because some packages (particularly `rollup`) have postinstall scripts that try to run `patch-package`, but it wasn't available during the npm install phase.

## Solution Attempts

### ❌ Attempt 1: Using --ignore-scripts
Initially tried to use `--ignore-scripts` during install then `npm rebuild`, but this didn't work because `npm rebuild` also triggered the postinstall scripts.

### ✅ Final Solution: Install patch-package globally
Install `patch-package` globally before running npm install:

```dockerfile
# Install patch-package globally to fix rollup postinstall script
RUN npm install -g patch-package

# Install dependencies
RUN npm install --legacy-peer-deps
```

### Files Changed
1. `services/backend/Dockerfile`
2. `services/frontend/Dockerfile`
3. `services/landing-page/Dockerfile`

## How It Works
- `--ignore-scripts`: Skips all lifecycle scripts (preinstall, install, postinstall, etc.) during package installation
- `npm rebuild`: Rebuilds native modules and runs necessary scripts after all packages are installed
- This approach ensures all dependencies are present before any postinstall scripts run

## Result
✅ Builds complete successfully on Railway
✅ All services deploy without dependency errors
✅ No need to add `patch-package` as a dependency

## Testing
Test the build locally with Docker:
```bash
# Backend
cd services/backend
docker build -t backend-test .

# Frontend
cd services/frontend
docker build -t frontend-test .

# Landing Page
cd services/landing-page
docker build -t landing-test .
```

## Date
November 7, 2025

