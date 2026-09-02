"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Upload } from "lucide-react";

const categories = [
  "All",
  "Music",
  "Gaming",
  "Live",
  "Comedy",
  "Technology",
  "News",
  "Sports",
  "Education",
  "Entertainment",
  "Travel",
  "Cooking",
];

export default function UploadPage() {
  const { user, channel, loading: authLoading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState("All");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !channel) return;
    setSaving(true);
    setError("");

    const { data, error } = await supabase
      .from("videos")
      .insert({
        channel_id: channel.id,
        title,
        description,
        thumbnail_url: thumbnailUrl,
        video_url: videoUrl,
        duration: duration || "0:00",
        category,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      router.push(`/video/${data.id}`);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <Upload size={48} className="text-neutral-400 mb-4" />
        <p className="text-neutral-500 text-lg">
          You need a channel to upload videos
        </p>
        <Link
          href="/channel/create"
          className="mt-4 px-6 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-sm font-medium transition-colors"
        >
          Create a channel
        </Link>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">Upload video</h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-sm text-neutral-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
              className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              placeholder="Enter video title"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={5000}
              className="w-full px-4 py-2 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm resize-none"
              placeholder="Tell viewers about your video..."
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-700 mb-1">
              Thumbnail image URL
            </label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              placeholder="https://..."
            />
            {thumbnailUrl && (
              <div className="mt-2 w-full max-w-sm aspect-video rounded-lg overflow-hidden bg-neutral-200">
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-neutral-700 mb-1">
              Video URL (direct file or YouTube link)
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              placeholder="https://www.youtube.com/watch?v=... or https://..."
            />
            <p className="text-xs text-neutral-400 mt-1">
              You can paste a YouTube link or a direct video file URL.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-700 mb-1">
                Duration (e.g. 10:30)
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
                placeholder="10:30"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              >
                {categories
                  .filter((c) => c !== "All")
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 bg-brand hover:bg-brand-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload video
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
