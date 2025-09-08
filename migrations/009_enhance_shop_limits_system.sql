-- Migration: 009_enhance_shop_limits_system.sql
-- Purpose: Create a robust shop limits system with tenant-specific overrides
-- Date: 2024-01-15

-- Add tenant-specific shop limits table for custom overrides
CREATE TABLE IF NOT EXISTS tenant_limits (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    max_shops INTEGER, -- NULL means use subscription plan limit
    max_users INTEGER, -- NULL means use subscription plan limit
    max_storage_gb INTEGER, -- NULL means use subscription plan limit
    custom_limits JSONB DEFAULT '{}', -- For future extensibility
    override_reason TEXT, -- Why this tenant has custom limits
    created_by VARCHAR REFERENCES better_auth_user(id) ON DELETE SET NULL,
    expires_at TIMESTAMP, -- NULL means no expiration
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_limits_tenant_id ON tenant_limits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_limits_active ON tenant_limits(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_limits_expires_at ON tenant_limits(expires_at);

-- Add shop limit tracking table for audit and analytics
CREATE TABLE IF NOT EXISTS shop_limit_events (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR NOT NULL CHECK (event_type IN ('limit_reached', 'limit_exceeded', 'limit_increased', 'limit_decreased', 'shop_created', 'shop_deleted')),
    shop_count INTEGER NOT NULL,
    limit_value INTEGER, -- The limit at the time of the event
    subscription_plan_id VARCHAR REFERENCES subscription_plans(id) ON DELETE SET NULL,
    custom_limit_id VARCHAR REFERENCES tenant_limits(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}', -- Additional event data
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_shop_limit_events_tenant_id ON shop_limit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shop_limit_events_type ON shop_limit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_shop_limit_events_created_at ON shop_limit_events(created_at);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tenant_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenant_limits_updated_at
    BEFORE UPDATE ON tenant_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_limits_updated_at();

-- Add function to get effective shop limit for a tenant
CREATE OR REPLACE FUNCTION get_effective_shop_limit(p_tenant_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    custom_limit INTEGER;
    subscription_limit INTEGER;
    result_limit INTEGER;
BEGIN
    -- Check for active custom tenant limit
    SELECT tl.max_shops INTO custom_limit
    FROM tenant_limits tl
    WHERE tl.tenant_id = p_tenant_id
      AND tl.is_active = true
      AND (tl.expires_at IS NULL OR tl.expires_at > NOW());
    
    -- If custom limit exists, use it
    IF custom_limit IS NOT NULL THEN
        RETURN custom_limit;
    END IF;
    
    -- Otherwise, get limit from active subscription
    SELECT sp.max_shops INTO subscription_limit
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.tenant_id = p_tenant_id
      AND s.status = 'active'
      AND sp.is_active = true
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    -- Return subscription limit or default
    RETURN COALESCE(subscription_limit, 5); -- Default to 5 shops
END;
$$ LANGUAGE plpgsql;

-- Add function to check if tenant can add more shops
CREATE OR REPLACE FUNCTION can_tenant_add_shop(p_tenant_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    max_limit INTEGER;
BEGIN
    -- Get current shop count
    SELECT COUNT(*) INTO current_count
    FROM shops
    WHERE tenant_id = p_tenant_id
      AND is_active = true;
    
    -- Get effective limit
    SELECT get_effective_shop_limit(p_tenant_id) INTO max_limit;
    
    -- NULL limit means unlimited
    IF max_limit IS NULL THEN
        RETURN true;
    END IF;
    
    -- Check if under limit
    RETURN current_count < max_limit;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to prevent exceeding shop limits (optional - can be enforced in application)
-- This is commented out as it might be too restrictive for some use cases
-- CREATE OR REPLACE FUNCTION enforce_shop_limit()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NOT can_tenant_add_shop(NEW.tenant_id) THEN
--         RAISE EXCEPTION 'Shop limit exceeded for tenant %', NEW.tenant_id;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- CREATE TRIGGER trigger_enforce_shop_limit
--     BEFORE INSERT ON shops
--     FOR EACH ROW
--     EXECUTE FUNCTION enforce_shop_limit();

-- Insert default subscription plans with updated shop limits
INSERT INTO subscription_plans (
    name, display_name, description, price, yearly_price,
    stripe_price_id, stripe_yearly_price_id, features,
    max_users, max_shops, storage_limit, support_level,
    trial_days, is_popular, is_active, sort_order
) VALUES 
(
    'basic', 'Basic Plan', 'Perfect for small businesses getting started',
    29.99, 299.99, 'price_basic_monthly', 'price_basic_yearly',
    ARRAY['Up to 5 shops', 'Up to 10 users', 'Basic email support', '10GB storage', 'Standard analytics'],
    10, 5, 10, 'email', 14, false, true, 1
),
(
    'professional', 'Professional Plan', 'Ideal for growing businesses with multiple locations',
    79.99, 799.99, 'price_pro_monthly', 'price_pro_yearly',
    ARRAY['Up to 10 shops', 'Up to 25 users', 'Priority email support', '50GB storage', 'Advanced analytics', 'Custom branding'],
    25, 10, 50, 'priority', 14, true, true, 2
),
(
    'enterprise', 'Enterprise Plan', 'For large organizations with extensive needs',
    199.99, 1999.99, 'price_enterprise_monthly', 'price_enterprise_yearly',
    ARRAY['Up to 20 shops', 'Unlimited users', 'Dedicated support', '200GB storage', 'Premium analytics', 'Custom integrations', 'White-label options'],
    NULL, 20, 200, 'dedicated', 14, false, true, 3
)
ON CONFLICT (name) DO UPDATE SET
    max_shops = EXCLUDED.max_shops,
    features = EXCLUDED.features,
    updated_at = NOW();

-- Add comments for documentation
COMMENT ON TABLE tenant_limits IS 'Custom limit overrides for specific tenants';
COMMENT ON TABLE shop_limit_events IS 'Audit log for shop limit related events';
COMMENT ON FUNCTION get_effective_shop_limit(VARCHAR) IS 'Returns the effective shop limit for a tenant, considering custom overrides and subscription plans';
COMMENT ON FUNCTION can_tenant_add_shop(VARCHAR) IS 'Checks if a tenant can add another shop based on their current limit';