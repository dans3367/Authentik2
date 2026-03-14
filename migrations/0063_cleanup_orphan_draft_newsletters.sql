-- Clean up orphan "Untitled Newsletter" drafts created by auto-save
-- These are empty/default drafts that accumulate when users open the editor
DELETE FROM newsletters
WHERE status = 'draft'
  AND title = 'Untitled Newsletter'
  AND deleted_at IS NULL
  AND archived_at IS NULL;
