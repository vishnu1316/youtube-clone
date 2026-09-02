/*
# Comprehensive Subscription Management System

## Overview
Enhances the existing subscription_plans table with detailed feature sets, streaming quality,
watch time limits, and validity periods. Creates payment_transactions table for Razorpay
payment audit trail.

## Changes to subscription_plans
- Add `streaming_quality` (text) - max quality allowed
- Add `max_watch_hours` (int) - daily watch hour limit (0 = unlimited)
- Add `ad_free` (boolean) - whether plan is ad-free
- Add `offline_downloads` (boolean) - whether offline downloads allowed
- Add `priority_content` (boolean) - priority access to new content
- Add `premium_courses` (boolean) - access to exclusive courses
- Add `faster_streaming` (boolean) - enhanced streaming speeds
- Add `features` (jsonb) - array of feature descriptions for display
- Add `validity_period` (text) - 'monthly', 'quarterly', 'yearly'
- Add `sort_order` (int) - display ordering

## New Table: payment_transactions
- Full Razorpay payment audit trail
- Stores payment_id, order_id, invoice_number, amount, currency, status
- Links to user and subscription plan
- Tracks subscription start/expiry dates

## Security (RLS)
- payment_transactions: owner SELECT only, INSERT via service role (edge function)
- subscription_plans: public SELECT
*/

-- Enhance subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS streaming_quality text DEFAULT '480p',
  ADD COLUMN IF NOT EXISTS max_watch_hours int DEFAULT 4,
  ADD COLUMN IF NOT EXISTS ad_free boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS offline_downloads boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_content boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_courses boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS faster_streaming boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validity_period text DEFAULT 'monthly' CHECK (validity_period IN ('monthly', 'quarterly', 'yearly')),
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- Update plan data
UPDATE subscription_plans SET
  streaming_quality = '480p',
  max_watch_hours = 4,
  ad_free = false,
  offline_downloads = false,
  priority_content = false,
  premium_courses = false,
  faster_streaming = false,
  validity_period = 'monthly',
  sort_order = 1,
  features = '[
    "1 download per day",
    "480p streaming quality",
    "4 hours daily watch time",
    "Standard streaming speed",
    "With ads"
  ]'::jsonb
WHERE name = 'free';

UPDATE subscription_plans SET
  streaming_quality = '720p',
  max_watch_hours = 8,
  ad_free = true,
  offline_downloads = true,
  priority_content = false,
  premium_courses = false,
  faster_streaming = true,
  validity_period = 'monthly',
  sort_order = 2,
  features = '[
    "5 downloads per day",
    "720p HD streaming quality",
    "8 hours daily watch time",
    "Faster streaming",
    "Ad-free viewing",
    "Offline downloads"
  ]'::jsonb
WHERE name = 'bronze';

UPDATE subscription_plans SET
  streaming_quality = '1080p',
  max_watch_hours = 12,
  ad_free = true,
  offline_downloads = true,
  priority_content = true,
  premium_courses = false,
  faster_streaming = true,
  validity_period = 'monthly',
  sort_order = 3,
  features = '[
    "20 downloads per day",
    "1080p Full HD streaming quality",
    "12 hours daily watch time",
    "Faster streaming",
    "Ad-free viewing",
    "Offline downloads",
    "Priority content access"
  ]'::jsonb
WHERE name = 'silver';

UPDATE subscription_plans SET
  streaming_quality = '4K',
  max_watch_hours = 0,
  ad_free = true,
  offline_downloads = true,
  priority_content = true,
  premium_courses = true,
  faster_streaming = true,
  validity_period = 'monthly',
  sort_order = 4,
  features = '[
    "50 downloads per day",
    "4K Ultra HD streaming quality",
    "Unlimited daily watch time",
    "Fastest streaming",
    "Ad-free viewing",
    "Offline downloads",
    "Priority content access",
    "Exclusive premium courses"
  ]'::jsonb
WHERE name = 'gold';

-- payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_signature text,
  invoice_number text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'created', 'paid', 'failed', 'cancelled', 'refunded')),
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  validity_period text DEFAULT 'monthly',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_payment_transactions" ON payment_transactions;
CREATE POLICY "owner_select_payment_transactions" ON payment_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies - managed via edge function with service role

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_razorpay_order_id ON payment_transactions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_status ON payment_transactions(payment_status);
