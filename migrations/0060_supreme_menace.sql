ALTER TABLE "blog_design" ADD COLUMN "page_background_color" text DEFAULT '#F3F4F6';--> statement-breakpoint
ALTER TABLE "blog_design" ADD COLUMN "newsletter_editor_type" text DEFAULT 'classic';--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "email_type" text DEFAULT 'newsletter';--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "archived_at" timestamp;