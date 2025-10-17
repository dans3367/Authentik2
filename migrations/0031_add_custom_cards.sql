-- Add custom_cards table for storing user-created custom holiday/occasion cards
CREATE TABLE IF NOT EXISTS custom_cards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES better_auth_user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  occasion_type TEXT,
  send_date TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  card_data TEXT NOT NULL,
  promotion_ids TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_cards_tenant_id ON custom_cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_cards_user_id ON custom_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_cards_send_date ON custom_cards(send_date);
CREATE INDEX IF NOT EXISTS idx_custom_cards_active ON custom_cards(active);

