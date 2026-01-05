-- Add custom minutes before field to appointment reminders
ALTER TABLE appointment_reminders ADD COLUMN custom_minutes_before INTEGER;

-- Add comment explaining the field
COMMENT ON COLUMN appointment_reminders.custom_minutes_before IS 'Custom minutes before appointment when reminder should be sent (used when reminder_timing is custom)';
