-- Migration 021: Split outgoing_emails into specialized tables
-- This migration creates the new table structure for better performance and separation of concerns

-- 1. Create email_sends table (core email tracking - frequently queried)
CREATE TABLE IF NOT EXISTS email_sends (
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
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'bounced', 'failed'
    send_attempts INTEGER DEFAULT 1,
    error_message TEXT,
    
    -- Related records
    contact_id VARCHAR REFERENCES email_contacts(id) ON DELETE SET NULL,
    newsletter_id VARCHAR REFERENCES newsletters(id) ON DELETE SET NULL,
    campaign_id VARCHAR REFERENCES campaigns(id) ON DELETE SET NULL,
    promotion_id VARCHAR REFERENCES promotions(id) ON DELETE SET NULL,
    
    -- Timestamps
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create email_content table (content storage - less frequently accessed)
CREATE TABLE IF NOT EXISTS email_content (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email_send_id VARCHAR NOT NULL REFERENCES email_sends(id) ON DELETE CASCADE,
    
    -- Email content
    html_content TEXT,
    text_content TEXT,
    
    -- Provider response data
    provider_response TEXT, -- JSON response from provider
    
    -- Metadata
    metadata TEXT, -- JSON for additional custom data
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create email_events table (webhook data and tracking events)
CREATE TABLE IF NOT EXISTS email_events (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email_send_id VARCHAR NOT NULL REFERENCES email_sends(id) ON DELETE CASCADE,
    
    -- Event details
    event_type TEXT NOT NULL, -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed'
    event_data TEXT, -- JSON webhook payload or event data
    
    -- Event metadata
    user_agent TEXT,
    ip_address TEXT,
    webhook_id TEXT, -- Provider webhook event ID
    
    -- Timestamps
    occurred_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for email_sends (frequently queried)
CREATE INDEX IF NOT EXISTS idx_email_sends_tenant_id ON email_sends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_recipient_email ON email_sends(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_sends_email_type ON email_sends(email_type);
CREATE INDEX IF NOT EXISTS idx_email_sends_provider ON email_sends(provider);
CREATE INDEX IF NOT EXISTS idx_email_sends_provider_message_id ON email_sends(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_contact_id ON email_sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_newsletter_id ON email_sends(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign_id ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_promotion_id ON email_sends(promotion_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_sent_at ON email_sends(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_sends_created_at ON email_sends(created_at);

-- Create indexes for email_content
CREATE INDEX IF NOT EXISTS idx_email_content_email_send_id ON email_content(email_send_id);
CREATE INDEX IF NOT EXISTS idx_email_content_subject_search ON email_content USING gin(to_tsvector('english', COALESCE((SELECT subject FROM email_sends WHERE id = email_content.email_send_id), '')));

-- Create indexes for email_events
CREATE INDEX IF NOT EXISTS idx_email_events_email_send_id ON email_events(email_send_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_occurred_at ON email_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_email_events_webhook_id ON email_events(webhook_id);

-- Add constraints to ensure valid values
ALTER TABLE email_sends 
ADD CONSTRAINT check_email_sends_email_type 
CHECK (email_type IN ('birthday_card', 'test_card', 'promotional', 'newsletter', 'invitation', 'appointment_reminder', 'other'));

ALTER TABLE email_sends 
ADD CONSTRAINT check_email_sends_status 
CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed'));

ALTER TABLE email_sends 
ADD CONSTRAINT check_email_sends_provider 
CHECK (provider IN ('resend', 'sendgrid', 'mailgun', 'other'));

ALTER TABLE email_events 
ADD CONSTRAINT check_email_events_event_type 
CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed'));

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_sends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for email_sends
CREATE TRIGGER update_email_sends_updated_at
    BEFORE UPDATE ON email_sends
    FOR EACH ROW
    EXECUTE FUNCTION update_email_sends_updated_at();

-- Add comments for documentation
COMMENT ON TABLE email_sends IS 'Core email tracking table - stores email metadata and status';
COMMENT ON TABLE email_content IS 'Email content storage - stores HTML/text content and provider responses';
COMMENT ON TABLE email_events IS 'Email event tracking - stores webhook events and user interactions';

COMMENT ON COLUMN email_sends.provider_message_id IS 'Provider-specific message ID for tracking';
COMMENT ON COLUMN email_content.html_content IS 'Full HTML content of the email';
COMMENT ON COLUMN email_content.text_content IS 'Plain text content of the email';
COMMENT ON COLUMN email_events.event_type IS 'Type of email event (sent, delivered, opened, clicked, etc.)';
COMMENT ON COLUMN email_events.webhook_id IS 'Provider webhook event ID for deduplication';