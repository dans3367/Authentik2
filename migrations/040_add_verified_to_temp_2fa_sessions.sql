-- Add verified column to temp_2fa_sessions table
-- This moves 2FA verification state from in-memory to database for persistence across restarts

ALTER TABLE temp_2fa_sessions ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups by session token and verified status
CREATE INDEX IF NOT EXISTS idx_temp_2fa_sessions_verified ON temp_2fa_sessions(session_token, verified);
