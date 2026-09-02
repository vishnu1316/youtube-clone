"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export default function CreateChannelPage() {
  const { user, channel, loading: authLoading, refreshChannel } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
    if (!authLoading && channel) {
      router.push(`/channel/${channel.id}`);
    }
  }, [user, channel, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");

    const { data, error } = await supabase
      .from("channels")
      .insert({
        user_id: user.id,
        name,
        handle: handle || null,
        description,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        location,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      await refreshChannel();
      router.push(`/channel/${data.id}`);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Create your channel</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Set up your channel to start uploading videos.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-sm text-neutral-700 mb-1">
              Channel name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              placeholder="My Channel"
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
              placeholder="mychannel"
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
              placeholder="Tell viewers about your channel..."
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              placeholder="City, Country"
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
              className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              placeholder="https://..."
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
              className="w-full h-11 px-4 bg-neutral-50 border border-neutral-300 rounded-lg outline-none focus:border-blue-500 text-neutral-900 text-sm"
              placeholder="https://..."
            />
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
            {saving && <Loader2 size={18} className="animate-spin" />}
            Create channel
          </button>
        </form>
      </div>
    </div>
  );
}
