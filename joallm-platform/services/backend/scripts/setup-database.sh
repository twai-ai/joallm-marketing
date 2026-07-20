#!/bin/bash

# JoaLLM Database Setup Script
# This script manually sets up the database tables and seeds data

set -e  # Exit on any error

echo "🗄️ Setting up JoaLLM Database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set!"
    echo "Please set DATABASE_URL in your environment variables."
    exit 1
fi

echo "✅ DATABASE_URL is set"

# Run database migration
echo "🔄 Running database migration..."
if npm run db:migrate; then
    echo "✅ Database migration completed successfully"
else
    echo "❌ Database migration failed"
    exit 1
fi

# Setup models (seed the database)
echo "🌱 Setting up models..."
if npm run setup:models; then
    echo "✅ Models setup completed successfully"
else
    echo "❌ Models setup failed"
    exit 1
fi

echo "🎉 Database setup completed successfully!"
echo "You can now start the application with: npm start"
