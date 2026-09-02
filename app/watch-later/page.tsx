"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, Video } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatViews, timeAgo } from "@/lib/utils";
import { Loader2, Bookmark, Trash2 } from "lucide-react";

export default function WatchLaterPage() {
  const { user, loading: authLoading } = useAuth();
  const [videos, setVideos] = useState<
    (Video & { watch_later_id: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      setLoading(false);
      return;
    }
    if (user) {
      fetchWatchLater();
    }
  }, [user, authLoading]);

  const fetchWatchLater = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("watch_later")
      .select("id, video:videos(*, channel:channels(*))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data
        .map((item: any) => ({
          ...item.video,
          watch_later_id: item.id,
        }))
        .filter((v: any) => v.id);
      setVideos(mapped);
    }
    setLoading(false);
  };

  const handleRemove = async (watchLaterId: string) => {
    await supabase.from("watch_later").delete().eq("id", watchLaterId);
    setVideos((v) => v.filter((vid) => vid.watch_later_id !== watchLaterId));
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
        <Bookmark size={48} className="text-neutral-400 mb-4" />
        <p className="text-neutral-500 text-lg">Sign in to view your watch later list</p>
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
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Watch Later</h1>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bookmark size={48} className="text-neutral-400 mb-4" />
          <p className="text-neutral-500 text-lg">No videos saved for later</p>
          <p className="text-neutral-400 text-sm mt-2">
            Save videos to watch them later.
          </p>
          <Link href="/" className="mt-4 text-blue-600 text-sm hover:underline">
            Browse videos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex gap-3 group bg-neutral-50 rounded-xl p-3 hover:bg-neutral-100 transition-colors"
            >
              <Link
                href={`/video/${video.id}`}
                className="w-40 sm:w-48 aspect-video rounded-lg overflow-hidden bg-neutral-200 flex-shrink-0"
              >
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/video/${video.id}`}>
                  <h3 className="text-sm sm:text-base font-medium text-neutral-900 line-clamp-2 group-hover:text-neutral-600 transition-colors">
                    {video.title}
                  </h3>
                </Link>
                <p className="text-xs text-neutral-500 mt-1">
                  {video.channel?.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatViews(video.views)} - {timeAgo(video.created_at)}
                </p>
              </div>
              <button
                onClick={() => handleRemove(video.watch_later_id)}
                className="p-2 text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
                aria-label="Remove from watch later"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
