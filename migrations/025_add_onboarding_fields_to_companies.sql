-- Migration: Add onboarding wizard fields to companies table
-- This enables the onboarding modal for new signups

ALTER TABLE "companies" 
ADD COLUMN IF NOT EXISTS "setup_completed" boolean DEFAULT false;

ALTER TABLE "companies" 
ADD COLUMN IF NOT EXISTS "geographical_location" text;

ALTER TABLE "companies" 
ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'en';

ALTER TABLE "companies" 
ADD COLUMN IF NOT EXISTS "business_description" text;

