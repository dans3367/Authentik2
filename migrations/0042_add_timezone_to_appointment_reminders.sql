-- Add timezone and inngest_event_id columns to appointment_reminders table
ALTER TABLE appointment_reminders 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Chicago';

ALTER TABLE appointment_reminders 
ADD COLUMN IF NOT EXISTS inngest_event_id TEXT;
