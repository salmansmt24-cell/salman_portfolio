-- BMS login throttling. Stores only hashed keys, not email or raw IP.
CREATE TABLE IF NOT EXISTS bms_auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bms_auth_rate_limits_blocked_idx
  ON bms_auth_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;
