-- Add archivedAt column to newsletters table
-- Allows sent newsletters to be archived and hidden from the main kanban view
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
