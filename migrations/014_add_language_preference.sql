-- Migration: Add language preference to better_auth_user table
-- Created: 2025-09-11
-- Description: Add language field to store user's preferred language (en/es)

-- Add language column to better_auth_user table
ALTER TABLE better_auth_user 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Add check constraint to ensure only supported languages
ALTER TABLE better_auth_user 
ADD CONSTRAINT chk_user_language 
CHECK (language IN ('en', 'es'));

-- Add index for language filtering
CREATE INDEX IF NOT EXISTS idx_better_auth_user_language ON better_auth_user(language);

-- Update existing users to have default language if NULL
UPDATE better_auth_user 
SET language = 'en' 
WHERE language IS NULL;
