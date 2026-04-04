-- Auto-reminder settings: per-tenant toggle for sending reminders
-- 1 hour before unconfirmed appointments.
CREATE TABLE IF NOT EXISTS appointment_auto_reminder_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_auto_reminder_tenant
  ON appointment_auto_reminder_settings(tenant_id);
