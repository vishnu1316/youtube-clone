import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Channel = {
  id: string;
  user_id: string;
  name: string;
  handle: string | null;
  description: string;
  avatar_url: string;
  banner_url: string;
  subscribers: number;
  created_at: string;
};

export type Video = {
  id: string;
  channel_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  views: number;
  duration: string;
  category: string;
  created_at: string;
  channel?: Channel;
};

export type Like = {
  id: string;
  user_id: string;
  video_id: string;
  type: "like" | "dislike";
  created_at: string;
};

export type Comment = {
  id: string;
  video_id: string;
  user_id: string;
  text: string;
  created_at: string;
  channel?: Channel;
};

export type WatchLaterItem = {
  id: string;
  user_id: string;
  video_id: string;
  created_at: string;
  video?: Video;
};

export type HistoryItem = {
  id: string;
  user_id: string;
  video_id: string;
  watched_at: string;
  video?: Video;
};
