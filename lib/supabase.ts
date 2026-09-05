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
  location: string;
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
  is_premium: boolean;
  channel?: Channel;
};

export type Subscription = {
  id: string;
  user_id: string;
  channel_id: string;
  created_at: string;
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
  parent_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  mentions: string[];
  is_hidden: boolean;
  is_flagged: boolean;
  language: string | null;
  like_count?: number;
  dislike_count?: number;
  user_reaction?: "like" | "dislike" | null;
  replies?: Comment[];
};

export type CommentLike = {
  id: string;
  user_id: string;
  comment_id: string;
  type: "like" | "dislike";
  created_at: string;
};

export type CommentReport = {
  id: string;
  user_id: string;
  comment_id: string;
  reason: "spam" | "harassment" | "offensive" | "misinformation" | "other";
  details: string;
  status: "pending" | "reviewed" | "actioned" | "dismissed";
  created_at: string;
};

export type CommentHistoryEntry = {
  id: string;
  comment_id: string;
  user_id: string;
  old_text: string | null;
  new_text: string | null;
  action: "created" | "edited" | "deleted";
  created_at: string;
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

export type SubscriptionPlan = {
  id: string;
  name: string;
  daily_download_limit: number;
  monthly_download_limit: number;
  price: number;
  description: string;
  created_at: string;
  streaming_quality: string;
  max_watch_hours: number;
  ad_free: boolean;
  offline_downloads: boolean;
  priority_content: boolean;
  premium_courses: boolean;
  faster_streaming: boolean;
  features: string[];
  validity_period: "monthly" | "quarterly" | "yearly";
  sort_order: number;
  quarterly_price: number;
  yearly_price: number;
};

export type UserSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: "active" | "expired" | "cancelled";
  started_at: string;
  expires_at: string | null;
  created_at: string;
  plan?: SubscriptionPlan;
};

export type DownloadRecord = {
  id: string;
  user_id: string;
  video_id: string;
  downloaded_at: string;
  ip_address: string;
  device_info: string;
  browser: string;
  plan_used: string;
  status: "completed" | "failed" | "interrupted";
  file_size: string | null;
  created_at: string;
  video?: Video;
};

export type PaymentTransaction = {
  id: string;
  user_id: string;
  plan_id: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  razorpay_signature: string | null;
  invoice_number: string | null;
  amount: number;
  currency: string;
  payment_status: "pending" | "created" | "paid" | "failed" | "cancelled" | "refunded";
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  validity_period: string;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
};
