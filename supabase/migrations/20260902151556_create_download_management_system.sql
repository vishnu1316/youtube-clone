/*
# Video Download Management System

## Overview
Creates a controlled download system with subscription-tier-based limits.
Free users get 1 download/day; Bronze/Silver/Gold get higher limits.
Tracks every download with full audit data (IP, device, browser, plan).

## New Tables

### subscription_plans
- `id` (uuid, PK)
- `name` (text) - 'free', 'bronze', 'silver', 'gold'
- `daily_download_limit` (int) - max downloads per day
- `monthly_download_limit` (int) - max downloads per month (0 = unlimited)
- `price` (numeric) - plan price
- `description` (text)
- `created_at` (timestamptz)

### user_subscriptions
- `id` (uuid, PK)
- `user_id` (uuid, FK auth.users)
- `plan_id` (uuid, FK subscription_plans)
- `status` (text) - 'active', 'expired', 'cancelled'
- `started_at` (timestamptz)
- `expires_at` (timestamptz, nullable)
- `created_at` (timestamptz)

### download_records
- `id` (uuid, PK)
- `user_id` (uuid, FK auth.users)
- `video_id` (uuid, FK videos)
- `downloaded_at` (timestamptz)
- `ip_address` (text)
- `device_info` (text)
- `browser` (text)
- `plan_used` (text) - which plan was active during download
- `status` (text) - 'completed', 'failed', 'interrupted'
- `file_size` (text, nullable)
- `created_at` (timestamptz)

## Security (RLS)
- subscription_plans: public SELECT (anyone can see plans)
- user_subscriptions: owner SELECT/INSERT, no update (managed via edge function)
- download_records: owner SELECT/INSERT, no update (immutable audit log)

## Important Notes
1. Plans are seeded with default limits: free=1/day, bronze=5/day, silver=20/day, gold=50/day
2. download_records is an immutable audit trail - no UPDATE or DELETE policies
3. user_subscriptions tracks active/expired status for quota enforcement
4. Daily quota resets are computed by querying today's downloads, not by a cron job
5. Duplicate downloads within the same day do NOT count against quota (checked by edge function)
*/

-- subscription_plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  daily_download_limit int NOT NULL DEFAULT 1,
  monthly_download_limit int NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_subscription_plans" ON subscription_plans;
CREATE POLICY "public_select_subscription_plans" ON subscription_plans FOR SELECT
  TO anon, authenticated USING (true);

-- Seed plans
INSERT INTO subscription_plans (name, daily_download_limit, monthly_download_limit, price, description)
VALUES
  ('free', 1, 0, 0, 'Free plan - 1 download per day'),
  ('bronze', 5, 0, 4.99, 'Bronze plan - 5 downloads per day'),
  ('silver', 20, 0, 9.99, 'Silver plan - 20 downloads per day'),
  ('gold', 50, 0, 19.99, 'Gold plan - 50 downloads per day')
ON CONFLICT (name) DO NOTHING;

-- user_subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_user_subscriptions" ON user_subscriptions;
CREATE POLICY "owner_select_user_subscriptions" ON user_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_insert_user_subscriptions" ON user_subscriptions;
CREATE POLICY "owner_insert_user_subscriptions" ON user_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- download_records
CREATE TABLE IF NOT EXISTS download_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  ip_address text NOT NULL DEFAULT '',
  device_info text NOT NULL DEFAULT '',
  browser text NOT NULL DEFAULT '',
  plan_used text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'interrupted')),
  file_size text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE download_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_download_records" ON download_records;
CREATE POLICY "owner_select_download_records" ON download_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_insert_download_records" ON download_records;
CREATE POLICY "owner_insert_download_records" ON download_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_download_records_user_id ON download_records(user_id);
CREATE INDEX IF NOT EXISTS idx_download_records_video_id ON download_records(video_id);
CREATE INDEX IF NOT EXISTS idx_download_records_downloaded_at ON download_records(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
