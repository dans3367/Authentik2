-- Campaign-Newsletter junction table for aggregating newsletter analytics across campaigns
CREATE TABLE IF NOT EXISTS "campaign_newsletters" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" varchar NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "newsletter_id" varchar NOT NULL REFERENCES "newsletters"("id") ON DELETE CASCADE,
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "added_at" timestamp DEFAULT now()
);

-- Unique constraint: a newsletter can only be in a campaign once
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_newsletter_unique" ON "campaign_newsletters" ("campaign_id", "newsletter_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_newsletters_campaign" ON "campaign_newsletters" ("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_newsletters_newsletter" ON "campaign_newsletters" ("newsletter_id");
