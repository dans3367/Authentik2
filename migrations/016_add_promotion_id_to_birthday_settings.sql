-- Migration: Add promotion_id column to birthday_settings table
-- This migration adds the promotion_id foreign key to link birthday settings with promotions

ALTER TABLE birthday_settings 
ADD COLUMN promotion_id VARCHAR REFERENCES promotions(id) ON DELETE SET NULL;

-- Add comment to document the new field
COMMENT ON COLUMN birthday_settings.promotion_id IS 'Optional promotion to include in birthday emails';

-- Create index for better query performance
CREATE INDEX idx_birthday_settings_promotion_id ON birthday_settings(promotion_id);