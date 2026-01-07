-- Add archive fields to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Create index for faster filtering of non-archived appointments
CREATE INDEX IF NOT EXISTS idx_appointments_is_archived ON appointments(is_archived);
