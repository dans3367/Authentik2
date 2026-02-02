-- Fix email_activity unique constraint for webhook idempotency
-- 
-- This migration ensures the unique index on (webhook_id, tenant_id) is created correctly
-- to work with Drizzle ORM's onConflictDoNothing() clause.
--
-- The index name MUST match what Drizzle expects: email_activity_webhook_id_tenant_id_unique

DO $$ 
BEGIN
    -- Drop any existing constraint/index with the old names
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'email_activity_webhook_tenant_unique'
    ) THEN
        ALTER TABLE email_activity DROP CONSTRAINT email_activity_webhook_tenant_unique;
        RAISE NOTICE 'Dropped old constraint email_activity_webhook_tenant_unique';
    END IF;
    
    -- Drop old index if it exists
    DROP INDEX IF EXISTS idx_email_activity_webhook_tenant;
    
    -- Drop the partial index if it exists (from earlier migration attempt)
    DROP INDEX IF EXISTS email_activity_webhook_id_tenant_id_unique;
END $$;

-- Create the unique index (NOT a partial index) to work with Drizzle's onConflictDoNothing
-- PostgreSQL allows multiple NULL values in unique indexes, so this is safe
CREATE UNIQUE INDEX email_activity_webhook_id_tenant_id_unique 
ON email_activity (webhook_id, tenant_id);

-- Add comment explaining the purpose
COMMENT ON INDEX email_activity_webhook_id_tenant_id_unique IS 'Unique index for idempotent webhook processing. Used by Drizzle onConflictDoNothing() to prevent duplicate activity entries.';
