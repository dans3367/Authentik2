-- Add promotions table for managing promotional content templates
-- This table stores reusable promotional content that can be inserted into emails

CREATE TABLE IF NOT EXISTS "promotions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "content" text NOT NULL,
  "type" text NOT NULL DEFAULT 'newsletter' CHECK (type IN ('newsletter', 'survey', 'birthday', 'announcement', 'sale', 'event')),
  "target_audience" text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'subscribers', 'customers', 'prospects', 'vip')),
  "is_active" boolean DEFAULT true,
  "usage_count" integer DEFAULT 0,
  "metadata" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "promotions_tenant_id_idx" ON "promotions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "promotions_user_id_idx" ON "promotions" ("user_id");
CREATE INDEX IF NOT EXISTS "promotions_type_idx" ON "promotions" ("type");
CREATE INDEX IF NOT EXISTS "promotions_is_active_idx" ON "promotions" ("is_active");
CREATE INDEX IF NOT EXISTS "promotions_created_at_idx" ON "promotions" ("created_at");

-- Add RLS (Row Level Security) policies for multi-tenant data isolation
ALTER TABLE "promotions" ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see only promotions from their own tenant
CREATE POLICY "promotions_tenant_isolation" ON "promotions"
  FOR ALL USING ("tenant_id" = current_setting('app.current_tenant')::varchar);
