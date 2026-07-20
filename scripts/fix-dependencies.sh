#!/bin/bash

# Fix Dependencies Script for JoaLLM Platform
# This script fixes common dependency issues and installs packages correctly

set -e

echo "🔧 Fixing JoaLLM Platform Dependencies..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the JoaLLM platform root directory"
    exit 1
fi

print_status "Starting dependency fixes..."

# 1. Fix @fastify/proxy issue in api-gateway
print_status "Fixing @fastify/proxy dependency in api-gateway..."
if [ -f "services/api-gateway/package.json" ]; then
    # The package.json has already been fixed, but let's verify
    if grep -q "@fastify/proxy" "services/api-gateway/package.json"; then
        print_warning "Found @fastify/proxy in api-gateway package.json - this should be @fastify/http-proxy"
        sed -i.bak 's/@fastify\/proxy/@fastify\/http-proxy/g' "services/api-gateway/package.json"
        print_status "Fixed @fastify/proxy to @fastify/http-proxy"
    else
        print_status "api-gateway package.json is already correct"
    fi
fi

# 2. Install shared package dependencies
print_status "Installing shared package dependencies..."
if [ -d "shared" ]; then
    cd shared
    if [ -f "package.json" ]; then
        print_status "Installing shared dependencies..."
        npm install
        print_status "Building shared package..."
        npm run build
    else
        print_warning "No package.json found in shared directory"
    fi
    cd ..
fi

# 3. Install service dependencies
print_status "Installing service dependencies..."

# API Gateway
if [ -d "services/api-gateway" ]; then
    print_status "Installing api-gateway dependencies..."
    cd services/api-gateway
    npm install
    cd ../..
fi

# Auth Service
if [ -d "services/auth-service" ]; then
    print_status "Installing auth-service dependencies..."
    cd services/auth-service
    npm install
    cd ../..
fi

# Chat Service
if [ -d "services/chat-service" ]; then
    print_status "Installing chat-service dependencies..."
    cd services/chat-service
    npm install
    cd ../..
fi

# Backend Service
if [ -d "services/backend" ]; then
    print_status "Installing backend dependencies..."
    cd services/backend
    npm install
    cd ../..
fi

# Frontend Service
if [ -d "services/frontend" ]; then
    print_status "Installing frontend dependencies..."
    cd services/frontend
    npm install
    cd ../..
fi

# Landing Page Service
if [ -d "services/landing-page" ]; then
    print_status "Installing landing-page dependencies..."
    cd services/landing-page
    npm install
    cd ../..
fi

# 4. Install root dependencies
print_status "Installing root dependencies..."
npm install

# 5. Verify installations
print_status "Verifying installations..."

# Check if @fastify/http-proxy is properly installed
if [ -d "services/api-gateway/node_modules/@fastify/http-proxy" ]; then
    print_status "✅ @fastify/http-proxy is properly installed"
else
    print_error "❌ @fastify/http-proxy installation failed"
fi

# Check if shared package is built
if [ -d "shared/dist" ]; then
    print_status "✅ Shared package is built"
else
    print_warning "⚠️  Shared package not built - run 'cd shared && npm run build'"
fi

# 6. Create symlinks for shared package (if needed)
print_status "Setting up shared package symlinks..."

# This is a workaround for local development
for service in api-gateway auth-service chat-service backend; do
    if [ -d "services/$service" ]; then
        cd "services/$service"
        if [ ! -d "node_modules/@joallm" ]; then
            mkdir -p node_modules/@joallm
            ln -sf ../../../shared node_modules/@joallm/shared 2>/dev/null || true
            print_status "Created symlink for $service"
        fi
        cd ../..
    fi
done

print_status "🎉 Dependency fixes completed!"
print_status ""
print_status "Next steps:"
print_status "1. Run 'docker-compose up' to start the services"
print_status "2. Or run individual services with 'npm run dev' in each service directory"
print_status "3. Check the logs if you encounter any issues"
print_status ""
print_status "If you still have issues, try:"
print_status "- Delete node_modules and package-lock.json in problematic directories"
print_status "- Run 'npm install' again"
print_status "- Check the specific error messages"




