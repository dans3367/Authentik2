ALTER TABLE "newsletters" ALTER COLUMN "reviewer_approval_code" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "decline_reason" text;