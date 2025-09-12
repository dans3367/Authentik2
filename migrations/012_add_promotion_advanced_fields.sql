-- Add advanced fields to promotions table for max uses and validity dates

ALTER TABLE "promotions" 
ADD COLUMN "max_uses" integer,
ADD COLUMN "valid_from" timestamp,
ADD COLUMN "valid_to" timestamp;

-- Create indexes for better query performance on new fields
CREATE INDEX IF NOT EXISTS "promotions_valid_from_idx" ON "promotions" ("valid_from");
CREATE INDEX IF NOT EXISTS "promotions_valid_to_idx" ON "promotions" ("valid_to");
CREATE INDEX IF NOT EXISTS "promotions_max_uses_idx" ON "promotions" ("max_uses");

-- Create a composite index for checking promotion validity
CREATE INDEX IF NOT EXISTS "promotions_validity_idx" ON "promotions" ("valid_from", "valid_to", "is_active");

