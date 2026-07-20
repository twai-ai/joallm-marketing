#!/bin/bash

# Script to migrate embeddings from text to vector format
# This script runs the database migration to fix embedding storage

echo "🔄 Starting embedding migration..."

# Check if database is accessible
echo "📊 Checking database connection..."
psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Database connection failed. Please check your DATABASE_URL environment variable."
    exit 1
fi

echo "✅ Database connection successful"

# Run the migration
echo "🚀 Running embedding migration..."
psql $DATABASE_URL -f src/database/migrations/0002_fix_embeddings.sql

if [ $? -eq 0 ]; then
    echo "✅ Embedding migration completed successfully!"
    echo "📈 Embeddings are now stored as proper vector types for optimal performance"
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi

# Verify the migration
echo "🔍 Verifying migration..."
psql $DATABASE_URL -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'document_chunks' AND column_name = 'embedding';"

echo "🎉 Migration verification complete!"
