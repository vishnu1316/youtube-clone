/*
# YouTube Clone - Full Schema

## Overview
Creates the complete database schema for a YouTube clone with channels, videos,
likes/dislikes, watch later, comments, and watch history. Uses Supabase auth
for user management with owner-scoped RLS policies.

## New Tables

### channels
- `id` (uuid, PK) - channel unique ID
- `user_id` (uuid, FK to auth.users) - owner of the channel
- `name` (text) - channel display name
- `handle` (text, unique) - @handle for the channel
- `description` (text) - channel description
- `avatar_url` (text) - profile picture URL
- `banner_url` (text) - channel banner image URL
- `subscribers` (integer) - subscriber count, defaults to 0
- `created_at` (timestamptz) - creation timestamp

### videos
- `id` (uuid, PK) - video unique ID
- `channel_id` (uuid, FK to channels) - channel that uploaded the video
- `title` (text) - video title
- `description` (text) - video description
- `thumbnail_url` (text) - thumbnail image URL
- `video_url` (text) - video file URL (or embed URL)
- `views` (integer) - view count, defaults to 0
- `duration` (text) - video duration string (e.g. "10:30")
- `category` (text) - video category
- `created_at` (timestamptz) - upload timestamp

### likes
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users) - who liked/disliked
- `video_id` (uuid, FK to videos) - which video
- `type` (text) - 'like' or 'dislike'
- `created_at` (timestamptz)
- Unique constraint on (user_id, video_id) - one reaction per user per video

### watch_later
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users) - who saved it
- `video_id` (uuid, FK to videos) - which video
- `created_at` (timestamptz)
- Unique constraint on (user_id, video_id)

### comments
- `id` (uuid, PK)
- `video_id` (uuid, FK to videos) - which video
- `user_id` (uuid, FK to auth.users) - who commented
- `text` (text) - comment content
- `created_at` (timestamptz)

### history
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users) - who watched
- `video_id` (uuid, FK to videos) - which video
- `watched_at` (timestamptz) - when it was watched
- Unique constraint on (user_id, video_id) - one history entry per video per user

## Security (RLS)

### channels
- SELECT: public (anyone can view channels)
- INSERT/UPDATE: owner only (auth.uid() = user_id)

### videos
- SELECT: public (anyone can view videos)
- INSERT: channel owner only (via EXISTS subquery)
- UPDATE/DELETE: channel owner only (via EXISTS subquery)

### likes
- SELECT: public (anyone can see likes/dislikes)
- INSERT/UPDATE/DELETE: owner only (auth.uid() = user_id)

### watch_later
- SELECT/INSERT/DELETE: owner only (auth.uid() = user_id)

### comments
- SELECT: public
- INSERT: authenticated users only (auth.uid() = user_id)
- UPDATE/DELETE: comment owner only

### history
- SELECT/INSERT/DELETE: owner only (auth.uid() = user_id)

## Important Notes
1. All owner columns default to auth.uid() so client inserts work without passing user_id
2. Public SELECT on channels, videos, likes, comments so browsing works without auth
3. Watch later and history are private per user
4. Unique constraints prevent duplicate likes, watch later entries, and history entries
*/

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text UNIQUE,
  description text DEFAULT '',
  avatar_url text DEFAULT '',
  banner_url text DEFAULT '',
  subscribers integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_channels" ON channels;
CREATE POLICY "public_select_channels" ON channels FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_channels" ON channels;
CREATE POLICY "owner_insert_channels" ON channels FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_update_channels" ON channels;
CREATE POLICY "owner_update_channels" ON channels FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  thumbnail_url text DEFAULT '',
  video_url text DEFAULT '',
  views integer NOT NULL DEFAULT 0,
  duration text DEFAULT '0:00',
  category text DEFAULT 'All',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_videos" ON videos;
CREATE POLICY "public_select_videos" ON videos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_videos" ON videos;
CREATE POLICY "owner_insert_videos" ON videos FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = videos.channel_id AND channels.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "owner_update_videos" ON videos;
CREATE POLICY "owner_update_videos" ON videos FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = videos.channel_id AND channels.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = videos.channel_id AND channels.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "owner_delete_videos" ON videos;
CREATE POLICY "owner_delete_videos" ON videos FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM channels WHERE channels.id = videos.channel_id AND channels.user_id = auth.uid())
  );

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_likes" ON likes;
CREATE POLICY "public_select_likes" ON likes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_likes" ON likes;
CREATE POLICY "owner_insert_likes" ON likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_update_likes" ON likes;
CREATE POLICY "owner_update_likes" ON likes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_delete_likes" ON likes;
CREATE POLICY "owner_delete_likes" ON likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Watch later table
CREATE TABLE IF NOT EXISTS watch_later (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE watch_later ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_watch_later" ON watch_later;
CREATE POLICY "owner_select_watch_later" ON watch_later FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_insert_watch_later" ON watch_later;
CREATE POLICY "owner_insert_watch_later" ON watch_later FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_delete_watch_later" ON watch_later;
CREATE POLICY "owner_delete_watch_later" ON watch_later FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_comments" ON comments;
CREATE POLICY "public_select_comments" ON comments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_comments" ON comments;
CREATE POLICY "owner_insert_comments" ON comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_update_comments" ON comments;
CREATE POLICY "owner_update_comments" ON comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_delete_comments" ON comments;
CREATE POLICY "owner_delete_comments" ON comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- History table
CREATE TABLE IF NOT EXISTS history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  watched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_history" ON history;
CREATE POLICY "owner_select_history" ON history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_insert_history" ON history;
CREATE POLICY "owner_insert_history" ON history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_delete_history" ON history;
CREATE POLICY "owner_delete_history" ON history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_video_id ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_watch_later_user_id ON watch_later(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
