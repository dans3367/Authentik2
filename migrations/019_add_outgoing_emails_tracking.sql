-- Create outgoing_emails tracking table
CREATE TABLE IF NOT EXISTS outgoing_emails (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Email details
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    subject TEXT NOT NULL,
    email_type TEXT NOT NULL, -- 'birthday_card', 'test_card', 'promotional', 'newsletter', 'invitation', 'appointment_reminder'
    
    -- Provider details
    provider TEXT NOT NULL, -- 'resend', 'sendgrid', 'mailgun'
    provider_message_id TEXT, -- Provider's unique message ID (e.g., Resend email ID)
    provider_response TEXT, -- JSON response from provider
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'bounced', 'failed'
    send_attempts INTEGER DEFAULT 1,
    error_message TEXT,
    
    -- Related records
    contact_id VARCHAR REFERENCES email_contacts(id) ON DELETE SET NULL,
    newsletter_id VARCHAR REFERENCES newsletters(id) ON DELETE SET NULL,
    campaign_id VARCHAR REFERENCES campaigns(id) ON DELETE SET NULL,
    promotion_id VARCHAR REFERENCES promotions(id) ON DELETE SET NULL,
    
    -- Metadata
    metadata TEXT, -- JSON for additional custom data
    
    -- Timestamps
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_tenant_id ON outgoing_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_recipient_email ON outgoing_emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_email_type ON outgoing_emails(email_type);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_provider ON outgoing_emails(provider);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_provider_message_id ON outgoing_emails(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_status ON outgoing_emails(status);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_contact_id ON outgoing_emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_sent_at ON outgoing_emails(sent_at);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_created_at ON outgoing_emails(created_at);

-- Add constraint to ensure email_type is valid
ALTER TABLE outgoing_emails 
ADD CONSTRAINT check_email_type 
CHECK (email_type IN ('birthday_card', 'test_card', 'promotional', 'newsletter', 'invitation', 'appointment_reminder', 'other'));

-- Add constraint to ensure status is valid
ALTER TABLE outgoing_emails 
ADD CONSTRAINT check_status 
CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed'));

-- Add constraint to ensure provider is valid
ALTER TABLE outgoing_emails 
ADD CONSTRAINT check_provider 
CHECK (provider IN ('resend', 'sendgrid', 'mailgun', 'other'));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_outgoing_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function
CREATE TRIGGER update_outgoing_emails_updated_at
    BEFORE UPDATE ON outgoing_emails
    FOR EACH ROW
    EXECUTE FUNCTION update_outgoing_emails_updated_at();
