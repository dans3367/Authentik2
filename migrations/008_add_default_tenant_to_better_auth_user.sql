-- Add default value for tenant_id in better_auth_user table
ALTER TABLE better_auth_user
ALTER COLUMN tenant_id SET DEFAULT 'default-tenant-id';

-- Update any existing rows that have NULL tenant_id
UPDATE better_auth_user
SET tenant_id = 'default-tenant-id'
WHERE tenant_id IS NULL;




