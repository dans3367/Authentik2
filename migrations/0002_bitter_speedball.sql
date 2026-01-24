CREATE TABLE "appointment_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"appointment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointment_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"appointment_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"reminder_type" text NOT NULL,
	"reminder_timing" text NOT NULL,
	"custom_minutes_before" integer,
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"content" text,
	"error_message" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"appointment_date" timestamp NOT NULL,
	"duration" integer DEFAULT 60,
	"location" text,
	"service_type" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"reminder_sent" boolean DEFAULT false,
	"reminder_sent_at" timestamp,
	"confirmation_received" boolean DEFAULT false,
	"confirmation_received_at" timestamp,
	"confirmation_token" text,
	"reminder_settings" text,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "birthday_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"enabled" boolean DEFAULT false,
	"email_template" text DEFAULT 'default',
	"segment_filter" text DEFAULT 'all',
	"custom_message" text DEFAULT '',
	"custom_theme_data" text,
	"promotion_id" varchar,
	"split_promotional_email" boolean DEFAULT false,
	"disabled_holidays" text[],
	"sender_name" text DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "birthday_unsubscribe_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"token" text NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"used_at" timestamp,
	CONSTRAINT "birthday_unsubscribe_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "custom_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"occasion_type" text,
	"send_date" text NOT NULL,
	"active" boolean DEFAULT true,
	"card_data" text NOT NULL,
	"promotion_ids" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "e_card_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"enabled" boolean DEFAULT false,
	"email_template" text DEFAULT 'default',
	"custom_message" text DEFAULT '',
	"custom_theme_data" text,
	"sender_name" text DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_content" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_send_id" varchar NOT NULL,
	"html_content" text,
	"text_content" text,
	"provider_response" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_send_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"event_data" text,
	"user_agent" text,
	"ip_address" text,
	"webhook_id" text,
	"occurred_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_name" text,
	"sender_email" text NOT NULL,
	"sender_name" text,
	"subject" text NOT NULL,
	"email_type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"send_attempts" integer DEFAULT 1,
	"error_message" text,
	"contact_id" varchar,
	"newsletter_id" varchar,
	"campaign_id" varchar,
	"promotion_id" varchar,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"type" text DEFAULT 'newsletter' NOT NULL,
	"target_audience" text DEFAULT 'all' NOT NULL,
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"max_uses" integer,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"promotional_codes" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_emails" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"html" text,
	"text" text,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_id" text,
	"attempt_count" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"next_retry_at" timestamp,
	"error" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "segment_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"selected_contact_ids" text[] DEFAULT '{}'::text[],
	"selected_tag_ids" text[] DEFAULT '{}'::text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_limit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"shop_count" integer NOT NULL,
	"limit_value" integer,
	"subscription_plan_id" varchar,
	"custom_limit_id" varchar,
	"metadata" text DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "temp_2fa_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "temp_2fa_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"category" text NOT NULL,
	"subject_line" text NOT NULL,
	"preview" text,
	"body" text NOT NULL,
	"usage_count" integer DEFAULT 0,
	"last_used" timestamp,
	"is_favorite" boolean DEFAULT false,
	"tags" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_limits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"max_shops" integer,
	"max_users" integer,
	"max_storage_gb" integer,
	"custom_limits" text DEFAULT '{}',
	"override_reason" text,
	"created_by" varchar,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_limits_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "unsubscribe_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"token" text NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unsubscribe_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_reviewer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "companies" DROP CONSTRAINT "companies_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "email_contacts" DROP CONSTRAINT "email_contacts_added_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "forms" DROP CONSTRAINT "forms_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "newsletters" DROP CONSTRAINT "newsletters_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "shops" DROP CONSTRAINT "shops_manager_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "verification_tokens" DROP CONSTRAINT "verification_tokens_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "better_auth_user" ALTER COLUMN "role" SET DEFAULT 'Owner';--> statement-breakpoint
ALTER TABLE "better_auth_user" ALTER COLUMN "tenant_id" SET DEFAULT '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff';--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "email_verification_token" text;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "email_verification_expires" timestamp;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "last_verification_email_sent" timestamp;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "menu_expanded" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "theme" text DEFAULT 'light';--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "language" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "token_valid_after" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "subscription_status" text DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "subscription_plan_id" varchar;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "subscription_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "subscription_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "better_auth_user" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "setup_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "geographical_location" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "language" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_description" text;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "birthday" text;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "birthday_email_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "birthday_unsubscribe_reason" text;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "birthday_unsubscribed_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "zip_code" text;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "appointment_notes" ADD CONSTRAINT "appointment_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notes" ADD CONSTRAINT "appointment_notes_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notes" ADD CONSTRAINT "appointment_notes_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_customer_id_email_contacts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."email_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_email_contacts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."email_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_settings" ADD CONSTRAINT "birthday_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_settings" ADD CONSTRAINT "birthday_settings_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_unsubscribe_tokens" ADD CONSTRAINT "birthday_unsubscribe_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthday_unsubscribe_tokens" ADD CONSTRAINT "birthday_unsubscribe_tokens_contact_id_email_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_cards" ADD CONSTRAINT "custom_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_cards" ADD CONSTRAINT "custom_cards_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e_card_settings" ADD CONSTRAINT "e_card_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_content" ADD CONSTRAINT "email_content_email_send_id_email_sends_id_fk" FOREIGN KEY ("email_send_id") REFERENCES "public"."email_sends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_send_id_email_sends_id_fk" FOREIGN KEY ("email_send_id") REFERENCES "public"."email_sends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_contact_id_email_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_contact_id_email_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_lists" ADD CONSTRAINT "segment_lists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_limit_events" ADD CONSTRAINT "shop_limit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_limit_events" ADD CONSTRAINT "shop_limit_events_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_limit_events" ADD CONSTRAINT "shop_limit_events_custom_limit_id_tenant_limits_id_fk" FOREIGN KEY ("custom_limit_id") REFERENCES "public"."tenant_limits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_2fa_sessions" ADD CONSTRAINT "temp_2fa_sessions_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temp_2fa_sessions" ADD CONSTRAINT "temp_2fa_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_limits" ADD CONSTRAINT "tenant_limits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_limits" ADD CONSTRAINT "tenant_limits_created_by_better_auth_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."better_auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unsubscribe_tokens" ADD CONSTRAINT "unsubscribe_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unsubscribe_tokens" ADD CONSTRAINT "unsubscribe_tokens_contact_id_email_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_reviewer_id_better_auth_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."better_auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_better_auth_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD CONSTRAINT "email_contacts_added_by_user_id_better_auth_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_manager_id_better_auth_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."better_auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE cascade ON UPDATE no action;