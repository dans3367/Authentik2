-- Add retention metadata fields for newsletter reaction request identifiers
-- GDPR policy: ip_address and user_agent should be anonymized after retention window.
ALTER TABLE newsletter_reactions
  ADD COLUMN IF NOT EXISTS reacted_retention_expires TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reacted_anonymized_at TIMESTAMP;

-- Backfill retention expiry for existing rows based on reacted_at + 12 months.
UPDATE newsletter_reactions
SET reacted_retention_expires = reacted_at + INTERVAL '12 months'
WHERE reacted_retention_expires IS NULL;

-- Index to support scheduled anonymization scans.
CREATE INDEX IF NOT EXISTS idx_newsletter_reactions_retention
  ON newsletter_reactions(reacted_retention_expires);
