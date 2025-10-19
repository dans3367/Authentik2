-- Migration: Add templates table for email template management
-- This migration creates the templates table with proper tenant isolation
-- to ensure templates are only accessible within their respective tenants

CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL,
    name TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('individual', 'promotional', 'newsletter', 'transactional')),
    category TEXT NOT NULL CHECK (category IN ('welcome', 'retention', 'seasonal', 'update', 'custom')),
    subject_line TEXT NOT NULL,
    preview TEXT,
    body TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP,
    is_favorite BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT templates_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT templates_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES better_auth_user(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS templates_tenant_id_idx ON templates(tenant_id);
CREATE INDEX IF NOT EXISTS templates_user_id_idx ON templates(user_id);
CREATE INDEX IF NOT EXISTS templates_channel_idx ON templates(channel);
CREATE INDEX IF NOT EXISTS templates_category_idx ON templates(category);
CREATE INDEX IF NOT EXISTS templates_is_favorite_idx ON templates(is_favorite);
CREATE INDEX IF NOT EXISTS templates_is_active_idx ON templates(is_active);
CREATE INDEX IF NOT EXISTS templates_created_at_idx ON templates(created_at);
CREATE INDEX IF NOT EXISTS templates_usage_count_idx ON templates(usage_count);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS templates_tenant_active_idx ON templates(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS templates_tenant_channel_idx ON templates(tenant_id, channel);
CREATE INDEX IF NOT EXISTS templates_tenant_category_idx ON templates(tenant_id, category);
CREATE INDEX IF NOT EXISTS templates_tenant_favorite_idx ON templates(tenant_id, is_favorite);

-- Text search index for name, subject_line, and preview
CREATE INDEX IF NOT EXISTS templates_search_idx ON templates USING GIN (
    to_tsvector('english', name || ' ' || subject_line || ' ' || COALESCE(preview, ''))
);

-- Add RLS policy for tenant isolation (if RLS is enabled)
-- This ensures users can only see templates from their own tenant
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY templates_tenant_isolation ON templates
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER templates_updated_at_trigger
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_templates_updated_at();

-- Trigger to automatically update usage_count and last_used when template is used
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE templates 
    SET usage_count = usage_count + 1,
        last_used = NOW(),
        updated_at = NOW()
    WHERE id = NEW.template_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- This trigger would be used when tracking template usage in other tables
-- For now, we'll handle usage tracking manually in the application