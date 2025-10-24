-- Migration: Add segment_lists table for customer segmentation
-- This allows users to create and manage customer segments for targeted email campaigns

-- Create the segment_lists table
CREATE TABLE IF NOT EXISTS segment_lists (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('all', 'selected', 'tags')),
  selected_contact_ids TEXT[] DEFAULT '{}',
  selected_tag_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_segment_lists_tenant_id ON segment_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_segment_lists_type ON segment_lists(type);
CREATE INDEX IF NOT EXISTS idx_segment_lists_created_at ON segment_lists(created_at DESC);

-- Add comments to explain the table and columns
COMMENT ON TABLE segment_lists IS 'Customer segmentation lists for targeted email campaigns and newsletters';
COMMENT ON COLUMN segment_lists.type IS 'Type of segmentation: all (all customers), selected (specific customers), tags (customers with specific tags)';
COMMENT ON COLUMN segment_lists.selected_contact_ids IS 'Array of contact IDs when type is ''selected''';
COMMENT ON COLUMN segment_lists.selected_tag_ids IS 'Array of tag IDs when type is ''tags''';
