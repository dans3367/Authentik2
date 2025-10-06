-- Create outgoing_emails table for tracking all sent emails
CREATE TABLE IF NOT EXISTS outgoing_emails (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    
    -- Recipient information
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    
    -- Sender information
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    
    -- Email content
    subject TEXT NOT NULL,
    email_type VARCHAR(50) NOT NULL, -- 'birthday_card', 'test_card', 'promotional', 'newsletter', etc.
    html_content TEXT,
    text_content TEXT,
    
    -- Provider information
    provider VARCHAR(50) NOT NULL, -- 'resend', 'sendgrid', 'mailgun'
    provider_message_id VARCHAR(255),
    provider_response JSONB, -- Store full provider response
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'bounced', 'failed'
    send_attempts INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Related entities (nullable foreign keys)
    contact_id VARCHAR(36),
    newsletter_id VARCHAR(36),
    campaign_id VARCHAR(36),
    promotion_id VARCHAR(36),
    
    -- Metadata
    metadata JSONB, -- Additional flexible data storage
    
    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_tenant_id ON outgoing_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_recipient_email ON outgoing_emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_provider_message_id ON outgoing_emails(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_status ON outgoing_emails(status);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_email_type ON outgoing_emails(email_type);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_sent_at ON outgoing_emails(sent_at);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_contact_id ON outgoing_emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_promotion_id ON outgoing_emails(promotion_id);

-- Add comment to table
COMMENT ON TABLE outgoing_emails IS 'Tracks all outgoing emails sent through the system';
