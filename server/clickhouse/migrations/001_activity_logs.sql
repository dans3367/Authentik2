-- ClickHouse: Activity Logs Table
-- Replaces Axiom dataset "activity-logs" for analytics queries.
-- PostgreSQL activity_logs table remains the primary store.

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT generateUUIDv4(),
    tenant_id String,
    user_id Nullable(String),
    entity_type String,
    entity_id Nullable(String),
    entity_name Nullable(String),
    activity_type String,
    description Nullable(String),
    changes Nullable(String),
    metadata Nullable(String),
    ip_address Nullable(String),
    user_agent Nullable(String),
    created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (tenant_id, created_at, entity_type)
TTL created_at + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- Note: tokenbf_v1 bloom filter indexes require non-Nullable String columns.
-- Full-text search uses ILIKE which works without indexes at this scale.
-- If search performance degrades, consider changing description/entity_name
-- to `String DEFAULT ''` and adding bloom filter indexes.
