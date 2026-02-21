-- Add trigger_run_id column to newsletters table for tracking scheduled Trigger.dev runs
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS trigger_run_id TEXT;
