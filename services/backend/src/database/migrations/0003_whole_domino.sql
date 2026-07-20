CREATE TABLE IF NOT EXISTS "rag_search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"query" text NOT NULL,
	"enhanced_query" text,
	"results_count" integer DEFAULT 0,
	"search_time" integer DEFAULT 0,
	"average_score" real,
	"search_type" text,
	"parameters" jsonb,
	"success" boolean DEFAULT true,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rag_search_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"short_id" text NOT NULL,
	"title" text,
	"search_type" text DEFAULT 'hybrid',
	"parameters" jsonb,
	"document_ids" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rag_search_sessions_short_id_unique" UNIQUE("short_id")
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(1024) USING CASE WHEN embedding IS NULL THEN NULL ELSE embedding::vector(1024) END;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'casual';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rag_search_queries" ADD CONSTRAINT "rag_search_queries_session_id_rag_search_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."rag_search_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rag_search_sessions" ADD CONSTRAINT "rag_search_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_search_queries_session_id_idx" ON "rag_search_queries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_search_queries_created_at_idx" ON "rag_search_queries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_search_queries_query_idx" ON "rag_search_queries" USING btree ("query");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_search_sessions_user_id_idx" ON "rag_search_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_search_sessions_created_at_idx" ON "rag_search_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_search_sessions_short_id_idx" ON "rag_search_sessions" USING btree ("short_id");