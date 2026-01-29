-- Trigger.dev Tasks tracking table for recording all background tasks
-- Tracks outgoing tasks and their status updates at a local level
CREATE TABLE "trigger_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"task_id" text NOT NULL,
	"run_id" text,
	"idempotency_key" text,
	"payload" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"last_attempt_at" timestamp,
	"scheduled_for" timestamp,
	"output" text,
	"error_message" text,
	"error_code" text,
	"related_type" text,
	"related_id" varchar,
	"triggered_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "trigger_tasks_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD COLUMN "timezone" text DEFAULT 'America/Chicago';--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD COLUMN "inngest_event_id" text;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "timezone" text DEFAULT 'America/Chicago';--> statement-breakpoint
ALTER TABLE "trigger_tasks" ADD CONSTRAINT "trigger_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Add status constraint
ALTER TABLE "trigger_tasks" ADD CONSTRAINT "check_trigger_task_status" CHECK (status IN ('pending', 'triggered', 'running', 'completed', 'failed', 'cancelled'));--> statement-breakpoint
-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_trigger_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';--> statement-breakpoint
CREATE TRIGGER update_trigger_tasks_updated_at
    BEFORE UPDATE ON trigger_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_trigger_tasks_updated_at();--> statement-breakpoint
-- Add comments
COMMENT ON TABLE trigger_tasks IS 'Tracks all Trigger.dev background tasks for local status tracking and recovery';
COMMENT ON COLUMN trigger_tasks.task_id IS 'Trigger.dev task identifier e.g., send-appointment-reminder, schedule-appointment-reminder';
COMMENT ON COLUMN trigger_tasks.run_id IS 'Trigger.dev run ID (starts with run_)';
COMMENT ON COLUMN trigger_tasks.status IS 'pending=not yet triggered, triggered=sent to Trigger.dev, running=task executing, completed=finished successfully, failed=error occurred, cancelled=manually cancelled';
COMMENT ON COLUMN trigger_tasks.payload IS 'JSON payload sent to Trigger.dev task';
COMMENT ON COLUMN trigger_tasks.output IS 'JSON output returned from task execution';