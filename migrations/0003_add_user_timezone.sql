CREATE TABLE "inngest_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"event_name" text NOT NULL,
	"event_id" text,
	"idempotency_key" text,
	"event_data" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"last_retry_at" timestamp,
	"next_retry_at" timestamp,
	"scheduled_for" timestamp,
	"result" text,
	"error_message" text,
	"related_type" text,
	"related_id" varchar,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "inngest_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD COLUMN "timezone" text DEFAULT 'America/Chicago';--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD COLUMN "inngest_event_id" text;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "timezone" text DEFAULT 'America/Chicago';--> statement-breakpoint
ALTER TABLE "inngest_events" ADD CONSTRAINT "inngest_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;