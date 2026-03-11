ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS email_type TEXT DEFAULT 'newsletter';
UPDATE newsletters SET email_type = 'newsletter' WHERE email_type IS NULL;
