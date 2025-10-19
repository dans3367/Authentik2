-- Migration: Update default tenant_id to use Default Organization
-- This ensures new users get assigned to an existing tenant temporarily
-- The signup hook will then create their own tenant and update their record

-- Update the default value for tenant_id column
ALTER TABLE better_auth_user 
ALTER COLUMN tenant_id SET DEFAULT '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff';

-- Update the default role to Owner (new users should own their tenant)
ALTER TABLE better_auth_user 
ALTER COLUMN role SET DEFAULT 'Owner';

-- Note: Existing users are not affected by this change
-- Only new signups will get the new default values
-- The signup hook will immediately create a new tenant and update the tenant_id

