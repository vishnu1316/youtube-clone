"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Rss } from "lucide-react";
import { supabase, Video } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import VideoCard from "@/components/VideoCard";

export default function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void fetchVideos(user.id);
  }, [authLoading, user]);

  const fetchVideos = async (userId: string) => {
    setLoading(true);
    setError("");

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("channel_id")
      .eq("user_id", userId);

    if (subscriptionError) {
      setError("Could not load your subscriptions");
      setLoading(false);
      return;
    }

    const channelIds = (subscriptions ?? []).map(
      (subscription: { channel_id: string }) => subscription.channel_id
    );

    if (channelIds.length === 0) {
      setVideos([]);
      setLoading(false);
      return;
    }

    const { data, error: videoError } = await supabase
      .from("videos")
      .select("*, channel(*)")
      .in("channel_id", channelIds)
      .order("created_at", { ascending: false });

    if (videoError) {
      setError("Could not load videos from your subscriptions");
    } else {
      setVideos((data as Video[]) || []);
    }
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <Rss size={48} className="text-neutral-400 mb-4" />
        <p className="text-neutral-700 text-lg">Sign in to see your subscriptions</p>
        <p className="text-neutral-500 text-sm mt-2">
          New videos from channels you follow will appear here.
        </p>
        <Link
          href="/auth/signin"
          className="mt-4 px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-sm font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Subscriptions</h1>
      {error && (
        <p className="mb-4 max-w-xl text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Rss size={48} className="text-neutral-400 mb-4" />
          <p className="text-neutral-700 text-lg">No subscription videos yet</p>
          <p className="text-neutral-500 text-sm mt-2">
            Subscribe to a channel and its latest videos will show up here.
          </p>
          <Link href="/" className="mt-4 text-blue-600 text-sm hover:underline">
            Browse videos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
