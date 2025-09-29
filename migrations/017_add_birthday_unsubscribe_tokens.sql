-- Migration: Add birthday unsubscribe tokens table
-- This migration adds a table to track unsubscribe tokens for birthday emails

-- Create unsubscribe tokens table
CREATE TABLE IF NOT EXISTS birthday_unsubscribe_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    contact_id VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (contact_id) REFERENCES email_contacts(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_birthday_unsubscribe_tokens_token ON birthday_unsubscribe_tokens(token);
CREATE INDEX IF NOT EXISTS idx_birthday_unsubscribe_tokens_contact_id ON birthday_unsubscribe_tokens(contact_id);
CREATE INDEX IF NOT EXISTS idx_birthday_unsubscribe_tokens_tenant_id ON birthday_unsubscribe_tokens(tenant_id);

-- Add unsubscribe reason field to email_contacts table
ALTER TABLE email_contacts 
ADD COLUMN IF NOT EXISTS birthday_unsubscribe_reason TEXT,
ADD COLUMN IF NOT EXISTS birthday_unsubscribed_at TIMESTAMP WITH TIME ZONE;