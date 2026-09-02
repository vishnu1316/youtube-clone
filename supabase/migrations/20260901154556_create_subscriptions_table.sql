/*
# Create Subscriptions Table

## Overview
Adds a subscriptions table so users can subscribe/unsubscribe to channels.
This enables the core YouTube social loop: subscribe to channels you like,
then see a feed of only those channels' videos.

## New Tables

### subscriptions
- `id` (uuid, PK) - subscription unique ID
- `user_id` (uuid, FK to auth.users) - the subscriber
- `channel_id` (uuid, FK to channels) - the channel being subscribed to
- `created_at` (timestamptz) - when the subscription happened
- UNIQUE constraint on (user_id, channel_id) - one subscription per user per channel

## Security (RLS)
- SELECT: public (anyone can see who subscribes to whom)
- INSERT: owner only (auth.uid() = user_id)
- DELETE: owner only (auth.uid() = user_id)

## Important Notes
1. user_id defaults to auth.uid() so client inserts work without passing it
2. Public SELECT allows displaying subscriber counts and subscription status
3. Only the subscriber can create or remove their own subscriptions
4. An index on channel_id enables fast subscriber count queries
5. An index on user_id enables fast "my subscriptions" queries
*/

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_subscriptions" ON subscriptions;
CREATE POLICY "public_select_subscriptions" ON subscriptions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_subscriptions" ON subscriptions;
CREATE POLICY "owner_insert_subscriptions" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_delete_subscriptions" ON subscriptions;
CREATE POLICY "owner_delete_subscriptions" ON subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_channel_id ON subscriptions(channel_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
