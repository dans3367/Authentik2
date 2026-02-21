-- Migration: Add 5-digit reviewer approval code to newsletters
-- When a newsletter is submitted for review, a random 5-digit code is generated.
-- The reviewer must enter this code to approve and send the newsletter.

ALTER TABLE "newsletters" ADD COLUMN IF NOT EXISTS "reviewer_approval_code" varchar(5);
