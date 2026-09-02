/*
# Advanced Multilingual Commenting System

## Overview
Enhances the existing comments table and adds new tables to support:
- Comment likes/dislikes with per-user reactions
- Replies (nested comments via parent_id)
- Edit tracking (is_edited, edited_at) and full comment history
- Comment reporting with predefined reasons and admin review status
- Mention support (@username stored in mentions array)
- Location field on channels for display alongside comments
- Rate limiting, spam detection, and moderation metadata

## Modified Tables

### channels (added columns)
- `location` (text) - user's location to display next to comments

### comments (added columns)
- `parent_id` (uuid, FK to comments) - NULL for top-level, set for replies
- `is_edited` (boolean, default false) - whether the comment was edited
- `edited_at` (timestamptz, nullable) - when it was last edited
- `mentions` (text[], default '{}') - array of mentioned usernames
- `is_hidden` (boolean, default false) - hidden by moderation
- `is_flagged` (boolean, default false) - flagged for admin review
- `language` (text, nullable) - detected language code (e.g. 'en', 'es')

## New Tables

### comment_likes
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users) - who liked/disliked
- `comment_id` (uuid, FK to comments) - which comment
- `type` (text) - 'like' or 'dislike'
- `created_at` (timestamptz)
- UNIQUE(user_id, comment_id) - one reaction per user per comment

### comment_reports
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users) - who reported
- `comment_id` (uuid, FK to comments) - which comment
- `reason` (text) - predefined: 'spam', 'harassment', 'offensive', 'misinformation', 'other'
- `details` (text, optional) - additional context from reporter
- `status` (text, default 'pending') - 'pending', 'reviewed', 'actioned', 'dismissed'
- `created_at` (timestamptz)
- UNIQUE(user_id, comment_id) - one report per user per comment

### comment_history
- `id` (uuid, PK)
- `comment_id` (uuid, FK to comments) - which comment
- `user_id` (uuid, FK to auth.users) - who made the change
- `old_text` (text) - previous content
- `new_text` (text) - new content
- `action` (text) - 'created', 'edited', 'deleted'
- `created_at` (timestamptz)

## Security (RLS)

### comment_likes
- SELECT: public (anyone can see likes/dislikes)
- INSERT/DELETE: owner only (auth.uid() = user_id)

### comment_reports
- SELECT: owner only (auth.uid() = user_id) - reporters see their own reports
- INSERT: owner only (auth.uid() = user_id)
- UPDATE: admin only (for now, no admin role, so no update policy)

### comment_history
- SELECT: public (anyone can view edit history of a comment)
- INSERT: owner only (auth.uid() = user_id)

## Important Notes
1. parent_id is self-referencing FK to comments, enabling one level of replies
2. comment_history records every create/edit/delete for audit trail
3. comment_reports uses UNIQUE to prevent duplicate reports by same user
4. is_hidden and is_flagged allow moderation without data loss
5. mentions array stores raw @username strings for display and notification
6. location on channels allows showing where a commenter is from
*/
