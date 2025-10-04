-- Migration: Add split_promotional_email column to birthday_settings table
-- This enables sending birthday cards and promotions as separate emails for better deliverability

ALTER TABLE birthday_settings 
ADD COLUMN IF NOT EXISTS split_promotional_email BOOLEAN DEFAULT false;

COMMENT ON COLUMN birthday_settings.split_promotional_email IS 'When enabled, sends birthday card and promotional email separately to improve deliverability';
