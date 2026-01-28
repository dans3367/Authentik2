-- Migration: Rename inngest_events to trigger_tasks for Trigger.dev integration
-- This repurposes the table to track all outgoing Trigger.dev tasks and their status updates

-- Rename the table
ALTER TABLE IF EXISTS inngest_events RENAME TO trigger_tasks;

-- Rename columns to match Trigger.dev terminology
ALTER TABLE trigger_tasks RENAME COLUMN event_name TO task_id;
ALTER TABLE trigger_tasks RENAME COLUMN event_id TO run_id;
ALTER TABLE trigger_tasks RENAME COLUMN event_data TO payload;
ALTER TABLE trigger_tasks RENAME COLUMN retry_count TO attempt_count;
ALTER TABLE trigger_tasks RENAME COLUMN max_retries TO max_attempts;
ALTER TABLE trigger_tasks RENAME COLUMN last_retry_at TO last_attempt_at;
ALTER TABLE trigger_tasks RENAME COLUMN result TO output;
ALTER TABLE trigger_tasks RENAME COLUMN sent_at TO triggered_at;

-- Add new columns for enhanced tracking
ALTER TABLE trigger_tasks ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE trigger_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

-- Drop old columns that are no longer needed
ALTER TABLE trigger_tasks DROP COLUMN IF EXISTS next_retry_at;

-- Update the status check constraint for new statuses
ALTER TABLE trigger_tasks DROP CONSTRAINT IF EXISTS check_inngest_event_status;
ALTER TABLE trigger_tasks ADD CONSTRAINT check_trigger_task_status 
CHECK (status IN ('pending', 'triggered', 'running', 'completed', 'failed', 'cancelled'));

-- Rename indexes
ALTER INDEX IF EXISTS idx_inngest_events_tenant_id RENAME TO idx_trigger_tasks_tenant_id;
ALTER INDEX IF EXISTS idx_inngest_events_event_name RENAME TO idx_trigger_tasks_task_id;
ALTER INDEX IF EXISTS idx_inngest_events_event_id RENAME TO idx_trigger_tasks_run_id;
ALTER INDEX IF EXISTS idx_inngest_events_status RENAME TO idx_trigger_tasks_status;
ALTER INDEX IF EXISTS idx_inngest_events_idempotency_key RENAME TO idx_trigger_tasks_idempotency_key;
ALTER INDEX IF EXISTS idx_inngest_events_scheduled_for RENAME TO idx_trigger_tasks_scheduled_for;
ALTER INDEX IF EXISTS idx_inngest_events_related RENAME TO idx_trigger_tasks_related;
ALTER INDEX IF EXISTS idx_inngest_events_created_at RENAME TO idx_trigger_tasks_created_at;

-- Drop and recreate the partial index with new name
DROP INDEX IF EXISTS idx_inngest_events_pending;
CREATE INDEX IF NOT EXISTS idx_trigger_tasks_active ON trigger_tasks(status) 
WHERE status IN ('pending', 'triggered', 'running');

-- Update the trigger function name
DROP TRIGGER IF EXISTS update_inngest_events_updated_at ON trigger_tasks;
DROP FUNCTION IF EXISTS update_inngest_events_updated_at();

CREATE OR REPLACE FUNCTION update_trigger_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trigger_tasks_updated_at
    BEFORE UPDATE ON trigger_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_trigger_tasks_updated_at();

-- Update table and column comments
COMMENT ON TABLE trigger_tasks IS 'Tracks all Trigger.dev background tasks for local status tracking and recovery';
COMMENT ON COLUMN trigger_tasks.task_id IS 'Trigger.dev task identifier e.g., send-appointment-reminder, schedule-appointment-reminder';
COMMENT ON COLUMN trigger_tasks.run_id IS 'Trigger.dev run ID (starts with run_)';
COMMENT ON COLUMN trigger_tasks.status IS 'pending=not yet triggered, triggered=sent to Trigger.dev, running=task executing, completed=finished successfully, failed=error occurred, cancelled=manually cancelled';
COMMENT ON COLUMN trigger_tasks.payload IS 'JSON payload sent to Trigger.dev task';
COMMENT ON COLUMN trigger_tasks.output IS 'JSON output returned from task execution';
