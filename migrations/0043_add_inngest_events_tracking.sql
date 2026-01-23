-- Create inngest_events tracking table for recording all events sent to Inngest
-- This allows rebuilding pending transactions if Inngest server goes offline
CREATE TABLE IF NOT EXISTS inngest_events (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Event identification
    event_name TEXT NOT NULL, -- e.g., 'email/send', 'reminder/send', 'newsletter/send'
    event_id TEXT, -- Inngest's returned event ID after successful send
    idempotency_key TEXT UNIQUE, -- Optional key to prevent duplicate sends
    
    -- Event payload
    event_data TEXT NOT NULL, -- JSON payload sent to Inngest
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'processing', 'completed', 'failed', 'cancelled'
    
    -- Retry tracking
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    
    -- Scheduling
    scheduled_for TIMESTAMP, -- If event is scheduled for future execution
    
    -- Result tracking
    result TEXT, -- JSON result from Inngest function execution
    error_message TEXT, -- Error message if failed
    
    -- Related records (optional, for easier querying)
    related_type TEXT, -- 'appointment_reminder', 'newsletter', 'email', 'bulk_email'
    related_id VARCHAR, -- ID of the related record
    
    -- Timestamps
    sent_at TIMESTAMP, -- When event was successfully sent to Inngest
    completed_at TIMESTAMP, -- When Inngest function completed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inngest_events_tenant_id ON inngest_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inngest_events_event_name ON inngest_events(event_name);
CREATE INDEX IF NOT EXISTS idx_inngest_events_event_id ON inngest_events(event_id);
CREATE INDEX IF NOT EXISTS idx_inngest_events_status ON inngest_events(status);
CREATE INDEX IF NOT EXISTS idx_inngest_events_idempotency_key ON inngest_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_inngest_events_scheduled_for ON inngest_events(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_inngest_events_related ON inngest_events(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_inngest_events_created_at ON inngest_events(created_at);
CREATE INDEX IF NOT EXISTS idx_inngest_events_pending ON inngest_events(status) WHERE status IN ('pending', 'sent', 'processing');

-- Add constraint to ensure status is valid
ALTER TABLE inngest_events 
ADD CONSTRAINT check_inngest_event_status 
CHECK (status IN ('pending', 'sent', 'processing', 'completed', 'failed', 'cancelled'));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inngest_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function
CREATE TRIGGER update_inngest_events_updated_at
    BEFORE UPDATE ON inngest_events
    FOR EACH ROW
    EXECUTE FUNCTION update_inngest_events_updated_at();

-- Comment on table
COMMENT ON TABLE inngest_events IS 'Tracks all events sent to Inngest for recovery and auditing purposes';
COMMENT ON COLUMN inngest_events.status IS 'pending=not yet sent, sent=sent to Inngest, processing=Inngest is processing, completed=function finished, failed=error occurred, cancelled=manually cancelled';
