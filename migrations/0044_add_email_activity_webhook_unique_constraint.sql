-- Add unique constraint on webhookId and tenantId to email_activity table for idempotency
-- This prevents duplicate email activity entries from webhook retries

DO $$ 
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'email_activity_webhook_tenant_unique'
    ) THEN
        -- Add unique constraint on webhookId and tenantId combination
        ALTER TABLE email_activity 
        ADD CONSTRAINT email_activity_webhook_tenant_unique 
        UNIQUE (webhook_id, tenant_id);
        
        RAISE NOTICE 'Added unique constraint email_activity_webhook_tenant_unique';
    ELSE
        RAISE NOTICE 'Constraint email_activity_webhook_tenant_unique already exists';
    END IF;
END $$;

-- Create index for better performance on webhookId lookups
CREATE INDEX IF NOT EXISTS idx_email_activity_webhook_tenant 
ON email_activity (webhook_id, tenant_id);

-- Add comment explaining the purpose
COMMENT ON CONSTRAINT email_activity_webhook_tenant_unique ON email_activity IS 'Ensures idempotency for webhook events by preventing duplicate activity entries with the same webhookId within a tenant';
