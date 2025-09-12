-- Add birthday tracking fields to email_contacts table
ALTER TABLE email_contacts 
ADD COLUMN birthday TEXT,
ADD COLUMN birthday_email_enabled BOOLEAN DEFAULT false;

-- Add comment to document these fields
COMMENT ON COLUMN email_contacts.birthday IS 'Birthday date in YYYY-MM-DD format';
COMMENT ON COLUMN email_contacts.birthday_email_enabled IS 'Whether user wants to receive birthday emails';

-- Create birthday_settings table for managing birthday email campaigns
CREATE TABLE birthday_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  send_days_before INTEGER DEFAULT 0,
  email_template TEXT DEFAULT 'default',
  segment_filter TEXT DEFAULT 'all',
  custom_message TEXT DEFAULT '',
  sender_name TEXT DEFAULT '',
  sender_email TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add comments to document birthday_settings fields
COMMENT ON COLUMN birthday_settings.enabled IS 'Whether birthday email campaigns are enabled';
COMMENT ON COLUMN birthday_settings.send_days_before IS 'How many days before birthday to send emails';
COMMENT ON COLUMN birthday_settings.email_template IS 'Email template to use for birthday emails';
COMMENT ON COLUMN birthday_settings.segment_filter IS 'Which contacts to include (all, tags, lists, etc.)';
COMMENT ON COLUMN birthday_settings.custom_message IS 'Custom birthday message to include in emails';

-- Ensure each tenant can only have one birthday settings record
ALTER TABLE birthday_settings ADD CONSTRAINT unique_birthday_settings_per_tenant UNIQUE (tenant_id);
