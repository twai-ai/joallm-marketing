-- Migration: Add RAG search sessions and queries tables
-- Created: 2025-10-26
-- Purpose: Enable RAG search session tracking following chat session pattern

-- Create RAG search sessions table
CREATE TABLE IF NOT EXISTS "rag_search_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"short_id" text NOT NULL,
	"title" text,
	"search_type" text DEFAULT 'hybrid' CHECK ("search_type" IN ('vector', 'keyword', 'hybrid')),
	"parameters" jsonb,
	"document_ids" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rag_search_sessions_short_id_unique" UNIQUE("short_id")
);

-- Create RAG search queries table
CREATE TABLE IF NOT EXISTS "rag_search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"query" text NOT NULL,
	"enhanced_query" text,
	"results_count" integer DEFAULT 0,
	"search_time" integer DEFAULT 0,
	"average_score" real,
	"search_type" text CHECK ("search_type" IN ('vector', 'keyword', 'hybrid')),
	"parameters" jsonb,
	"success" boolean DEFAULT true,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "rag_search_sessions" ADD CONSTRAINT "rag_search_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "rag_search_queries" ADD CONSTRAINT "rag_search_queries_session_id_rag_search_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "rag_search_sessions"("id") ON DELETE cascade ON UPDATE no action;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "rag_search_sessions_user_id_idx" ON "rag_search_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "rag_search_sessions_created_at_idx" ON "rag_search_sessions" ("created_at");
CREATE INDEX IF NOT EXISTS "rag_search_sessions_short_id_idx" ON "rag_search_sessions" ("short_id");

CREATE INDEX IF NOT EXISTS "rag_search_queries_session_id_idx" ON "rag_search_queries" ("session_id");
CREATE INDEX IF NOT EXISTS "rag_search_queries_created_at_idx" ON "rag_search_queries" ("created_at");
CREATE INDEX IF NOT EXISTS "rag_search_queries_query_idx" ON "rag_search_queries" ("query");

-- Add comments for documentation
COMMENT ON TABLE "rag_search_sessions" IS 'RAG search sessions for tracking user search activities';
COMMENT ON TABLE "rag_search_queries" IS 'Individual search queries within RAG search sessions';

COMMENT ON COLUMN "rag_search_sessions"."search_type" IS 'Type of search: vector, keyword, or hybrid';
COMMENT ON COLUMN "rag_search_sessions"."parameters" IS 'Search parameters like threshold, weights, etc.';
COMMENT ON COLUMN "rag_search_sessions"."document_ids" IS 'Array of document IDs to search within';

COMMENT ON COLUMN "rag_search_queries"."enhanced_query" IS 'Query after enhancement/rewriting';
COMMENT ON COLUMN "rag_search_queries"."search_time" IS 'Search duration in milliseconds';
COMMENT ON COLUMN "rag_search_queries"."average_score" IS 'Average similarity score of results';
