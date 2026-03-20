-- Add mask column to contact_custom_fields for format subtypes (phone mask, multi-line text, date+time, etc.)
ALTER TABLE contact_custom_fields ADD COLUMN IF NOT EXISTS mask TEXT;
