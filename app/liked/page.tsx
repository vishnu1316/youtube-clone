"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, Video } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatViews, timeAgo } from "@/lib/utils";
import { Loader2, ThumbsUp } from "lucide-react";

export default function LikedPage() {
  const { user, loading: authLoading } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      setLoading(false);
      return;
    }
    if (user) {
      fetchLiked();
    }
  }, [user, authLoading]);

  const fetchLiked = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("likes")
      .select("video:videos(*, channel:channels(*))")
      .eq("user_id", user.id)
      .eq("type", "like")
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data
        .map((item: any) => item.video)
        .filter((v: any) => v !== null);
      setVideos(mapped as Video[]);
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
        <ThumbsUp size={48} className="text-neutral-400 mb-4" />
        <p className="text-neutral-500 text-lg">Sign in to view your liked videos</p>
        <Link
          href="/auth/signin"
          className="text-blue-600 text-sm mt-2 hover:underline"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Liked Videos</h1>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ThumbsUp size={48} className="text-neutral-400 mb-4" />
          <p className="text-neutral-500 text-lg">No liked videos yet</p>
          <p className="text-neutral-400 text-sm mt-2">
            Videos you like will appear here.
          </p>
          <Link href="/" className="mt-4 text-blue-600 text-sm hover:underline">
            Browse videos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {videos.map((video) => (
            <Link key={video.id} href={`/video/${video.id}`} className="group cursor-pointer">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-200">
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:rounded-none transition-all duration-200"
                  />
                )}
              </div>
              <div className="flex gap-3 mt-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-neutral-900 line-clamp-2 leading-5">
                    {video.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    {video.channel?.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatViews(video.views)} - {timeAgo(video.created_at)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
