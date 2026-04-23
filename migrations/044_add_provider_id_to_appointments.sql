-- Add provider_id to appointments for assigning a responsible/owning user.
-- Nullable: existing rows + newly-created appointments may have no provider.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS provider_id VARCHAR
  REFERENCES better_auth_user(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_provider_id
  ON appointments(provider_id);
