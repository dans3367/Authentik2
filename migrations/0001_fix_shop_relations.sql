-- Migration: Fix shop relations schema
-- Date: 2025-01-08
-- Description: Ensure shops table relations are properly configured

-- Verify shops table exists with correct structure
DO $$
BEGIN
    -- Check if shops table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shops') THEN
        RAISE EXCEPTION 'Shops table does not exist';
    END IF;
    
    -- Verify foreign key constraints exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'shops' 
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'tenant_id'
    ) THEN
        RAISE EXCEPTION 'Missing foreign key constraint: shops.tenant_id -> tenants.id';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'shops' 
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'manager_id'
    ) THEN
        RAISE EXCEPTION 'Missing foreign key constraint: shops.manager_id -> better_auth_user.id';
    END IF;
    
    RAISE NOTICE 'Shop relations schema verification completed successfully';
END
$$;

-- Add any missing indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_tenant_id ON shops(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_manager_id ON shops(manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_status ON shops(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_is_active ON shops(is_active);

-- Update any existing shops with NULL status to 'active'
UPDATE shops SET status = 'active' WHERE status IS NULL;

-- Update any existing shops with NULL is_active to true
UPDATE shops SET is_active = true WHERE is_active IS NULL;

COMMIT;