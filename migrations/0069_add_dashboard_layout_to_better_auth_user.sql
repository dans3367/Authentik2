-- Add dashboard_layout column to better_auth_user for per-user dashboard card order and sizes
ALTER TABLE better_auth_user ADD COLUMN IF NOT EXISTS dashboard_layout JSONB;
