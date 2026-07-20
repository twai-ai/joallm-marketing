#!/bin/bash

# Quick Fix Commands for Deployment Build Error
# Run these commands to fix the Docker build I/O error

echo "🔧 JoaLLM Deployment Fix Script"
echo "================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Current Status:${NC}"
echo "   ❌ Deployment failing with gcc I/O error"
echo "   ✅ Dockerfile has been fixed"
echo "   ✅ Multi-stage Dockerfile.production created"
echo ""

echo -e "${YELLOW}Choose a solution:${NC}"
echo "1. Quick Retry (Recommended first)"
echo "2. Deploy Fixed Dockerfile"
echo "3. Deploy Multi-Stage Dockerfile"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
  1)
    echo -e "${BLUE}🔄 Solution 1: Retrying build...${NC}"
    echo ""
    echo "Creating empty commit to trigger rebuild..."
    git commit --allow-empty -m "chore: retry build after I/O error"
    echo ""
    echo "Pushing to trigger deployment..."
    git push origin main
    echo ""
    echo -e "${GREEN}✅ Rebuild triggered!${NC}"
    echo "Monitor your Railway dashboard for build progress."
    ;;
    
  2)
    echo -e "${BLUE}🔧 Solution 2: Deploying fixed Dockerfile...${NC}"
    echo ""
    echo "Adding updated Dockerfile..."
    git add services/backend/Dockerfile
    echo ""
    echo "Committing changes..."
    git commit -m "fix: Split Docker package installation for reliability

- Split apk add commands for better error isolation
- Add build dependencies as virtual package
- Clean up build dependencies after npm build
- Improves build reliability in cloud environments"
    echo ""
    echo "Pushing changes..."
    git push origin main
    echo ""
    echo -e "${GREEN}✅ Fixed Dockerfile deployed!${NC}"
    echo "Railway will now build with the more reliable configuration."
    ;;
    
  3)
    echo -e "${BLUE}🚀 Solution 3: Deploying multi-stage Dockerfile...${NC}"
    echo ""
    cd services/backend
    echo "Backing up current Dockerfile..."
    cp Dockerfile Dockerfile.single-stage
    echo ""
    echo "Using production multi-stage Dockerfile..."
    cp Dockerfile.production Dockerfile
    cd ../..
    echo ""
    echo "Adding files to git..."
    git add services/backend/Dockerfile services/backend/Dockerfile.single-stage services/backend/Dockerfile.production
    echo ""
    echo "Committing changes..."
    git commit -m "fix: Use multi-stage Docker build for production

- Implement multi-stage build for better reliability
- Separate build and runtime stages
- Reduce final image size
- Improve build caching and performance
- Backup single-stage Dockerfile"
    echo ""
    echo "Pushing changes..."
    git push origin main
    echo ""
    echo -e "${GREEN}✅ Multi-stage Dockerfile deployed!${NC}"
    echo "This is the most robust solution for production deployments."
    ;;
    
  *)
    echo -e "${YELLOW}Invalid choice. Please run the script again.${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}📊 Next Steps:${NC}"
echo "1. Monitor your Railway deployment dashboard"
echo "2. Check build logs for progress"
echo "3. Verify deployment at: /api/health"
echo "4. Test RAG features after successful deployment"
echo ""
echo -e "${GREEN}🎉 Your RAG enhancements are ready to go live!${NC}"
echo ""
echo "📖 For detailed information, see:"
echo "   - DEPLOYMENT_BUILD_ERROR_FIX.md (comprehensive guide)"
echo "   - RAG_IMPROVEMENTS_IMPLEMENTATION.md (RAG features)"
echo ""

