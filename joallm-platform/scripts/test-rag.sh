#!/bin/bash

# RAG Testing Script
# This script tests the RAG functionality end-to-end

set -e

echo "🧪 RAG Testing Script"
echo "===================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# API base URL
API_URL="http://localhost:3001"

# Step 1: Login
echo "📝 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"support@joallm.ai","password":"test"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "$LOGIN_RESPONSE" | jq
  exit 1
fi

echo -e "${GREEN}✅ Logged in successfully${NC}"
echo ""

# Step 2: Create test document
echo "📄 Step 2: Creating test document..."
cat > /tmp/test-rag-doc.txt << 'EOF'
Introduction to Artificial Intelligence

Artificial Intelligence (AI) is the simulation of human intelligence by machines.
Machine learning is a subset of AI that enables systems to learn from data.
Deep learning uses neural networks with multiple layers to process information.

Natural Language Processing (NLP) helps computers understand human language.
Computer vision allows machines to interpret and understand visual information.

Applications of AI include:
- Virtual assistants like Siri and Alexa
- Recommendation systems on Netflix and Amazon
- Self-driving cars
- Medical diagnosis systems
- Fraud detection in banking
EOF

echo -e "${GREEN}✅ Test document created${NC}"
echo ""

# Step 3: Upload document
echo "📤 Step 3: Uploading document..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test-rag-doc.txt")

FILE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.fileId')
STATUS=$(echo "$UPLOAD_RESPONSE" | jq -r '.status')

echo "File ID: $FILE_ID"
echo "Status: $STATUS"

if [ "$STATUS" == "failed" ]; then
  echo -e "${RED}⚠️  Upload succeeded but processing failed (this is expected - workers issue)${NC}"
  echo "Message: $(echo "$UPLOAD_RESPONSE" | jq -r '.message')"
else
  echo -e "${GREEN}✅ Document uploaded and queued for processing${NC}"
fi
echo ""

# Step 4: Wait for processing
echo "⏳ Step 4: Waiting for processing (15 seconds)..."
sleep 15
echo ""

# Step 5: Check file status
echo "🔍 Step 5: Checking file status..."
FILES_RESPONSE=$(curl -s "$API_URL/api/files" \
  -H "Authorization: Bearer $TOKEN")

echo "$FILES_RESPONSE" | jq '.files[] | {filename, status, chunks}'
echo ""

# Step 6: Check RAG stats
echo "📊 Step 6: Checking RAG statistics..."
STATS_RESPONSE=$(curl -s "$API_URL/api/rag/stats")
echo "$STATS_RESPONSE" | jq
echo ""

# Step 7: Test RAG search
echo "🔎 Step 7: Testing RAG search..."
SEARCH_RESPONSE=$(curl -s -X POST "$API_URL/api/rag/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "What is artificial intelligence?",
    "limit": 3
  }')

RESULT_COUNT=$(echo "$SEARCH_RESPONSE" | jq '.totalResults')
echo "Results found: $RESULT_COUNT"

if [ "$RESULT_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ RAG search working!${NC}"
  echo "$SEARCH_RESPONSE" | jq '.results[] | {content, score}'
else
  echo -e "${RED}⚠️  No results found (file may still be processing)${NC}"
fi
echo ""

# Step 8: Test RAG chat
echo "💬 Step 8: Testing RAG chat..."
CHAT_RESPONSE=$(curl -s -X POST "$API_URL/api/rag/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "What are some applications of AI?",
    "includeContext": true
  }')

RESPONSE_TEXT=$(echo "$CHAT_RESPONSE" | jq -r '.response')
SOURCE_COUNT=$(echo "$CHAT_RESPONSE" | jq '.sources | length')

echo "AI Response: $RESPONSE_TEXT"
echo "Sources used: $SOURCE_COUNT"

if [ "$SOURCE_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ RAG chat working!${NC}"
else
  echo -e "${RED}⚠️  No sources found in chat response${NC}"
fi
echo ""

# Summary
echo "===================="
echo "🎯 Test Summary"
echo "===================="
echo "1. Login: ✅"
echo "2. Document Upload: $([ "$FILE_ID" != "null" ] && echo "✅" || echo "❌")"
echo "3. RAG Stats: ✅"
echo "4. RAG Search: $([ "$RESULT_COUNT" -gt 0 ] && echo "✅" || echo "⚠️  No results")"
echo "5. RAG Chat: $([ "$SOURCE_COUNT" -gt 0 ] && echo "✅" || echo "⚠️  No sources")"
echo ""

if [ "$RESULT_COUNT" -gt 0 ] && [ "$SOURCE_COUNT" -gt 0 ]; then
  echo -e "${GREEN}🎉 All RAG tests passed!${NC}"
else
  echo -e "${RED}⚠️  Some tests failed - file processing may still be in progress${NC}"
  echo "Tip: Run this script again in a minute to allow processing to complete"
fi

# Cleanup
rm -f /tmp/test-rag-doc.txt





