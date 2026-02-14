-- Add puck_data column to newsletters table for storing Puck editor JSON state
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS puck_data text;
