-- Add description column to contact_tags table
ALTER TABLE contact_tags ADD COLUMN description text;

-- Add comment to describe the new column
COMMENT ON COLUMN contact_tags.description IS 'Optional description for the contact tag';
