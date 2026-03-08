CREATE UNIQUE INDEX IF NOT EXISTS "newsletters_tenant_web_slug_idx" ON "newsletters" ("tenant_id", "web_slug") WHERE "web_slug" IS NOT NULL;
