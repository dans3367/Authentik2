CREATE TABLE "convex_newsletter_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"convex_id" text,
	"tenant_id" varchar NOT NULL,
	"newsletter_id" varchar NOT NULL,
	"newsletter_send_id" varchar,
	"recipient_email" text NOT NULL,
	"event_type" text NOT NULL,
	"provider_message_id" text,
	"metadata" jsonb,
	"occurred_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "convex_newsletter_events_convex_id_unique" UNIQUE("convex_id")
);
--> statement-breakpoint
CREATE TABLE "convex_newsletter_sends" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"convex_id" text,
	"tenant_id" varchar NOT NULL,
	"newsletter_id" varchar NOT NULL,
	"group_uuid" text NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_id" text,
	"recipient_name" text,
	"provider_message_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"first_opened_at" timestamp,
	"last_opened_at" timestamp,
	"first_clicked_at" timestamp,
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "convex_newsletter_sends_convex_id_unique" UNIQUE("convex_id")
);
--> statement-breakpoint
CREATE TABLE "convex_newsletter_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"convex_id" text,
	"tenant_id" varchar NOT NULL,
	"newsletter_id" varchar NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"queued" integer DEFAULT 0 NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	"opened" integer DEFAULT 0 NOT NULL,
	"unique_opens" integer DEFAULT 0 NOT NULL,
	"clicked" integer DEFAULT 0 NOT NULL,
	"unique_clicks" integer DEFAULT 0 NOT NULL,
	"bounced" integer DEFAULT 0 NOT NULL,
	"complained" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"suppressed" integer DEFAULT 0,
	"unsubscribed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_event_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "convex_newsletter_stats_convex_id_unique" UNIQUE("convex_id"),
	CONSTRAINT "convex_newsletter_stats_newsletter_id_unique" UNIQUE("newsletter_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ALTER COLUMN "monthly_email_limit" SET DEFAULT 100;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "suspended_by_downgrade" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "date_of_birth" text;--> statement-breakpoint
ALTER TABLE "master_email_design" ADD COLUMN "header_mode" text DEFAULT 'logo';--> statement-breakpoint
ALTER TABLE "master_email_design" ADD COLUMN "logo_size" text DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "master_email_design" ADD COLUMN "logo_alignment" text DEFAULT 'center';--> statement-breakpoint
ALTER TABLE "master_email_design" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "master_email_design" ADD COLUMN "show_company_name" text DEFAULT 'true';--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "puck_data" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "suspended_by_downgrade" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "allow_users_management" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "allow_roles_management" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "downgrade_target_plan_id" varchar;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "downgrade_scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "previous_plan_id" varchar;--> statement-breakpoint
CREATE INDEX "idx_cvx_events_newsletter" ON "convex_newsletter_events" USING btree ("newsletter_id");--> statement-breakpoint
CREATE INDEX "idx_cvx_events_tenant_newsletter" ON "convex_newsletter_events" USING btree ("tenant_id","newsletter_id");--> statement-breakpoint
CREATE INDEX "idx_cvx_events_send" ON "convex_newsletter_events" USING btree ("newsletter_send_id");--> statement-breakpoint
CREATE INDEX "idx_cvx_events_type" ON "convex_newsletter_events" USING btree ("newsletter_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_cvx_events_occurred" ON "convex_newsletter_events" USING btree ("newsletter_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_cvx_events_provider_event" ON "convex_newsletter_events" USING btree ("provider_message_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_cvx_events_recipient_newsletter_event" ON "convex_newsletter_events" USING btree ("recipient_email","newsletter_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_cvx_sends_newsletter" ON "convex_newsletter_sends" USING btree ("newsletter_id");--> statement-breakpoint
CREATE INDEX "idx_cvx_sends_tenant_newsletter" ON "convex_newsletter_sends" USING btree ("tenant_id","newsletter_id");--> statement-breakpoint
CREATE INDEX "idx_cvx_sends_provider_message" ON "convex_newsletter_sends" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "idx_cvx_sends_recipient" ON "convex_newsletter_sends" USING btree ("tenant_id","recipient_email");--> statement-breakpoint
CREATE INDEX "idx_cvx_sends_recipient_newsletter" ON "convex_newsletter_sends" USING btree ("recipient_email","newsletter_id");--> statement-breakpoint
CREATE INDEX "idx_cvx_sends_status" ON "convex_newsletter_sends" USING btree ("newsletter_id","status");--> statement-breakpoint
CREATE INDEX "idx_cvx_sends_recipient_email" ON "convex_newsletter_sends" USING btree ("recipient_email");--> statement-breakpoint
CREATE INDEX "idx_cvx_sends_newsletter_recipient" ON "convex_newsletter_sends" USING btree ("newsletter_id","recipient_email");--> statement-breakpoint
CREATE INDEX "idx_cvx_stats_tenant" ON "convex_newsletter_stats" USING btree ("tenant_id");