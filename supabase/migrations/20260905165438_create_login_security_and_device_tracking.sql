/*
# Login security and device tracking system

1. New Tables
- `login_history` — Records every login attempt with IP, browser, OS, device type, geolocation, and status.
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid())
  - ip_address (text)
  - browser_name (text)
  - browser_version (text)
  - operating_system (text)
  - device_type (text: Desktop, Mobile, Tablet)
  - device_model (text, nullable)
  - login_timestamp (timestamptz, default now())
  - city (text, nullable)
  - state (text, nullable)
  - country (text, nullable)
  - approximate_location (text, nullable)
  - login_status (text: success, failed_otp, otp_sent, otp_verified, failed)
  - created_at (timestamptz, default now())

- `trusted_devices` — Tracks devices that have passed OTP verification.
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid())
  - device_fingerprint (text, NOT NULL) — hash of browser+OS+device type
  - ip_address (text)
  - browser_name (text)
  - operating_system (text)
  - device_type (text)
  - city (text, nullable)
  - state (text, nullable)
  - country (text, nullable)
  - trusted_at (timestamptz, default now())
  - expires_at (timestamptz) — configurable trust period
  - is_active (boolean, default true)
  - created_at (timestamptz, default now())

- `otp_codes` — Stores OTP codes for device verification.
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid())
  - otp_code (text, NOT NULL)
  - delivery_method (text: email, sms)
  - device_fingerprint (text)
  - ip_address (text)
  - is_verified (boolean, default false)
  - verified_at (timestamptz, nullable)
  - expires_at (timestamptz)
  - created_at (timestamptz, default now())

- `user_theme_preferences` — Stores user theme preference.
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users, NOT NULL DEFAULT auth.uid(), UNIQUE)
  - theme (text: light, dark, default 'dark')
  - auto_theme (boolean, default true)
  - updated_at (timestamptz, default now())

2. Security
- RLS enabled on all tables.
- Owner-scoped CRUD policies (authenticated users can only access their own data).
- All tables have user_id DEFAULT auth.uid().

3. Notes
- login_history records all login attempts including failed OTP.
- trusted_devices has an expires_at for configurable trust period (default 30 days).
- otp_codes expire after 10 minutes.
- user_theme_preferences stores per-user theme with auto_theme flag.
*/

-- login_history
CREATE TABLE IF NOT EXISTS login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address text,
  browser_name text,
  browser_version text,
  operating_system text,
  device_type text,
  device_model text,
  login_timestamp timestamptz DEFAULT now(),
  city text,
  state text,
  country text,
  approximate_location text,
  login_status text DEFAULT 'success',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_login_history" ON login_history;
CREATE POLICY "select_own_login_history" ON login_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_login_history" ON login_history;
CREATE POLICY "insert_own_login_history" ON login_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_login_history" ON login_history;
CREATE POLICY "delete_own_login_history" ON login_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- trusted_devices
CREATE TABLE IF NOT EXISTS trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  ip_address text,
  browser_name text,
  operating_system text,
  device_type text,
  city text,
  state text,
  country text,
  trusted_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_trusted_devices" ON trusted_devices;
CREATE POLICY "select_own_trusted_devices" ON trusted_devices FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_trusted_devices" ON trusted_devices;
CREATE POLICY "insert_own_trusted_devices" ON trusted_devices FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_trusted_devices" ON trusted_devices;
CREATE POLICY "update_own_trusted_devices" ON trusted_devices FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_trusted_devices" ON trusted_devices;
CREATE POLICY "delete_own_trusted_devices" ON trusted_devices FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- otp_codes
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  otp_code text NOT NULL,
  delivery_method text DEFAULT 'email',
  device_fingerprint text,
  ip_address text,
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_otp_codes" ON otp_codes;
CREATE POLICY "select_own_otp_codes" ON otp_codes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_otp_codes" ON otp_codes;
CREATE POLICY "insert_own_otp_codes" ON otp_codes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_otp_codes" ON otp_codes;
CREATE POLICY "update_own_otp_codes" ON otp_codes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_theme_preferences
CREATE TABLE IF NOT EXISTS user_theme_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text DEFAULT 'dark',
  auto_theme boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_theme_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_theme_preferences" ON user_theme_preferences;
CREATE POLICY "select_own_theme_preferences" ON user_theme_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_theme_preferences" ON user_theme_preferences;
CREATE POLICY "insert_own_theme_preferences" ON user_theme_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_theme_preferences" ON user_theme_preferences;
CREATE POLICY "update_own_theme_preferences" ON user_theme_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_theme_preferences_user_id ON user_theme_preferences(user_id);
