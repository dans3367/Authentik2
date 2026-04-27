ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "recurrence_frequency" text NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS "recurrence_interval" integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS "recurrence_count" integer,
ADD COLUMN IF NOT EXISTS "recurrence_end_date" timestamp,
ADD COLUMN IF NOT EXISTS "recurrence_series_id" text,
ADD COLUMN IF NOT EXISTS "recurrence_parent_id" text;

