-- Activity Logs Table for tracking all user actions in the platform
-- This table supports flexible entity types and activity types for extensibility

CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "better_auth_user"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" varchar,
  "entity_name" text,
  "activity_type" text NOT NULL,
  "description" text,
  "changes" text,
  "metadata" text,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now()
);

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS "activity_logs_tenant_id_idx" ON "activity_logs"("tenant_id");

-- Composite index for fetching activities by entity
CREATE INDEX IF NOT EXISTS "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS "activity_logs_created_at_idx" ON "activity_logs"("created_at" DESC);

-- Index for user-specific activity queries
CREATE INDEX IF NOT EXISTS "activity_logs_user_id_idx" ON "activity_logs"("user_id");
