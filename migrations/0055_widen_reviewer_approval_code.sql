-- Migration: Change reviewer_approval_code from varchar(5) to text
-- Reason: Now storing SHA-256 hash (64 hex chars) instead of plaintext 5-digit code
ALTER TABLE "newsletters" ALTER COLUMN "reviewer_approval_code" TYPE text;
