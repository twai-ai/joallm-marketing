#!/bin/bash

# JoaLLM Backend Startup Script
# This script ensures proper database setup before starting the application

set -e  # Exit on any error

echo "🚀 Starting JoaLLM Backend..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set!"
    echo "Please set DATABASE_URL in your environment variables."
    exit 1
fi

echo "✅ DATABASE_URL is set"

# Wait for database to be ready (with retries)
echo "⏳ Waiting for database to be ready..."
for i in {1..30}; do
    if npm run db:migrate 2>/dev/null; then
        echo "✅ Database migration completed successfully"
        break
    else
        echo "⏳ Attempt $i/30: Database not ready yet, waiting 2 seconds..."
        sleep 2
    fi
    
    if [ $i -eq 30 ]; then
        echo "❌ ERROR: Database migration failed after 30 attempts"
        echo "Please check your DATABASE_URL and ensure PostgreSQL is running"
        exit 1
    fi
done

# Setup models (seed the database)
echo "🌱 Setting up models..."
if npm run setup:models; then
    echo "✅ Models setup completed successfully"
else
    echo "⚠️ WARNING: Models setup failed, but continuing..."
fi

# Start the application
echo "🎯 Starting the application..."
exec npm start
