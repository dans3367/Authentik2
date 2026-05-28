-- Move the per-temp-session 2FA failure counter from in-process memory
-- onto the temp_2fa_sessions row itself, so:
--   * it survives process restarts / rolling deploys,
--   * it is shared across workers / pods, and
--   * it cannot be evicted by inflating an in-memory map with bogus
--     temp tokens (a previous opportunistic 5000-key cap reset the
--     counter for evicted entries, giving attackers free retries).
--
-- /verify-2fa increments this atomically via UPDATE ... RETURNING.

ALTER TABLE temp_2fa_sessions
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
