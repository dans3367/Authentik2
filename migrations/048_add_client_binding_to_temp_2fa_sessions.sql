-- Bind temp 2FA sessions to the originating client (IP + User-Agent)
-- so a leaked tempSessionToken cannot be redeemed from a different
-- device/network. Stored as a SHA-256 hex digest over `${ip}|${ua}`.

ALTER TABLE temp_2fa_sessions
  ADD COLUMN IF NOT EXISTS client_binding TEXT;
