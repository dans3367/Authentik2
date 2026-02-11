-- Migration: Add soft-lock columns for subscription downgrade handling
-- When a tenant downgrades, excess resources are soft-locked (not deleted)
-- and automatically restored if the tenant re-upgrades.

-- Add soft-lock columns to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS suspended_by_downgrade BOOLEAN DEFAULT FALSE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;

-- Add soft-lock columns to better_auth_user table
ALTER TABLE "better_auth_user" ADD COLUMN IF NOT EXISTS suspended_by_downgrade BOOLEAN DEFAULT FALSE;
ALTER TABLE "better_auth_user" ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;

-- Add downgrade scheduling columns to subscriptions table
-- These columns enable future scheduled downgrade functionality
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS downgrade_target_plan_id VARCHAR;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS downgrade_scheduled_at TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS previous_plan_id VARCHAR;

-- Add indexes for efficient filtering of suspended resources
CREATE INDEX IF NOT EXISTS idx_shops_suspended ON shops (tenant_id, suspended_by_downgrade) WHERE suspended_by_downgrade = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_suspended ON "better_auth_user" (tenant_id, suspended_by_downgrade) WHERE suspended_by_downgrade = TRUE;
CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_downgrade ON subscriptions (downgrade_target_plan_id) WHERE downgrade_target_plan_id IS NOT NULL;
