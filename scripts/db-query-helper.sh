#!/bin/bash

# JoaLLM Database Query Helper
# Common database queries for quick exploration

function show_help() {
    cat << EOF
JoaLLM Database Query Helper
============================

Usage: ./scripts/db-query-helper.sh [command]

Commands:
  users              List all users
  sessions           List recent chat sessions
  messages           List recent messages
  files              List uploaded files
  chunks             View document chunks statistics
  search             View recent searches
  models             List available models
  queue              Check queue status
  size               Show table sizes
  indexes            Show index information
  vacuum             Run VACUUM ANALYZE
  reindex            Reindex document embeddings
  connect            Connect to PostgreSQL shell
  redis              Connect to Redis CLI
  
  help               Show this help message

Examples:
  ./scripts/db-query-helper.sh users
  ./scripts/db-query-helper.sh files
  ./scripts/db-query-helper.sh connect

EOF
}

DB_EXEC="docker exec joallm-postgres psql -U postgres -d joallm"
REDIS_EXEC="docker exec joallm-redis redis-cli"

case "$1" in
    users)
        echo "👥 Users in Database"
        echo "===================="
        $DB_EXEC -c "SELECT id, email, name, role, subscription_tier, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created FROM users ORDER BY created_at DESC;"
        ;;
    
    sessions)
        echo "💬 Recent Chat Sessions"
        echo "======================="
        $DB_EXEC -c "SELECT short_id, COALESCE(title, 'Untitled') as title, model, auto_title, is_active, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created FROM chat_sessions ORDER BY created_at DESC LIMIT 20;"
        ;;
    
    messages)
        echo "💬 Recent Messages"
        echo "=================="
        $DB_EXEC -c "SELECT cs.short_id as session, m.role, LEFT(m.content, 80) as content, TO_CHAR(m.created_at, 'YYYY-MM-DD HH24:MI') as created FROM messages m JOIN chat_sessions cs ON m.session_id = cs.id ORDER BY m.created_at DESC LIMIT 20;"
        ;;
    
    files)
        echo "📄 Uploaded Files"
        echo "================"
        $DB_EXEC -c "SELECT id, original_name, mimetype, pg_size_pretty(size::bigint) as size, status, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as uploaded FROM files ORDER BY created_at DESC LIMIT 20;"
        ;;
    
    chunks)
        echo "🧩 Document Chunks Statistics"
        echo "============================"
        $DB_EXEC -c "
        SELECT 
            f.original_name,
            COUNT(dc.id) as chunks,
            AVG(LENGTH(dc.content))::integer as avg_size,
            MIN(LENGTH(dc.content)) as min_size,
            MAX(LENGTH(dc.content)) as max_size,
            COUNT(CASE WHEN dc.embedding IS NOT NULL THEN 1 END) as embeddings
        FROM files f
        LEFT JOIN document_chunks dc ON f.id = dc.file_id
        GROUP BY f.id, f.original_name
        ORDER BY f.created_at DESC
        LIMIT 20;"
        ;;
    
    search)
        echo "🔍 Recent Searches"
        echo "=================="
        $DB_EXEC -c "SELECT query, results_count, search_time || 'ms' as duration, ROUND(average_score::numeric, 3) as score, success, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as searched FROM search_history ORDER BY created_at DESC LIMIT 20;"
        ;;
    
    models)
        echo "🤖 Available Models"
        echo "==================="
        COUNT=$($DB_EXEC -t -c "SELECT COUNT(*) FROM models;" | tr -d ' ')
        if [ "$COUNT" = "0" ]; then
            echo "No models in database. Run seed script:"
            echo "  cd services/backend && npm run db:seed-models"
        else
            $DB_EXEC -c "SELECT model_id, name, provider, max_tokens, cost, speed, quality, is_available FROM models ORDER BY provider, sort_order;"
        fi
        ;;
    
    queue)
        echo "📬 Queue Status"
        echo "==============="
        echo ""
        echo "Document Processing Queue:"
        PROC_ID=$($REDIS_EXEC GET bull:document-processing:id 2>/dev/null || echo "0")
        PROC_FAILED=$($REDIS_EXEC ZCARD bull:document-processing:failed 2>/dev/null || echo "0")
        echo "  Current Job ID: $PROC_ID"
        echo "  Failed Jobs: $PROC_FAILED"
        echo ""
        echo "Document Indexing Queue:"
        IDX_ID=$($REDIS_EXEC GET bull:document-indexing:id 2>/dev/null || echo "0")
        IDX_COMPLETED=$($REDIS_EXEC ZCARD bull:document-indexing:completed 2>/dev/null || echo "0")
        IDX_FAILED=$($REDIS_EXEC ZCARD bull:document-indexing:failed 2>/dev/null || echo "0")
        echo "  Current Job ID: $IDX_ID"
        echo "  Completed Jobs: $IDX_COMPLETED"
        echo "  Failed Jobs: $IDX_FAILED"
        ;;
    
    size)
        echo "📊 Table Sizes"
        echo "=============="
        $DB_EXEC -c "
        SELECT 
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total,
            pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table,
            pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
        ;;
    
    indexes)
        echo "📇 Index Information"
        echo "==================="
        $DB_EXEC -c "
        SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan as scans,
            idx_tup_read as tuples_read,
            idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
        LIMIT 20;"
        ;;
    
    vacuum)
        echo "🧹 Running VACUUM ANALYZE..."
        $DB_EXEC -c "VACUUM ANALYZE;"
        echo "✅ Database vacuumed and statistics updated"
        ;;
    
    reindex)
        echo "🔄 Checking for reindex script..."
        if [ -f "services/backend/scripts/reindex-all-documents.ts" ]; then
            echo "Running reindex script..."
            cd services/backend && npm run reindex-documents
        else
            echo "❌ Reindex script not found"
            echo "Expected: services/backend/scripts/reindex-all-documents.ts"
        fi
        ;;
    
    connect)
        echo "🔌 Connecting to PostgreSQL..."
        echo "Database: joallm"
        echo "Type \\q to exit"
        echo ""
        docker exec -it joallm-postgres psql -U postgres -d joallm
        ;;
    
    redis)
        echo "🔌 Connecting to Redis..."
        echo "Type 'exit' to quit"
        echo ""
        docker exec -it joallm-redis redis-cli
        ;;
    
    help|"")
        show_help
        ;;
    
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac




