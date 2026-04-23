-- Remember each user's last selected shop so the choice survives logout/login.
-- Null = "All Shops" (the default).
ALTER TABLE better_auth_user
  ADD COLUMN IF NOT EXISTS last_selected_shop_id VARCHAR
  REFERENCES shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_better_auth_user_last_selected_shop_id
  ON better_auth_user(last_selected_shop_id);
