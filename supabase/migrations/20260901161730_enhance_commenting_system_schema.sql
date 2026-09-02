/*
# Advanced Commenting System - Schema Changes

## Column additions to channels
*/
ALTER TABLE channels ADD COLUMN IF NOT EXISTS location text DEFAULT '';

/*
## Column additions to comments
*/
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mentions text[] NOT NULL DEFAULT '{}';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS language text;

/*
## comment_likes table
*/
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_comment_likes" ON comment_likes;
CREATE POLICY "public_select_comment_likes" ON comment_likes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_comment_likes" ON comment_likes;
CREATE POLICY "owner_insert_comment_likes" ON comment_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_delete_comment_likes" ON comment_likes;
CREATE POLICY "owner_delete_comment_likes" ON comment_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

/*
## comment_reports table
*/
CREATE TABLE IF NOT EXISTS comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'offensive', 'misinformation', 'other')),
  details text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_comment_reports" ON comment_reports;
CREATE POLICY "owner_select_comment_reports" ON comment_reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_insert_comment_reports" ON comment_reports;
CREATE POLICY "owner_insert_comment_reports" ON comment_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

/*
## comment_history table
*/
CREATE TABLE IF NOT EXISTS comment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  old_text text,
  new_text text,
  action text NOT NULL CHECK (action IN ('created', 'edited', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_comment_history" ON comment_history;
CREATE POLICY "public_select_comment_history" ON comment_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_comment_history" ON comment_history;
CREATE POLICY "owner_insert_comment_history" ON comment_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

/*
## Indexes
*/
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_comment_id ON comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_history_comment_id ON comment_history(comment_id);
