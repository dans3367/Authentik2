-- Migration: Add newsletter reviewer approval workflow
-- Adds reviewer fields to newsletters table and a new newsletter_reviewer_settings table

-- Add reviewer columns to newsletters table
ALTER TABLE "newsletters" ADD COLUMN IF NOT EXISTS "requires_reviewer_approval" boolean DEFAULT false;
ALTER TABLE "newsletters" ADD COLUMN IF NOT EXISTS "reviewer_id" varchar REFERENCES "user"("id");
ALTER TABLE "newsletters" ADD COLUMN IF NOT EXISTS "review_status" text DEFAULT 'pending';
ALTER TABLE "newsletters" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;
ALTER TABLE "newsletters" ADD COLUMN IF NOT EXISTS "review_notes" text;

-- Create newsletter_reviewer_settings table for tenant-wide reviewer configuration
CREATE TABLE IF NOT EXISTS "newsletter_reviewer_settings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE UNIQUE,
  "enabled" boolean NOT NULL DEFAULT false,
  "reviewer_id" varchar REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
