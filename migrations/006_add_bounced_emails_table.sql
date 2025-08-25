-- Create universal bounced emails table
CREATE TABLE IF NOT EXISTS bounced_emails (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    bounce_type TEXT NOT NULL DEFAULT 'hard',
    bounce_reason TEXT,
    bounce_sub_type TEXT,
    first_bounced_at TIMESTAMP NOT NULL,
    last_bounced_at TIMESTAMP NOT NULL,
    bounce_count INTEGER DEFAULT 1,
    source_tenant_id VARCHAR REFERENCES tenants(id),
    source_newsletter_id VARCHAR REFERENCES newsletters(id),
    source_campaign_id VARCHAR REFERENCES campaigns(id),
    webhook_id TEXT,
    webhook_data TEXT,
    is_active BOOLEAN DEFAULT true,
    suppression_reason TEXT,
    last_attempted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bounced_emails_email ON bounced_emails(email);
CREATE INDEX IF NOT EXISTS idx_bounced_emails_is_active ON bounced_emails(is_active);
CREATE INDEX IF NOT EXISTS idx_bounced_emails_bounce_type ON bounced_emails(bounce_type);
CREATE INDEX IF NOT EXISTS idx_bounced_emails_source_tenant_id ON bounced_emails(source_tenant_id);
CREATE INDEX IF NOT EXISTS idx_bounced_emails_first_bounced_at ON bounced_emails(first_bounced_at);

-- Add constraint to ensure bounce_type is valid
ALTER TABLE bounced_emails 
ADD CONSTRAINT check_bounce_type 
CHECK (bounce_type IN ('hard', 'soft', 'complaint'));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bounced_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function
CREATE TRIGGER update_bounced_emails_updated_at
    BEFORE UPDATE ON bounced_emails
    FOR EACH ROW
    EXECUTE FUNCTION update_bounced_emails_updated_at();
