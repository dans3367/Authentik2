ALTER TABLE "email_contacts" ADD COLUMN IF NOT EXISTS "preferred_language" text DEFAULT 'en';
