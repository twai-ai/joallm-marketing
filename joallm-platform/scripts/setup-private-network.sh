#!/bin/bash

echo "🔒 Setting up Railway private network configuration..."

# Get private service URLs
echo "📡 Getting private service URLs..."
BACKEND_PRIVATE_URL="https://backend.railway.internal"
COMMERCIAL_PRIVATE_URL="https://commercial-frontend.railway.internal"
LANDING_PRIVATE_URL="https://landing-page.railway.internal"

echo "Backend Private URL: $BACKEND_PRIVATE_URL"
echo "Commercial Frontend Private URL: $COMMERCIAL_PRIVATE_URL"
echo "Landing Page Private URL: $LANDING_PRIVATE_URL"

# Update frontend services to use private backend URL
echo "🔗 Updating frontend services to use private backend URL..."
railway variables --set "VITE_API_URL=$BACKEND_PRIVATE_URL" --service commercial-frontend
railway variables --set "VITE_API_URL=$BACKEND_PRIVATE_URL" --service landing-page

# Update CORS to use private URLs
echo "🌐 Updating CORS configuration for private network..."
railway variables --set "CORS_ORIGIN=$COMMERCIAL_PRIVATE_URL,$LANDING_PRIVATE_URL" --service backend

# Set up database connections (you'll need to add these manually in Railway dashboard)
echo "🗄️ Database setup required:"
echo "1. Go to Railway dashboard: https://railway.app"
echo "2. Open your project: positive-recreation"
echo "3. Click 'New' -> 'Database' -> 'PostgreSQL'"
echo "4. Click 'New' -> 'Database' -> 'Redis'"
echo "5. Copy the DATABASE_URL and REDIS_URL from the database services"
echo "6. Set them for the backend service:"
echo "   railway variables --set 'DATABASE_URL=<postgres-url>' --service backend"
echo "   railway variables --set 'REDIS_URL=<redis-url>' --service backend"

echo ""
echo "✅ Private network configuration complete!"
echo ""
echo "🌐 Your services are now configured for private communication:"
echo "Backend: $BACKEND_PRIVATE_URL"
echo "Commercial Frontend: $COMMERCIAL_PRIVATE_URL"
echo "Landing Page: $LANDING_PRIVATE_URL"
echo ""
echo "🔍 To verify configuration:"
echo "railway variables --service backend | grep CORS_ORIGIN"
echo "railway variables --service commercial-frontend | grep VITE_API_URL"
echo "railway variables --service landing-page | grep VITE_API_URL"

