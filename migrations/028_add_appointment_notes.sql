-- Add appointment_notes table for storing multiple notes per appointment
CREATE TABLE IF NOT EXISTS appointment_notes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id VARCHAR NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES better_auth_user(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_appointment_notes_appointment_id ON appointment_notes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_notes_tenant_id ON appointment_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_notes_user_id ON appointment_notes(user_id);
