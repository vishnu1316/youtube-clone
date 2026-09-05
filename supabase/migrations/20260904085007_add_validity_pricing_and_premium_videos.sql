-- Add quarterly/yearly pricing columns and premium flag on videos

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS quarterly_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_price numeric DEFAULT 0;

UPDATE subscription_plans SET quarterly_price = ROUND(price * 3 * 0.9, 2) WHERE name != 'free';
UPDATE subscription_plans SET quarterly_price = 0 WHERE name = 'free';
UPDATE subscription_plans SET yearly_price = ROUND(price * 12 * 0.8, 2) WHERE name != 'free';
UPDATE subscription_plans SET yearly_price = 0 WHERE name = 'free';

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;

UPDATE videos SET is_premium = true WHERE id IN (
  SELECT id FROM videos ORDER BY created_at DESC LIMIT 5
);
