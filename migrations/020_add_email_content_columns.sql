-- Add email content columns to outgoing_emails table
ALTER TABLE outgoing_emails 
ADD COLUMN html_content TEXT,
ADD COLUMN text_content TEXT;

-- Add index for searching email content (useful for debugging)
CREATE INDEX idx_outgoing_emails_subject_search ON outgoing_emails USING gin(to_tsvector('english', subject));

-- Optional: Add comment explaining the columns
COMMENT ON COLUMN outgoing_emails.html_content IS 'Full HTML content of the email';
COMMENT ON COLUMN outgoing_emails.text_content IS 'Plain text content of the email';
