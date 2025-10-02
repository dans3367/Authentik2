-- Migration: Remove send_days_before column from birthday_settings table
-- This migration removes the "Send Days Before Birthday" feature from birthday card settings

ALTER TABLE birthday_settings DROP COLUMN IF EXISTS send_days_before;