-- Add reactionsEnabled column to newsletters table (optional, enabled by default)
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS reactions_enabled BOOLEAN NOT NULL DEFAULT true;

-- Create newsletter_reactions table for storing individual reactions
CREATE TABLE IF NOT EXISTS newsletter_reactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  newsletter_id VARCHAR NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  reaction_type TEXT NOT NULL, -- 'love_it', 'liked_it', 'cool', 'dont_agree', 'dislike'
  reaction_token TEXT NOT NULL UNIQUE, -- Unique token to prevent duplicate voting and for identification
  ip_address TEXT,
  user_agent TEXT,
  reacted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_newsletter_reactions_newsletter ON newsletter_reactions(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_reactions_tenant_newsletter ON newsletter_reactions(tenant_id, newsletter_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_reactions_token ON newsletter_reactions(reaction_token);
CREATE INDEX IF NOT EXISTS idx_newsletter_reactions_type ON newsletter_reactions(newsletter_id, reaction_type);

-- Unique constraint: one reaction per recipient per newsletter
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_reactions_unique_vote 
  ON newsletter_reactions(newsletter_id, recipient_email);
