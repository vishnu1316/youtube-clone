"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Video } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatViews, formatSubscribers, timeAgo } from "@/lib/utils";
import SubscribeButton from "@/components/SubscribeButton";
import CommentSection from "@/components/CommentSection";
import DownloadButton from "@/components/DownloadButton";
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  Loader2,
} from "lucide-react";

export default function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [userReaction, setUserReaction] = useState<"like" | "dislike" | null>(
    null
  );
  const [isWatchLater, setIsWatchLater] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    fetchVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (video) {
      fetchRelatedVideos();
      fetchLikes();
      fetchWatchLater();
      addToHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  const fetchVideo = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("videos")
      .select("*, channel(*)")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      setVideo(data as Video);
      await supabase
        .from("videos")
        .update({ views: (data as Video).views + 1 })
        .eq("id", id);
    }
    setLoading(false);
  };

  const fetchRelatedVideos = async () => {
    const { data } = await supabase
      .from("videos")
      .select("*, channel(*)")
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(10);
    setRelatedVideos((data as Video[]) || []);
  };

  const fetchLikes = async () => {
    const { count: likes } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("video_id", id)
      .eq("type", "like");
    setLikeCount(likes || 0);

    const { count: dislikes } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("video_id", id)
      .eq("type", "dislike");
    setDislikeCount(dislikes || 0);

    if (user) {
      const { data: reaction } = await supabase
        .from("likes")
        .select("type")
        .eq("video_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (reaction) {
        setUserReaction((reaction as { type: "like" | "dislike" }).type);
      } else {
        setUserReaction(null);
      }
    }
  };

  const fetchWatchLater = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("watch_later")
      .select("id")
      .eq("video_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    setIsWatchLater(!!data);
  };

  const addToHistory = async () => {
    if (!user) return;
    await supabase
      .from("history")
      .upsert({ user_id: user.id, video_id: id }, { onConflict: "user_id,video_id" });
  };

  const handleLike = async () => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }

    if (userReaction === "like") {
      await supabase.from("likes").delete().eq("video_id", id).eq("user_id", user.id);
      setUserReaction(null);
      setLikeCount((c) => c - 1);
    } else {
      if (userReaction === "dislike") {
        setDislikeCount((c) => c - 1);
      }
      await supabase
        .from("likes")
        .upsert(
          { user_id: user.id, video_id: id, type: "like" },
          { onConflict: "user_id,video_id" }
        );
      setUserReaction("like");
      setLikeCount((c) => c + 1);
    }
  };

  const handleDislike = async () => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }

    if (userReaction === "dislike") {
      await supabase.from("likes").delete().eq("video_id", id).eq("user_id", user.id);
      setUserReaction(null);
      setDislikeCount((c) => c - 1);
    } else {
      if (userReaction === "like") {
        setLikeCount((c) => c - 1);
      }
      await supabase
        .from("likes")
        .upsert(
          { user_id: user.id, video_id: id, type: "dislike" },
          { onConflict: "user_id,video_id" }
        );
      setUserReaction("dislike");
      setDislikeCount((c) => c + 1);
    }
  };

  const handleWatchLater = async () => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }

    if (isWatchLater) {
      await supabase
        .from("watch_later")
        .delete()
        .eq("video_id", id)
        .eq("user_id", user.id);
      setIsWatchLater(false);
    } else {
      await supabase
        .from("watch_later")
        .insert({ user_id: user.id, video_id: id });
      setIsWatchLater(true);
    }
  };

  const handleShare = async () => {
    setShareError("");
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareError("Could not copy the link");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-neutral-500 text-lg">Video not found</p>
        <Link
          href="/"
          className="text-blue-600 text-sm mt-2 hover:underline"
        >
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-[1800px] mx-auto">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 max-w-4xl">
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
            {video.video_url ? (
              video.video_url.startsWith("https://www.youtube.com") ||
              video.video_url.startsWith("https://youtu.be") ? (
                <iframe
                  src={video.video_url.replace("watch?v=", "embed/")}
                  className="w-full h-full"
                  allowFullScreen
                />
              ) : (
                <video src={video.video_url} controls className="w-full h-full" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-400">
                No video source available
              </div>
            )}
          </div>

          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900 mt-3">
            {video.title}
          </h1>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
            <div className="flex items-center gap-3">
              <Link
                href={`/channel/${video.channel?.id}`}
                className="flex items-center gap-3 group"
              >
                {video.channel?.avatar_url ? (
                  <img
                    src={video.channel.avatar_url}
                    alt={video.channel.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700 font-medium">
                    {video.channel?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-neutral-900 group-hover:opacity-70 transition-opacity">
                    {video.channel?.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatSubscribers(video.channel?.subscribers || 0)}
                  </p>
                </div>
              </Link>
              {video.channel && (
                <SubscribeButton
                  channelId={video.channel.id}
                  initialSubscribers={video.channel.subscribers}
                />
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-neutral-100 rounded-full overflow-hidden">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-4 py-2 hover:bg-neutral-200 transition-colors ${
                    userReaction === "like" ? "text-neutral-900" : "text-neutral-600"
                  }`}
                >
                  <ThumbsUp
                    size={18}
                    fill={userReaction === "like" ? "currentColor" : "none"}
                  />
                  <span className="text-sm font-medium">{likeCount}</span>
                </button>
                <div className="w-px h-6 bg-neutral-300" />
                <button
                  onClick={handleDislike}
                  className={`flex items-center gap-2 px-4 py-2 hover:bg-neutral-200 transition-colors ${
                    userReaction === "dislike" ? "text-neutral-900" : "text-neutral-600"
                  }`}
                >
                  <ThumbsDown
                    size={18}
                    fill={userReaction === "dislike" ? "currentColor" : "none"}
                  />
                  <span className="text-sm font-medium">{dislikeCount}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors text-sm font-medium text-neutral-700"
              >
                <Share2 size={18} />
                {shareCopied ? "Copied!" : "Share"}
              </button>
              {shareError && (
                <span className="text-xs text-red-600">{shareError}</span>
              )}

              <button
                onClick={handleWatchLater}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-sm font-medium ${
                  isWatchLater
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                <Bookmark
                  size={18}
                  fill={isWatchLater ? "currentColor" : "none"}
                />
                {isWatchLater ? "Saved" : "Save"}
              </button>

              <DownloadButton videoId={id} />
            </div>
          </div>

          <div
            className="mt-4 bg-neutral-100 rounded-xl p-3 cursor-pointer"
            onClick={() => setShowFullDesc(!showFullDesc)}
          >
            <div className="flex gap-2 text-sm text-neutral-600">
              <span>{formatViews(video.views)}</span>
              <span>-</span>
              <span>{timeAgo(video.created_at)}</span>
            </div>
            <p
              className={`text-sm text-neutral-800 mt-2 whitespace-pre-wrap ${
                showFullDesc ? "" : "line-clamp-3"
              }`}
            >
              {video.description || "No description available."}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {showFullDesc ? "Show less" : "Show more"}
            </p>
          </div>

          <div className="mt-6">
            <CommentSection videoId={id} />
          </div>
        </div>

        <div className="lg:w-[400px] flex-shrink-0">
          <h2 className="text-base font-medium text-neutral-900 mb-3">
            Related videos
          </h2>
          <div className="space-y-2">
            {relatedVideos.map((rv) => (
              <Link
                key={rv.id}
                href={`/video/${rv.id}`}
                className="flex gap-2 group"
              >
                <div className="w-40 sm:w-44 aspect-video rounded-lg overflow-hidden bg-neutral-200 flex-shrink-0">
                  {rv.thumbnail_url && (
                    <img
                      src={rv.thumbnail_url}
                      alt={rv.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-neutral-900 line-clamp-2 leading-5 group-hover:text-neutral-600 transition-colors">
                    {rv.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    {rv.channel?.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatViews(rv.views)} - {timeAgo(rv.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
