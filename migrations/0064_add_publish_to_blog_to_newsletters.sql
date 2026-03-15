-- Add publish_to_blog column to newsletters table
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS publish_to_blog BOOLEAN NOT NULL DEFAULT true;
