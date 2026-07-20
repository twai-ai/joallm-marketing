#!/bin/bash

echo "🚀 Setting up Railway deployment for JoaLLM Platform..."

# Set backend environment variables
echo "📝 Setting backend environment variables..."
railway variables --set "OPENAI_API_KEY=your-openai-api-key-here" --service backend

railway variables --set "COHERE_API_KEY=your-cohere-api-key-here" --service backend

railway variables --set "GROQ_API_KEY=your-groq-api-key-here" --service backend

railway variables --set "ANTHROPIC_API_KEY=mock-key-anthropic" --service backend

railway variables --set "JWT_SECRET=dev-jwt-secret-change-in-production" --service backend

railway variables --set "JWT_EXPIRES_IN=7d" --service backend

railway variables --set "API_KEY=dev-api-key-change-in-production" --service backend

railway variables --set "NODE_ENV=production" --service backend

railway variables --set "LOG_LEVEL=info" --service backend

railway variables --set "PORT=3001" --service backend

# Get service URLs
echo "🔗 Getting service URLs..."
BACKEND_URL=$(railway domain --service backend 2>/dev/null || echo "https://backend.railway.app")
FRONTEND_URL=$(railway domain --service frontend 2>/dev/null || echo "https://frontend.railway.app")
LANDING_URL=$(railway domain --service landing-page 2>/dev/null || echo "https://landing-page.railway.app")

echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Landing Page URL: $LANDING_URL"

# Set CORS for backend
echo "🌐 Setting CORS for backend..."
railway variables --set "CORS_ORIGIN=$FRONTEND_URL,$LANDING_URL" --service backend

# Set frontend environment variables
echo "📱 Setting frontend environment variables..."
railway variables --set "VITE_API_URL=$BACKEND_URL" --service frontend
railway variables --set "VITE_APP_ENV=production" --service frontend

echo "📱 Setting landing-page environment variables..."
railway variables --set "VITE_API_URL=$BACKEND_URL" --service landing-page
railway variables --set "VITE_APP_ENV=production" --service landing-page

echo "✅ Setup complete!"
echo ""
echo "🌐 Your services are available at:"
echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo "Landing Page: $LANDING_URL"
echo ""
echo "🔍 To check logs:"
echo "railway logs --service backend"
echo "railway logs --service frontend"
echo "railway logs --service landing-page"
echo ""
echo "🔧 To check environment variables:"
echo "railway variables --service backend"
echo "railway variables --service frontend"
echo "railway variables --service landing-page"

