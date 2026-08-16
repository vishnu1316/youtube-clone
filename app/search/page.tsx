"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase, Video, Channel } from "@/lib/supabase";
import { formatSubscribers, formatViews, timeAgo } from "@/lib/utils";
import { Loader2, Search as SearchIcon } from "lucide-react";
import Link from "next/link";

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<Video[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "videos" | "channels">("all");

  useEffect(() => {
    if (query) {
      performSearch();
    } else {
      setLoading(false);
    }
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    const [videoResults, channelResults] = await Promise.all([
      supabase
        .from("videos")
        .select("*, channel(*)")
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order("created_at", { ascending: false }),
      supabase
        .from("channels")
        .select("*")
        .or(`name.ilike.%${query}%,handle.ilike.%${query}%`)
        .order("subscribers", { ascending: false }),
    ]);

    setResults((videoResults.data as Video[]) || []);
    setChannels((channelResults.data as Channel[]) || []);
    setLoading(false);
  };

  const filteredVideos = activeTab === "channels" ? [] : results;
  const filteredChannels = activeTab === "videos" ? [] : channels;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <SearchIcon size={48} className="text-neutral-400 mb-4" />
        <p className="text-neutral-500 text-lg">Search for videos and channels</p>
        <p className="text-neutral-400 text-sm mt-2">
          Use the search bar at the top to find content.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <p className="text-sm text-neutral-500 mb-4">
        Showing results for: <span className="text-neutral-900 font-medium">{query}</span>
      </p>

      <div className="flex gap-6 mb-6 border-b border-neutral-200">
        {(["all", "videos", "channels"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-sm font-medium pb-3 px-1 capitalize transition-colors ${
              activeTab === tab
                ? "text-neutral-900 border-b-2 border-neutral-900"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {tab === "all"
              ? `All (${results.length + channels.length})`
              : tab === "videos"
                ? `Videos (${results.length})`
                : `Channels (${channels.length})`}
          </button>
        ))}
      </div>

      {filteredChannels.length > 0 && (
        <div className="mb-6 space-y-3">
          {filteredChannels.map((ch) => (
            <Link
              key={ch.id}
              href={`/channel/${ch.id}`}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-neutral-100 transition-colors group"
            >
              {ch.avatar_url ? (
                <img
                  src={ch.avatar_url}
                  alt={ch.name}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700 font-bold">
                  {ch.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-neutral-900 group-hover:text-neutral-600 transition-colors">
                  {ch.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatSubscribers(ch.subscribers)}
                </p>
                {ch.description && (
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-1">
                    {ch.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {filteredVideos.length > 0 && (
        <div className="space-y-3">
          {filteredVideos.map((video) => (
            <Link
              key={video.id}
              href={`/video/${video.id}`}
              className="flex gap-3 group bg-neutral-50 rounded-xl p-3 hover:bg-neutral-100 transition-colors"
            >
              <div className="w-40 sm:w-64 aspect-video rounded-lg overflow-hidden bg-neutral-200 flex-shrink-0 relative">
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                )}
                {video.duration && video.duration !== "0:00" && (
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                    {video.duration}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-lg font-medium text-neutral-900 line-clamp-2 group-hover:text-neutral-600 transition-colors">
                  {video.title}
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  {formatViews(video.views)} - {timeAgo(video.created_at)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {video.channel?.avatar_url ? (
                    <img
                      src={video.channel.avatar_url}
                      alt={video.channel.name}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700 text-xs font-medium">
                      {video.channel?.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <p className="text-xs text-neutral-500">
                    {video.channel?.name}
                  </p>
                </div>
                {video.description && (
                  <p className="text-xs text-neutral-400 mt-2 line-clamp-2 hidden sm:block">
                    {video.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {results.length === 0 && channels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SearchIcon size={48} className="text-neutral-400 mb-4" />
          <p className="text-neutral-500 text-lg">No results found</p>
          <p className="text-neutral-400 text-sm mt-2">
            Try different keywords or remove search filters.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-neutral-400" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
