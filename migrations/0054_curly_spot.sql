CREATE TABLE "newsletter_reactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"newsletter_id" varchar NOT NULL,
	"recipient_email" text NOT NULL,
	"reaction_type" text NOT NULL,
	"reaction_token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"reacted_at" timestamp DEFAULT now() NOT NULL,
	"reacted_retention_expires" timestamp,
	"reacted_anonymized_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "newsletter_reactions_reaction_token_unique" UNIQUE("reaction_token")
);
--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "category" text DEFAULT 'intake' NOT NULL;--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "reviewer_approval_code" varchar(5);--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "trigger_run_id" text;--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "reactions_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "temp_2fa_sessions" ADD COLUMN "verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "newsletter_reactions" ADD CONSTRAINT "newsletter_reactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_reactions" ADD CONSTRAINT "newsletter_reactions_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_newsletter_reactions_newsletter" ON "newsletter_reactions" USING btree ("newsletter_id");--> statement-breakpoint
CREATE INDEX "idx_newsletter_reactions_tenant_newsletter" ON "newsletter_reactions" USING btree ("tenant_id","newsletter_id");--> statement-breakpoint
CREATE INDEX "idx_newsletter_reactions_token" ON "newsletter_reactions" USING btree ("reaction_token");--> statement-breakpoint
CREATE INDEX "idx_newsletter_reactions_type" ON "newsletter_reactions" USING btree ("newsletter_id","reaction_type");--> statement-breakpoint
CREATE INDEX "idx_newsletter_reactions_retention" ON "newsletter_reactions" USING btree ("reacted_retention_expires");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_newsletter_reactions_unique_vote" ON "newsletter_reactions" USING btree ("newsletter_id","recipient_email");