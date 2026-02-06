CREATE TABLE "activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"entity_name" text,
	"activity_type" text NOT NULL,
	"description" text,
	"changes" text,
	"metadata" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "master_email_design" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"company_name" text DEFAULT '',
	"logo_url" text,
	"primary_color" text DEFAULT '#3B82F6',
	"secondary_color" text DEFAULT '#1E40AF',
	"accent_color" text DEFAULT '#10B981',
	"font_family" text DEFAULT 'Arial, sans-serif',
	"header_text" text,
	"footer_text" text,
	"social_links" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "master_email_design_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "pref_transactional" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "pref_marketing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "pref_customer_engagement" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "pref_newsletters" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "pref_surveys_forms" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "monthly_email_limit" integer DEFAULT 200;--> statement-breakpoint
ALTER TABLE "tenant_limits" ADD COLUMN "monthly_email_limit" integer;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_email_design" ADD CONSTRAINT "master_email_design_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;