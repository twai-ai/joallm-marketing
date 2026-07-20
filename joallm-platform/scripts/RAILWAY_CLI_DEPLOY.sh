#!/bin/bash

# Railway CLI Deployment Script for Frontend
# This script will deploy the frontend with a fresh build

echo "🚀 JoaLLM Frontend Deployment via Railway CLI"
echo "=============================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found!"
    echo ""
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
    echo ""
    echo "✅ Railway CLI installed!"
    echo ""
fi

# Check Railway CLI version
echo "📦 Railway CLI version:"
railway --version
echo ""

# Navigate to project root
cd "$(dirname "$0")"

# Check if project is linked
echo "🔗 Checking Railway project link..."
if railway status 2>&1 | grep -q "not linked"; then
    echo "⚠️  Project not linked to Railway"
    echo ""
    echo "Please run: railway link"
    echo "Or: railway login && railway link"
    exit 1
fi

echo "✅ Project linked to Railway"
echo ""

# Show current status
echo "📊 Current Railway status:"
railway status --service frontend
echo ""

# Ask for confirmation
echo "⚠️  This will deploy the frontend service"
echo "📝 Latest commit: $(git log -1 --oneline)"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🚀 Deploying frontend service..."
echo "================================"
echo ""

# Deploy frontend service
railway up --service frontend

echo ""
echo "✅ Deployment command sent!"
echo ""
echo "📊 Monitor deployment:"
echo "  1. Run: railway logs --service frontend"
echo "  2. Or visit: https://railway.app/dashboard"
echo ""
echo "⏱️  Deployment usually takes 5-10 minutes"
echo ""
echo "🎯 After deployment completes:"
echo "  1. Go to: https://platform.joallm.ai"
echo "  2. Hard refresh: Ctrl + Shift + R"
echo "  3. Open Knowledge Manager tab"
echo "  4. ✨ See new features!"
echo ""
echo "🎉 Done!"



