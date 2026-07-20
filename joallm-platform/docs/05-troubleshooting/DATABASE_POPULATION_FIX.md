# Database Population Issues - Diagnosis & Solutions

## Issue Summary
Three tables are not being populated:
1. ✅ `rag_search_sessions` & `rag_search_queries` - **FIXED**
2. ⚠️ `models` - **Needs seed data run**
3. ⚠️ `api_usage` - **Not implemented**
4. ⚠️ `vector_extension` - **Needs manual insert**

---

## 1. RAG Search Sessions (FIXED ✅)

### Problem
- Backend code was ready to track sessions
- Frontend wasn't creating sessions or passing `sessionId`

### Solution Applied (Commit `9034537`)
- Added `sessionId` support to landing page `useRAG` hook
- Knowledge Manager now creates RAG search session on mount
- Passes `sessionId` with every search request
- Backend logs queries to `rag_search_queries` table

### Verification
```sql
-- Check sessions
SELECT * FROM rag_search_sessions ORDER BY created_at DESC LIMIT 5;

-- Check queries
SELECT * FROM rag_search_queries ORDER BY created_at DESC LIMIT 10;

-- Check relationships
SELECT 
  s.title, 
  COUNT(q.id) as query_count,
  s.created_at
FROM rag_search_sessions s
LEFT JOIN rag_search_queries q ON q.session_id = s.id
GROUP BY s.id
ORDER BY s.created_at DESC;
```

---

## 2. Models Table (Needs Seed Data ⚠️)

### Problem
- Table exists in schema
- Seed data file exists: `/services/backend/src/database/seed-models.sql`
- **But seed script has never been run**
- `/api/models` endpoint returns empty array

### Solution (Manual Action Required)

#### Option A: Run SQL Seed File
```bash
# Connect to your database and run:
psql $DATABASE_URL -f services/backend/src/database/seed-models.sql
```

#### Option B: Run Setup Script
```bash
cd services/backend
node scripts/setup-models.js
```

#### Option C: Direct SQL Insert
```sql
-- Run the INSERT statements from:
-- /services/backend/src/database/seed-models.sql
-- This will insert all 38 AI models
```

### What Gets Populated
- **38 AI Models** from multiple providers:
  - Groq (Llama 3.3, Llama 4, Mixtral, Gemma)
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic (Claude 3)
  - Ollama (Local models: Llama 2, Mistral, Code Llama, Phi-2)

### Verification
```sql
-- Check models count
SELECT COUNT(*) FROM models;

-- Should return: 38

-- View models by provider
SELECT 
  provider, 
  COUNT(*) as model_count 
FROM models 
GROUP BY provider;

-- View featured models
SELECT model_id, name, provider, is_featured 
FROM models 
WHERE is_featured = true 
ORDER BY sort_order;
```

---

## 3. API Usage Table (Not Implemented ⚠️)

### Problem
- Table schema exists
- **NO code inserts into it**
- LLM providers return usage data but never log it

### Root Cause
The code path is:
1. User makes chat request → `/api/chat/stream`
2. Calls `llmService.generateStreamResponse()`
3. Provider returns `usage` (tokens, costs)
4. Usage saved to `messages.usage` field (JSONB)
5. **Never inserted into `api_usage` table** ❌

### Solution (Requires Code Implementation)

#### Where to Add Tracking
**File**: `/services/backend/src/routes/chat.ts`

**After saving assistant message** (around line 992):
```typescript
// Save assistant message to database
await db.insert(messages).values({
  sessionId: currentSessionId,
  role: 'assistant',
  content: fullContent,
  model,
  usage,
});

// ⭐ ADD THIS: Track API usage
if (usage) {
  await db.insert(apiUsage).values({
    userId: request.user?.id,
    endpoint: '/api/chat/stream',
    method: 'POST',
    model: model,
    tokensUsed: usage.totalTokens,
    cost: calculateCost(model, usage), // Helper function needed
    responseTime: Date.now() - startTime,
    statusCode: 200,
  }).catch(err => {
    logger.warn('Failed to log API usage:', err);
  });
}
```

#### Helper Function Needed
```typescript
// Add to /services/backend/src/utils/cost-calculator.ts
function calculateCost(model: string, usage: any): number {
  // Cost in cents
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 30, output: 60 }, // $0.03/1K in, $0.06/1K out
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    'llama-3.3-70b-versatile': { input: 0.059, output: 0.079 },
    // ... add all models
  };
  
  const modelPricing = pricing[model];
  if (!modelPricing) return 0;
  
  const inputCost = (usage.promptTokens / 1000) * modelPricing.input;
  const outputCost = (usage.completionTokens / 1000) * modelPricing.output;
  
  return Math.round((inputCost + outputCost) * 100); // Convert to cents
}
```

### Impact if Not Fixed
- ❌ No cost tracking per user
- ❌ No API usage analytics
- ❌ Cannot bill users based on usage
- ❌ Cannot monitor spending
- ❌ Cannot detect abuse

### Verification After Fix
```sql
-- Check API usage
SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 10;

-- Cost per user
SELECT 
  u.email,
  COUNT(*) as api_calls,
  SUM(tokens_used) as total_tokens,
  SUM(cost) as total_cost_cents,
  SUM(cost) / 100.0 as total_cost_dollars
FROM api_usage a
JOIN users u ON u.id = a.user_id
GROUP BY u.id, u.email
ORDER BY total_cost_cents DESC;

-- Usage by model
SELECT 
  model,
  COUNT(*) as calls,
  AVG(response_time) as avg_response_ms,
  SUM(tokens_used) as total_tokens
FROM api_usage
GROUP BY model
ORDER BY calls DESC;
```

---

## 4. Vector Extension Table (Simple Fix ⚠️)

### Problem
- Table exists but is empty
- Only needs ONE row to indicate pgvector extension is enabled

### Solution (Simple SQL Insert)
```sql
INSERT INTO vector_extension (id) VALUES ('pgvector')
ON CONFLICT (id) DO NOTHING;
```

### Verification
```sql
SELECT * FROM vector_extension;
-- Should return: { id: 'pgvector' }
```

---

## Priority Actions

### Immediate (Can Do Now)
1. ✅ RAG sessions - Already fixed and pushed
2. ⚠️ **Run models seed script** - Required for model selection to work
3. ⚠️ **Insert vector_extension row** - Simple one-liner

### Code Changes Needed (Requires Development)
4. ⚠️ **Implement API usage tracking** - Requires code changes

---

## SQL Commands to Run Now

```sql
-- 1. Populate models table
\i services/backend/src/database/seed-models.sql

-- 2. Add vector extension marker
INSERT INTO vector_extension (id) VALUES ('pgvector')
ON CONFLICT (id) DO NOTHING;

-- 3. Verify everything
SELECT 'models' as table_name, COUNT(*)::text as row_count FROM models
UNION ALL
SELECT 'vector_extension', COUNT(*)::text FROM vector_extension
UNION ALL
SELECT 'rag_search_sessions', COUNT(*)::text FROM rag_search_sessions
UNION ALL
SELECT 'rag_search_queries', COUNT(*)::text FROM rag_search_queries
UNION ALL
SELECT 'api_usage', COUNT(*)::text FROM api_usage;
```

---

## Next Steps

1. **Immediate**: Run SQL commands above on production database
2. **Short-term**: Implement API usage tracking code
3. **Testing**: Verify all tables populate correctly
4. **Monitoring**: Set up alerts for unusual API usage patterns


