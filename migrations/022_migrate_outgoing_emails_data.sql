-- Migration 022: Migrate data from outgoing_emails to new split tables
-- This migration moves existing data from the monolithic outgoing_emails table to the new structure

-- Step 1: Migrate core email data to email_sends table
INSERT INTO email_sends (
    id,
    tenant_id,
    recipient_email,
    recipient_name,
    sender_email,
    sender_name,
    subject,
    email_type,
    provider,
    provider_message_id,
    status,
    send_attempts,
    error_message,
    contact_id,
    newsletter_id,
    campaign_id,
    promotion_id,
    sent_at,
    delivered_at,
    created_at,
    updated_at
)
SELECT 
    id,
    tenant_id,
    recipient_email,
    recipient_name,
    sender_email,
    sender_name,
    subject,
    email_type,
    provider,
    provider_message_id,
    status,
    send_attempts,
    error_message,
    contact_id,
    newsletter_id,
    campaign_id,
    promotion_id,
    sent_at,
    delivered_at,
    created_at,
    updated_at
FROM outgoing_emails
WHERE NOT EXISTS (
    SELECT 1 FROM email_sends WHERE email_sends.id = outgoing_emails.id
);

-- Step 2: Migrate content data to email_content table
INSERT INTO email_content (
    email_send_id,
    html_content,
    text_content,
    provider_response,
    metadata,
    created_at
)
SELECT 
    id, -- This becomes email_send_id (foreign key)
    html_content,
    text_content,
    provider_response,
    metadata,
    created_at
FROM outgoing_emails
WHERE (html_content IS NOT NULL OR text_content IS NOT NULL OR provider_response IS NOT NULL OR metadata IS NOT NULL)
AND NOT EXISTS (
    SELECT 1 FROM email_content WHERE email_content.email_send_id = outgoing_emails.id
);

-- Step 3: Create initial email events based on status
-- For emails that were successfully sent, create a 'sent' event
INSERT INTO email_events (
    email_send_id,
    event_type,
    event_data,
    occurred_at,
    created_at
)
SELECT 
    id,
    'sent',
    json_build_object(
        'provider', provider,
        'provider_message_id', provider_message_id,
        'status', status
    )::text,
    COALESCE(sent_at, created_at),
    created_at
FROM outgoing_emails
WHERE status IN ('sent', 'delivered')
AND NOT EXISTS (
    SELECT 1 FROM email_events 
    WHERE email_events.email_send_id = outgoing_emails.id 
    AND email_events.event_type = 'sent'
);

-- For emails that were delivered, create a 'delivered' event
INSERT INTO email_events (
    email_send_id,
    event_type,
    event_data,
    occurred_at,
    created_at
)
SELECT 
    id,
    'delivered',
    json_build_object(
        'provider', provider,
        'provider_message_id', provider_message_id
    )::text,
    COALESCE(delivered_at, sent_at, created_at),
    created_at
FROM outgoing_emails
WHERE status = 'delivered' AND delivered_at IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM email_events 
    WHERE email_events.email_send_id = outgoing_emails.id 
    AND email_events.event_type = 'delivered'
);

-- For failed emails, create a 'failed' event
INSERT INTO email_events (
    email_send_id,
    event_type,
    event_data,
    occurred_at,
    created_at
)
SELECT 
    id,
    'failed',
    json_build_object(
        'error_message', error_message,
        'send_attempts', send_attempts,
        'provider', provider
    )::text,
    COALESCE(sent_at, created_at),
    created_at
FROM outgoing_emails
WHERE status = 'failed' AND error_message IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM email_events 
    WHERE email_events.email_send_id = outgoing_emails.id 
    AND email_events.event_type = 'failed'
);

-- Verification queries (commented out - uncomment to run verification)
/*
-- Verify data migration
SELECT 'email_sends' as table_name, COUNT(*) as count FROM email_sends
UNION ALL
SELECT 'email_content' as table_name, COUNT(*) as count FROM email_content
UNION ALL
SELECT 'email_events' as table_name, COUNT(*) as count FROM email_events
UNION ALL
SELECT 'outgoing_emails (original)' as table_name, COUNT(*) as count FROM outgoing_emails;

-- Check for any missing data
SELECT 
    'Missing in email_sends' as issue,
    COUNT(*) as count
FROM outgoing_emails o
LEFT JOIN email_sends es ON o.id = es.id
WHERE es.id IS NULL

UNION ALL

SELECT 
    'Missing content records' as issue,
    COUNT(*) as count
FROM outgoing_emails o
LEFT JOIN email_content ec ON o.id = ec.email_send_id
WHERE ec.email_send_id IS NULL 
AND (o.html_content IS NOT NULL OR o.text_content IS NOT NULL OR o.provider_response IS NOT NULL OR o.metadata IS NOT NULL);
*/

-- Add a comment about the migration
COMMENT ON TABLE email_sends IS 'Core email tracking table - migrated from outgoing_emails table';
COMMENT ON TABLE email_content IS 'Email content storage - migrated from outgoing_emails table';
COMMENT ON TABLE email_events IS 'Email event tracking - created from outgoing_emails status data';