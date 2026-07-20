#!/bin/bash

# Google OAuth Secret Update Script
echo "🔐 Google OAuth Secret Update"
echo "=============================="
echo ""

# Check if backend .env exists
if [ ! -f "services/backend/.env" ]; then
    echo "❌ Backend .env file not found!"
    echo "Creating one..."
    touch services/backend/.env
fi

echo "📝 Current Google OAuth configuration:"
echo "--------------------------------------"
grep -E "GOOGLE_" services/backend/.env || echo "No Google OAuth config found"

echo ""
echo "🔧 To fix the OAuth error:"
echo "1. Get your Google Client Secret from Google Cloud Console"
echo "2. Run: ./update-google-secret.sh YOUR_SECRET_HERE"
echo "3. Restart the backend: cd services/backend && npm run dev"
echo ""

# If secret provided as argument, update it
if [ ! -z "$1" ]; then
    echo "🔄 Updating Google Client Secret..."
    
    # Remove existing GOOGLE_CLIENT_SECRET line
    sed -i '' '/GOOGLE_CLIENT_SECRET=/d' services/backend/.env
    
    # Add new secret
    echo "GOOGLE_CLIENT_SECRET=$1" >> services/backend/.env
    
    echo "✅ Updated Google Client Secret"
    echo "🔄 Please restart the backend: cd services/backend && npm run dev"
else
    echo "💡 Usage: ./update-google-secret.sh YOUR_GOOGLE_CLIENT_SECRET"
    echo "   Example: ./update-google-secret.sh GOCSPX-abc123def456"
fi





