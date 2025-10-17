-- Migration: Add disabled_holidays column to birthday_settings table
-- This allows users to disable specific holiday card sends

-- Add the disabled_holidays column as an array of text
ALTER TABLE birthday_settings
ADD COLUMN IF NOT EXISTS disabled_holidays text[];

-- Add comment to explain the column
COMMENT ON COLUMN birthday_settings.disabled_holidays IS 'Array of disabled holiday IDs (e.g., [''valentine'', ''stpatrick'']) - when a holiday is in this array, cards for that holiday will not be sent';
