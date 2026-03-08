CREATE TABLE "blog_design" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"company_name" text DEFAULT '',
	"header_mode" text DEFAULT 'logo',
	"logo_url" text,
	"logo_size" text DEFAULT 'medium',
	"logo_alignment" text DEFAULT 'center',
	"banner_url" text,
	"show_company_name" text DEFAULT 'true',
	"primary_color" text DEFAULT '#3B82F6',
	"secondary_color" text DEFAULT '#1E40AF',
	"accent_color" text DEFAULT '#10B981',
	"font_family" text DEFAULT 'Arial, sans-serif',
	"header_text" text,
	"footer_text" text,
	"social_links" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "blog_design_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "web_slug" text;--> statement-breakpoint
ALTER TABLE "blog_design" ADD CONSTRAINT "blog_design_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;