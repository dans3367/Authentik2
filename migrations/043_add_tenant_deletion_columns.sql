-- Account deletion flow (30-day grace period)
-- When an Owner requests account deletion, the tenant is soft-marked for deletion
-- and a scheduled purge worker hard-deletes it after the grace period expires.
-- See server/services/tenantDeletionService.ts and server/workers/tenantPurgeWorker.ts

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "deletion_scheduled_at" timestamp;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "deletion_requested_by_user_id" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "deletion_reason" text;

-- Index so the purge worker can efficiently find tenants past their grace period
CREATE INDEX IF NOT EXISTS "idx_tenants_deletion_scheduled_at"
  ON "tenants" ("deletion_scheduled_at")
  WHERE "deletion_scheduled_at" IS NOT NULL;
