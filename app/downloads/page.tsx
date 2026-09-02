"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Download, Crown, Monitor, Globe, Calendar, HardDrive } from "lucide-react";
import { supabase, DownloadRecord } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { timeAgo } from "@/lib/utils";

type Quota = {
  planName: string;
  dailyLimit: number;
  monthlyLimit: number;
  todayDownloads: number;
  monthDownloads: number;
  remainingToday: number;
  remainingThisMonth: number;
  alreadyDownloadedToday: boolean;
};

export default function DownloadsPage() {
  const { user, loading: authLoading } = useAuth();
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void fetchData(user.id);
  }, [authLoading, user]);

  const fetchData = async (userId: string) => {
    setLoading(true);

    const { data } = await supabase
      .from("download_records")
      .select("*, video:videos(*)")
      .eq("user_id", userId)
      .order("downloaded_at", { ascending: false });

    setDownloads((data as DownloadRecord[]) || []);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (token) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/download-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "check-quota" }),
        });
        const qData = await res.json();
        if (qData.quota) setQuota(qData.quota);
      } catch {
        // non-critical
      }
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
        <Download size={48} className="text-neutral-400 mb-4" />
        <p className="text-neutral-700 text-lg">Sign in to view your downloads</p>
        <Link
          href="/auth/signin"
          className="mt-4 px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-sm font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const planLabel = (name: string) => {
    const labels: Record<string, string> = {
      free: "Free",
      bronze: "Bronze",
      silver: "Silver",
      gold: "Gold",
    };
    return labels[name] || "Free";
  };

  const planColor = (name: string) => {
    const colors: Record<string, string> = {
      free: "bg-neutral-100 text-neutral-600",
      bronze: "bg-amber-50 text-amber-700",
      silver: "bg-gray-100 text-gray-600",
      gold: "bg-yellow-50 text-yellow-700",
    };
    return colors[name] || colors.free;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600";
      case "failed": return "text-red-600";
      case "interrupted": return "text-orange-600";
      default: return "text-neutral-500";
    }
  };

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Downloads</h1>

      {/* Quota card */}
      {quota && (
        <div className="mb-6 bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown size={20} className="text-neutral-700" />
              <h2 className="text-sm font-medium text-neutral-900">Download Quota</h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${planColor(quota.planName)}`}>
              {planLabel(quota.planName)} Plan
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-neutral-400">Daily limit</p>
              <p className="text-lg font-semibold text-neutral-900">{quota.dailyLimit}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Used today</p>
              <p className="text-lg font-semibold text-neutral-900">{quota.todayDownloads}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Remaining today</p>
              <p className="text-lg font-semibold text-green-600">{quota.remainingToday}</p>
            </div>
            {quota.monthlyLimit > 0 ? (
              <div>
                <p className="text-xs text-neutral-400">Remaining this month</p>
                <p className="text-lg font-semibold text-neutral-900">{quota.remainingThisMonth}</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-neutral-400">Monthly limit</p>
                <p className="text-lg font-semibold text-neutral-900">Unlimited</p>
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-3">
            Quota resets at midnight. Re-downloading the same video on the same day does not consume quota.
          </p>
        </div>
      )}

      {/* Downloads list */}
      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Download size={48} className="text-neutral-400 mb-4" />
          <p className="text-neutral-700 text-lg">No downloads yet</p>
          <p className="text-neutral-500 text-sm mt-2">
            Download videos from any video page and they&apos;ll appear here.
          </p>
          <Link href="/" className="mt-4 text-blue-600 text-sm hover:underline">
            Browse videos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((dl) => (
            <div
              key={dl.id}
              className="flex gap-4 bg-white border border-neutral-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              {/* Thumbnail */}
              <Link href={`/video/${dl.video_id}`} className="flex-shrink-0">
                <div className="w-32 sm:w-40 aspect-video rounded-lg overflow-hidden bg-neutral-200">
                  {dl.video?.thumbnail_url && (
                    <img
                      src={dl.video.thumbnail_url}
                      alt={dl.video?.title || "Video"}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </Link>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <Link href={`/video/${dl.video_id}`}>
                  <h3 className="text-sm font-medium text-neutral-900 line-clamp-2 hover:opacity-70 transition-opacity">
                    {dl.video?.title || "Unknown video"}
                  </h3>
                </Link>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-neutral-500">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${planColor(dl.plan_used)}`}>
                    {planLabel(dl.plan_used)}
                  </span>
                  <span className={statusColor(dl.status)}>
                    {dl.status.charAt(0).toUpperCase() + dl.status.slice(1)}
                  </span>
                  <span className="flex items-center gap-1" title={new Date(dl.downloaded_at).toLocaleString()}>
                    <Calendar size={11} />
                    {timeAgo(dl.downloaded_at)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Monitor size={11} />
                    {dl.device_info}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe size={11} />
                    {dl.browser}
                  </span>
                  {dl.file_size && (
                    <span className="flex items-center gap-1">
                      <HardDrive size={11} />
                      {dl.file_size}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
