-- Migration: Create local PostgreSQL copies of Convex newsletter tracking tables
-- Purpose: Backup/mirror for Convex data so webhook processing can also write to Postgres

-- 1. Newsletter Sends (mirrors Convex newsletterSends)
CREATE TABLE IF NOT EXISTS convex_newsletter_sends (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  convex_id TEXT UNIQUE,                             -- Original Convex _id
  tenant_id VARCHAR NOT NULL,
  newsletter_id VARCHAR NOT NULL,
  group_uuid TEXT NOT NULL,                          -- Batch group identifier from Trigger.dev
  recipient_email TEXT NOT NULL,
  recipient_id TEXT,                                 -- Contact ID from PostgreSQL
  recipient_name TEXT,
  provider_message_id TEXT,                          -- Resend email ID
  status TEXT NOT NULL DEFAULT 'queued',             -- queued, sent, delivered, opened, clicked, bounced, failed, complained, suppressed
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes matching Convex indexes
CREATE INDEX IF NOT EXISTS idx_cvx_sends_newsletter ON convex_newsletter_sends(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_cvx_sends_tenant_newsletter ON convex_newsletter_sends(tenant_id, newsletter_id);
CREATE INDEX IF NOT EXISTS idx_cvx_sends_provider_message ON convex_newsletter_sends(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_cvx_sends_recipient ON convex_newsletter_sends(tenant_id, recipient_email);
CREATE INDEX IF NOT EXISTS idx_cvx_sends_recipient_newsletter ON convex_newsletter_sends(recipient_email, newsletter_id);
CREATE INDEX IF NOT EXISTS idx_cvx_sends_status ON convex_newsletter_sends(newsletter_id, status);
CREATE INDEX IF NOT EXISTS idx_cvx_sends_recipient_email ON convex_newsletter_sends(recipient_email);
CREATE INDEX IF NOT EXISTS idx_cvx_sends_newsletter_recipient ON convex_newsletter_sends(newsletter_id, recipient_email);

-- 2. Newsletter Events (mirrors Convex newsletterEvents)
CREATE TABLE IF NOT EXISTS convex_newsletter_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  convex_id TEXT UNIQUE,                             -- Original Convex _id
  tenant_id VARCHAR NOT NULL,
  newsletter_id VARCHAR NOT NULL,
  newsletter_send_id VARCHAR,                        -- Reference to convex_newsletter_sends
  recipient_email TEXT NOT NULL,
  event_type TEXT NOT NULL,                          -- sent, delivered, opened, clicked, bounced, complained, unsubscribed, failed
  provider_message_id TEXT,
  metadata JSONB,                                    -- Extra event data (link clicked, user agent, IP, etc.)
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes matching Convex indexes
CREATE INDEX IF NOT EXISTS idx_cvx_events_newsletter ON convex_newsletter_events(newsletter_id);
CREATE INDEX IF NOT EXISTS idx_cvx_events_tenant_newsletter ON convex_newsletter_events(tenant_id, newsletter_id);
CREATE INDEX IF NOT EXISTS idx_cvx_events_send ON convex_newsletter_events(newsletter_send_id);
CREATE INDEX IF NOT EXISTS idx_cvx_events_type ON convex_newsletter_events(newsletter_id, event_type);
CREATE INDEX IF NOT EXISTS idx_cvx_events_occurred ON convex_newsletter_events(newsletter_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_cvx_events_provider_event ON convex_newsletter_events(provider_message_id, event_type);
CREATE INDEX IF NOT EXISTS idx_cvx_events_recipient_newsletter_event ON convex_newsletter_events(recipient_email, newsletter_id, event_type);

-- 3. Newsletter Stats (mirrors Convex newsletterStats)
CREATE TABLE IF NOT EXISTS convex_newsletter_stats (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  convex_id TEXT UNIQUE,                             -- Original Convex _id
  tenant_id VARCHAR NOT NULL,
  newsletter_id VARCHAR NOT NULL UNIQUE,             -- One stats row per newsletter
  status TEXT NOT NULL DEFAULT 'sending',            -- sending, sent, completed
  total_recipients INTEGER NOT NULL DEFAULT 0,
  queued INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  unique_opens INTEGER NOT NULL DEFAULT 0,
  clicked INTEGER NOT NULL DEFAULT 0,
  unique_clicks INTEGER NOT NULL DEFAULT 0,
  bounced INTEGER NOT NULL DEFAULT 0,
  complained INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  suppressed INTEGER DEFAULT 0,
  unsubscribed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (newsletter_id already indexed by its UNIQUE constraint above)
CREATE INDEX IF NOT EXISTS idx_cvx_stats_tenant ON convex_newsletter_stats(tenant_id);
