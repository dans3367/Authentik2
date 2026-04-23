-- Drop unused `design` column from promotions table.
-- Rationale: the column exists in the DB but was removed from shared/schema.ts,
-- causing drizzle-kit push drift. Authorized dropped 2026-04-23.
--
-- A backup of the column's current contents is saved to a dated backup table
-- so the data is recoverable if the drop turns out to be wrong.
-- To restore:
--   UPDATE promotions p
--      SET design = b.design
--     FROM _backup_promotions_design_20260423 b
--    WHERE p.id = b.id;
BEGIN;

CREATE TABLE IF NOT EXISTS _backup_promotions_design_20260423 AS
SELECT id, design FROM promotions WHERE design IS NOT NULL;

ALTER TABLE promotions DROP COLUMN IF EXISTS design;

COMMIT;
