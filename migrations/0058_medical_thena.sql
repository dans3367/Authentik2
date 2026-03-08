CREATE TABLE IF NOT EXISTS "campaign_forms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"form_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "campaign_forms" ADD CONSTRAINT "campaign_forms_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_forms" ADD CONSTRAINT "campaign_forms_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_forms" ADD CONSTRAINT "campaign_forms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_form_unique" ON "campaign_forms" USING btree ("campaign_id","form_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_forms_campaign" ON "campaign_forms" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_forms_form" ON "campaign_forms" USING btree ("form_id");