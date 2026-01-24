-- Fix migration: Update existing reminder_timing values to match constraint
-- This migration updates any non-standard reminder_timing values before applying the constraint

-- Update non-standard timing values to the closest standard value
UPDATE appointment_reminders 
SET reminder_timing = CASE 
    WHEN reminder_timing = '5h' THEN '24h'
    WHEN reminder_timing = '5m' THEN '30m'
    WHEN reminder_timing NOT IN ('24h', '1h', '30m', 'custom') THEN 'custom'
    ELSE reminder_timing
END
WHERE reminder_timing NOT IN ('24h', '1h', '30m', 'custom');

-- Now add the constraint (it will only apply to new rows since existing ones are now compliant)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_reminder_timing' 
        AND conrelid = 'appointment_reminders'::regclass
    ) THEN
        ALTER TABLE appointment_reminders 
        ADD CONSTRAINT chk_reminder_timing 
        CHECK (reminder_timing IN ('24h', '1h', '30m', 'custom'));
    END IF;
END $$;
