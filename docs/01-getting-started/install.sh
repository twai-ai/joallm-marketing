#!/bin/bash

# JoaLLM Platform Installation Script

set -e

echo "🚀 Installing JoaLLM Platform..."

# Check Node.js version
echo "📋 Checking prerequisites..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd services/backend
npm install
cd ../..

# Install commercial-frontend dependencies
echo "📦 Installing commercial-frontend dependencies..."
cd services/commercial-frontend
npm install
cd ../..

# Install landing-page dependencies
echo "📦 Installing landing-page dependencies..."
cd services/landing-page
npm install
cd ../..

echo ""
echo "✅ Installation complete!"
echo ""
echo "🎉 Next steps:"
echo "  • Run 'npm run dev' to start all services"
echo "  • Or run individual services:"
echo "    - npm run dev:backend"
echo "    - npm run dev:commercial"
echo "    - npm run dev:landing"
echo ""
echo "📚 Read RESTRUCTURE_SUMMARY.md for more information"
echo ""


