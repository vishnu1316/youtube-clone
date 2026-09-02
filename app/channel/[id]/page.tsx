"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { supabase, Channel, Video } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatSubscribers } from "@/lib/utils";
import VideoCard from "@/components/VideoCard";
import SubscribeButton from "@/components/SubscribeButton";
import { Loader2, Edit, Upload } from "lucide-react";

export default function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, refreshChannel } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    fetchChannel();
  }, [id]);

  const fetchChannel = async () => {
    setLoading(true);
    const { data: ch } = await supabase
      .from("channels")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (ch) {
      setChannel(ch as Channel);
      const { data: vids } = await supabase
        .from("videos")
        .select("*, channel(*)")
        .eq("channel_id", id)
        .order("created_at", { ascending: false });
      setVideos((vids as Video[]) || []);
    }
    setLoading(false);
  };

  const isOwner = user && channel && user.id === channel.user_id;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-neutral-500 text-lg">Channel not found</p>
        <Link href="/" className="text-blue-600 text-sm mt-2 hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="h-32 sm:h-48 w-full bg-neutral-200 relative">
        {channel.banner_url && (
          <img
            src={channel.banner_url}
            alt="Channel banner"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="px-4 py-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          {channel.avatar_url ? (
            <img
              src={channel.avatar_url}
              alt={channel.name}
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-2 border-neutral-200"
            />
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-neutral-300 flex items-center justify-center text-4xl font-bold text-neutral-700">
              {channel.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">
              {channel.name}
            </h1>
            {channel.handle && (
              <p className="text-sm text-neutral-500 mt-1">@{channel.handle}</p>
            )}
            <div className="mt-3">
              <SubscribeButton
                channelId={channel.id}
                initialSubscribers={channel.subscribers}
              />
            </div>
            {channel.description && (
              <p className="text-sm text-neutral-700 mt-3 max-w-2xl">
                {channel.description}
              </p>
            )}

            {isOwner && (
              <div className="flex gap-3 mt-4 justify-center sm:justify-start">
                <button
                  onClick={() => setShowEditDialog(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full text-sm font-medium transition-colors"
                >
                  <Edit size={18} />
                  Customize channel
                </button>
                <Link
                  href="/channel/upload"
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full text-sm font-medium transition-colors"
                >
                  <Upload size={18} />
                  Upload video
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-6 mt-8 border-b border-neutral-200">
          <button className="text-sm font-medium text-neutral-900 border-b-2 border-neutral-900 pb-3 px-1">
            Videos
          </button>
        </div>

        <div className="py-6">
          {videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-neutral-500 text-lg">No videos yet</p>
              {isOwner && (
                <Link
                  href="/channel/upload"
                  className="mt-4 text-blue-600 text-sm hover:underline"
                >
                  Upload your first video
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showEditDialog && (
        <EditChannelDialog
          channel={channel}
          onClose={() => setShowEditDialog(false)}
          onSaved={() => {
            setShowEditDialog(false);
            fetchChannel();
            refreshChannel();
          }}
        />
      )}
    </div>
  );
}

function EditChannelDialog({
  channel,
  onClose,
  onSaved,
}: {
  channel: Channel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(channel.name);
  const [handle, setHandle] = useState(channel.handle || "");
  const [description, setDescription] = useState(channel.description || "");
  const [avatarUrl, setAvatarUrl] = useState(channel.avatar_url || "");
  const [bannerUrl, setBannerUrl] = useState(channel.banner_url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("channels")
      .update({
        name,
        handle: handle || null,
        description,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
      })
      .eq("id", channel.id);

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">
            Customize channel
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-700 mb-1">
                Channel name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-700 mb-1">
                Handle (without @)
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-700 mb-1">
                Avatar image URL
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-700 mb-1">
                Banner image URL
              </label>
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
