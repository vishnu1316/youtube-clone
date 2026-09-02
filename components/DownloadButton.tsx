"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Check, AlertCircle, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

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

export default function DownloadButton({ videoId }: { videoId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "authorizing" | "downloading" | "recording" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showQuota, setShowQuota] = useState(false);

  useEffect(() => {
    if (!user) return;
    void fetchQuota();
  }, [user]);

  const fetchQuota = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/download-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "check-quota" }),
      });
      const data = await res.json();
      if (data.quota) setQuota(data.quota);
    } catch {
      // silently fail - quota display is non-critical
    }
  };

  const callEdgeFunction = async (payload: Record<string, unknown>) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("No session");

    const res = await fetch(`${supabaseUrl}/functions/v1/download-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  const handleDownload = async () => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }

    setStatus("authorizing");
    setMessage("");

    let authResult: { authorized?: boolean; error?: string; video?: { video_url: string; title: string }; quota?: Quota; alreadyDownloadedToday?: boolean; message?: string };
    try {
      authResult = await callEdgeFunction({ action: "authorize", videoId });
    } catch {
      setStatus("error");
      setMessage("Could not verify download permission. Please try again.");
      return;
    }

    if (!authResult.authorized) {
      setStatus("error");
      setMessage(authResult.error || "Download not authorized.");
      if (authResult.quota) setQuota(authResult.quota);
      return;
    }

    if (authResult.quota) setQuota(authResult.quota);
    if (authResult.alreadyDownloadedToday) {
      // Already downloaded today - just trigger the download, no recording needed
      triggerDownload(authResult.video!.video_url, authResult.video!.title);
      setStatus("done");
      setMessage(authResult.message || "Re-downloading (no quota consumed).");
      return;
    }

    // Start the download
    setStatus("downloading");
    triggerDownload(authResult.video!.video_url, authResult.video!.title);

    // Record the download
    setStatus("recording");
    let recordResult: { success?: boolean; quota?: Quota; error?: string };
    try {
      recordResult = await callEdgeFunction({ action: "record", videoId, status: "completed" });
    } catch {
      // Download already started, recording failed - not critical
      setStatus("done");
      setMessage("Download started. (Audit recording may have failed.)");
      return;
    }

    if (recordResult.quota) setQuota(recordResult.quota);
    setStatus("done");
    setMessage("Download complete. Check your Downloads page.");
  };

  const triggerDownload = (url: string, title: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = title || "video";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
      free: "text-neutral-500",
      bronze: "text-amber-600",
      silver: "text-gray-500",
      gold: "text-yellow-600",
    };
    return colors[name] || "text-neutral-500";
  };

  if (!user) {
    return (
      <button
        onClick={() => router.push("/auth/signin")}
        className="flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors text-sm font-medium text-neutral-700"
      >
        <Download size={18} />
        Download
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={status === "authorizing" || status === "recording"}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors text-sm font-medium text-neutral-700 disabled:opacity-50"
        >
          {status === "authorizing" || status === "recording" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : status === "done" ? (
            <Check size={18} className="text-green-600" />
          ) : status === "error" ? (
            <AlertCircle size={18} className="text-red-500" />
          ) : (
            <Download size={18} />
          )}
          {status === "authorizing" ? "Checking..." : status === "downloading" ? "Downloading..." : status === "recording" ? "Saving..." : status === "done" ? "Downloaded" : status === "error" ? "Failed" : "Download"}
        </button>

        {quota && (
          <button
            type="button"
            onClick={() => setShowQuota(!showQuota)}
            className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium transition-colors ${planColor(quota.planName)} bg-neutral-50 hover:bg-neutral-100`}
          >
            <Crown size={14} />
            {planLabel(quota.planName)}: {quota.remainingToday}/{quota.dailyLimit} left today
          </button>
        )}
      </div>

      {showQuota && quota && (
        <div className="absolute top-full mt-2 right-0 z-10 w-64 bg-white border border-neutral-200 rounded-xl shadow-lg p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-neutral-900">Download Quota</span>
            <span className={`font-medium ${planColor(quota.planName)}`}>{planLabel(quota.planName)} Plan</span>
          </div>
          <div className="space-y-1 text-xs text-neutral-600">
            <div className="flex justify-between">
              <span>Daily limit</span>
              <span className="font-medium">{quota.dailyLimit} downloads/day</span>
            </div>
            <div className="flex justify-between">
              <span>Used today</span>
              <span className="font-medium">{quota.todayDownloads}</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining today</span>
              <span className="font-medium text-green-600">{quota.remainingToday}</span>
            </div>
            {quota.monthlyLimit > 0 && (
              <>
                <div className="border-t border-neutral-100 my-1" />
                <div className="flex justify-between">
                  <span>Monthly limit</span>
                  <span className="font-medium">{quota.monthlyLimit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Used this month</span>
                  <span className="font-medium">{quota.monthDownloads}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining this month</span>
                  <span className="font-medium">{quota.remainingThisMonth}</span>
                </div>
              </>
            )}
            <div className="border-t border-neutral-100 my-1" />
            <p className="text-neutral-400">Quota resets at midnight.</p>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-xs mt-1 ${status === "error" ? "text-red-600" : "text-neutral-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
