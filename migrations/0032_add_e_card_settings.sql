-- Add e_card_settings table for storing e-card configuration separate from birthday settings
CREATE TABLE IF NOT EXISTS e_card_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  email_template TEXT DEFAULT 'default',
  custom_message TEXT DEFAULT '',
  custom_theme_data TEXT,
  sender_name TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_e_card_settings_tenant_id ON e_card_settings(tenant_id);

-- Add unique constraint to ensure one settings record per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_e_card_settings_unique_tenant ON e_card_settings(tenant_id);

