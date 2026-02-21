CREATE TABLE "newsletter_reviewer_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"reviewer_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "newsletter_reviewer_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "requires_reviewer_approval" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "reviewer_id" varchar;--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "review_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "newsletter_reviewer_settings" ADD CONSTRAINT "newsletter_reviewer_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_reviewer_settings" ADD CONSTRAINT "newsletter_reviewer_settings_reviewer_id_better_auth_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."better_auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_reviewer_id_better_auth_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."better_auth_user"("id") ON DELETE no action ON UPDATE no action;