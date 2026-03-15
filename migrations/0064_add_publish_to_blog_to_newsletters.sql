-- Add publish_to_blog, published_at, and web_slug columns to newsletters table
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS publish_to_blog BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS web_slug TEXT;

-- Add unique index on (tenant_id, web_slug) where web_slug is not null
CREATE UNIQUE INDEX IF NOT EXISTS newsletters_tenant_web_slug_idx ON newsletters (tenant_id, web_slug) WHERE web_slug IS NOT NULL;
