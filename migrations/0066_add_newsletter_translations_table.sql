-- Newsletter translations cache table
CREATE TABLE IF NOT EXISTS "newsletter_translations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "newsletter_id" varchar NOT NULL REFERENCES "newsletters"("id") ON DELETE CASCADE,
  "source_language" text NOT NULL DEFAULT 'en',
  "target_language" text NOT NULL,
  "translated_subject" text NOT NULL,
  "translated_content" text NOT NULL,
  "content_hash" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Unique index: one translation per newsletter per target language
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_translations_unique_idx" ON "newsletter_translations" ("newsletter_id", "target_language");
