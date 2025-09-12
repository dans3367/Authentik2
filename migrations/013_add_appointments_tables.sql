-- Migration: Add appointments and appointment_reminders tables
-- Created: 2025-09-11
-- Description: Add appointment scheduling and reminder functionality

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    customer_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    appointment_date TIMESTAMP NOT NULL,
    duration INTEGER DEFAULT 60,
    location TEXT,
    service_type TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMP,
    confirmation_received BOOLEAN DEFAULT false,
    confirmation_received_at TIMESTAMP,
    confirmation_token TEXT,
    reminder_settings TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraints for appointments
ALTER TABLE appointments 
ADD CONSTRAINT fk_appointments_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE appointments 
ADD CONSTRAINT fk_appointments_customer 
FOREIGN KEY (customer_id) REFERENCES email_contacts(id) ON DELETE CASCADE;

ALTER TABLE appointments 
ADD CONSTRAINT fk_appointments_user 
FOREIGN KEY (user_id) REFERENCES better_auth_user(id) ON DELETE CASCADE;

-- Create appointment_reminders table
CREATE TABLE IF NOT EXISTS appointment_reminders (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    appointment_id VARCHAR NOT NULL,
    customer_id VARCHAR NOT NULL,
    reminder_type TEXT NOT NULL,
    reminder_timing TEXT NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'pending',
    content TEXT,
    error_message TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraints for appointment_reminders
ALTER TABLE appointment_reminders 
ADD CONSTRAINT fk_appointment_reminders_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE appointment_reminders 
ADD CONSTRAINT fk_appointment_reminders_appointment 
FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

ALTER TABLE appointment_reminders 
ADD CONSTRAINT fk_appointment_reminders_customer 
FOREIGN KEY (customer_id) REFERENCES email_contacts(id) ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_token ON appointments(confirmation_token);

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_tenant_id ON appointment_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment_id ON appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_customer_id ON appointment_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_scheduled_for ON appointment_reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_status ON appointment_reminders(status);

-- Add check constraints for data integrity
ALTER TABLE appointments 
ADD CONSTRAINT chk_appointments_status 
CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'));

ALTER TABLE appointment_reminders 
ADD CONSTRAINT chk_reminder_type 
CHECK (reminder_type IN ('email', 'sms', 'push'));

ALTER TABLE appointment_reminders 
ADD CONSTRAINT chk_reminder_timing 
CHECK (reminder_timing IN ('24h', '1h', '30m', 'custom'));

ALTER TABLE appointment_reminders 
ADD CONSTRAINT chk_reminder_status 
CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'));

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at 
BEFORE UPDATE ON appointments 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointment_reminders_updated_at ON appointment_reminders;
CREATE TRIGGER update_appointment_reminders_updated_at 
BEFORE UPDATE ON appointment_reminders 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
