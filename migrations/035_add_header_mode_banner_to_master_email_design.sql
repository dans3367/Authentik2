-- Add header_mode and banner_url columns to master_email_design table
ALTER TABLE "master_email_design" ADD COLUMN IF NOT EXISTS "header_mode" text DEFAULT 'logo';
ALTER TABLE "master_email_design" ADD COLUMN IF NOT EXISTS "banner_url" text;
