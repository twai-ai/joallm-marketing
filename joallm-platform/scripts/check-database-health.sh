#!/bin/bash

# JoaLLM Database Health Check Script
# Run this to quickly check database status

set -e

echo "🔍 JoaLLM Database Health Check"
echo "================================"
echo ""

# Check if Docker containers are running
echo "📦 Container Status:"
echo "-------------------"
docker ps --filter "name=joallm-postgres" --format "PostgreSQL: {{.Status}}" || echo "❌ PostgreSQL container not running"
docker ps --filter "name=joallm-redis" --format "Redis: {{.Status}}" || echo "❌ Redis container not running"
echo ""

# Check PostgreSQL connection
echo "🗄️  PostgreSQL Status:"
echo "---------------------"
if docker exec joallm-postgres pg_isready -U postgres &>/dev/null; then
    echo "✅ PostgreSQL is ready"
    
    # Get database size
    DB_SIZE=$(docker exec joallm-postgres psql -U postgres -d joallm -t -c "SELECT pg_size_pretty(pg_database_size('joallm'));")
    echo "📊 Database Size: $DB_SIZE"
    
    # Get row counts
    echo ""
    echo "📋 Table Row Counts:"
    docker exec joallm-postgres psql -U postgres -d joallm -t -c "
    SELECT 
      RPAD(relname::text, 25) || ' ' || LPAD(n_live_tup::text, 6) || ' rows'
    FROM pg_stat_user_tables
    WHERE n_live_tup > 0
    ORDER BY n_live_tup DESC;" | grep -v "^$"
    
    # Check for vector extension
    echo ""
    echo "🔌 Extensions:"
    docker exec joallm-postgres psql -U postgres -d joallm -t -c "
    SELECT '  ' || name || ' v' || installed_version
    FROM pg_available_extensions
    WHERE installed_version IS NOT NULL AND name IN ('vector', 'plpgsql');"
    
else
    echo "❌ PostgreSQL is not ready"
fi

echo ""

# Check Redis status
echo "💾 Redis Status:"
echo "---------------"
if docker exec joallm-redis redis-cli ping &>/dev/null; then
    echo "✅ Redis is ready"
    
    # Get Redis info
    REDIS_KEYS=$(docker exec joallm-redis redis-cli INFO keyspace | grep "keys=" | sed 's/.*keys=\([0-9]*\).*/\1/')
    if [ ! -z "$REDIS_KEYS" ]; then
        echo "🔑 Keys in database: $REDIS_KEYS"
    else
        echo "🔑 Keys in database: 0"
    fi
    
    # Check queue status
    echo ""
    echo "📬 Queue Status:"
    PROCESSING_ID=$(docker exec joallm-redis redis-cli GET bull:document-processing:id 2>/dev/null || echo "0")
    INDEXING_ID=$(docker exec joallm-redis redis-cli GET bull:document-indexing:id 2>/dev/null || echo "0")
    FAILED_COUNT=$(docker exec joallm-redis redis-cli ZCARD bull:document-processing:failed 2>/dev/null || echo "0")
    COMPLETED_COUNT=$(docker exec joallm-redis redis-cli ZCARD bull:document-indexing:completed 2>/dev/null || echo "0")
    
    echo "  Document Processing: Job #$PROCESSING_ID"
    echo "  Document Indexing: Job #$INDEXING_ID"
    echo "  Failed Jobs: $FAILED_COUNT"
    echo "  Completed Jobs: $COMPLETED_COUNT"
else
    echo "❌ Redis is not ready"
fi

echo ""

# Check for issues
echo "⚠️  Known Issues:"
echo "----------------"
CHUNK_ISSUE=$(docker exec joallm-postgres psql -U postgres -d joallm -t -c "
SELECT COUNT(*) FROM document_chunks WHERE LENGTH(content) < 50;" 2>/dev/null || echo "0")

if [ "$CHUNK_ISSUE" -gt "0" ]; then
    echo "  ⚠️  $CHUNK_ISSUE document chunks with suspiciously small content"
    echo "     Consider re-running document indexing"
fi

FILES_NO_USER=$(docker exec joallm-postgres psql -U postgres -d joallm -t -c "
SELECT COUNT(*) FROM files WHERE user_id IS NULL;" 2>/dev/null || echo "0")

if [ "$FILES_NO_USER" -gt "0" ]; then
    echo "  ⚠️  $FILES_NO_USER files without user association"
fi

EMPTY_MODELS=$(docker exec joallm-postgres psql -U postgres -d joallm -t -c "
SELECT COUNT(*) FROM models;" 2>/dev/null || echo "0")

if [ "$EMPTY_MODELS" = "0" ] || [ -z "$EMPTY_MODELS" ]; then
    echo "  ℹ️  Models table is empty - consider running seed script"
fi

echo ""
echo "✅ Health check complete!"
echo ""
echo "For detailed exploration, see: DATABASE_EXPLORATION.md"

