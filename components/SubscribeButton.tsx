"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatSubscribers } from "@/lib/utils";

export default function SubscribeButton({
  channelId,
  initialSubscribers,
}: {
  channelId: string;
  initialSubscribers: number;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(initialSubscribers);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadSubscription = async () => {
      setLoading(true);
      const [{ count }, subscription] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", channelId),
        user
          ? supabase
              .from("subscriptions")
              .select("id")
              .eq("channel_id", channelId)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (active) {
        setSubscriberCount(Math.max(initialSubscribers, count ?? 0));
        setSubscribed(Boolean(subscription.data));
        setLoading(false);
      }
    };

    void loadSubscription();
    return () => {
      active = false;
    };
  }, [channelId, initialSubscribers, user]);

  const handleToggle = async () => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }

    setSaving(true);
    setError("");

    if (subscribed) {
      const { error: deleteError } = await supabase
        .from("subscriptions")
        .delete()
        .eq("channel_id", channelId)
        .eq("user_id", user.id);

      if (deleteError) {
        setError("Could not update subscription");
      } else {
        setSubscribed(false);
        setSubscriberCount((count) => Math.max(0, count - 1));
      }
    } else {
      const { error: insertError } = await supabase
        .from("subscriptions")
        .insert({ channel_id: channelId });

      if (insertError) {
        setError("Could not update subscription");
      } else {
        setSubscribed(true);
        setSubscriberCount((count) => count + 1);
      }
    }

    setSaving(false);
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading || saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-60 ${
            subscribed
              ? "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
              : "bg-neutral-900 text-white hover:bg-neutral-700"
          }`}
        >
          {saving || loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : subscribed ? (
            <Bell size={16} />
          ) : null}
          {subscribed ? "Subscribed" : "Subscribe"}
        </button>
        <span className="text-xs text-neutral-500">
          {formatSubscribers(subscriberCount)}
        </span>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
