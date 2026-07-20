CREATE TABLE IF NOT EXISTS "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"description" text NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_tokens" integer NOT NULL,
	"cost" text NOT NULL,
	"speed" text NOT NULL,
	"quality" text NOT NULL,
	"is_available" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "models_provider_idx" ON "models" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "models_available_idx" ON "models" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "models_featured_idx" ON "models" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "models_sort_order_idx" ON "models" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "models_capabilities_idx" ON "models" USING gin ("capabilities");