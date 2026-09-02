"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Check, X, CreditCard, Receipt, RefreshCw } from "lucide-react";
import { supabase, SubscriptionPlan, PaymentTransaction } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import PaymentModal from "@/components/PaymentModal";

type SubscriptionData = {
  id: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  plan: SubscriptionPlan;
};

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    void fetchData();
  }, [authLoading, user]);

  const fetchData = async () => {
    setLoading(true);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/razorpay-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "status" }),
      });
      const data = await res.json();
      if (data.subscription) {
        setSubscription(data.subscription as SubscriptionData);
      }
      if (data.transactions) {
        setTransactions(data.transactions as PaymentTransaction[]);
      }
    } catch {
      // non-critical
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!subscription) return;
    setCanceling(true);
    setCancelMessage("");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/razorpay-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "cancel-subscription" }),
      });
      const data = await res.json();
      if (data.error) {
        setCancelMessage(data.error);
      } else {
        setCancelMessage("Your subscription has been cancelled. You will retain access until the end of your billing period.");
        void fetchData();
      }
    } catch {
      setCancelMessage("Failed to cancel subscription. Please try again.");
    }
    setCanceling(false);
  };

  const planColor = (name: string) => {
    const colors: Record<string, string> = {
      free: "from-neutral-700 to-neutral-900",
      bronze: "from-amber-700 to-amber-900",
      silver: "from-gray-600 to-gray-800",
      gold: "from-yellow-600 to-yellow-800",
    };
    return colors[name] || colors.free;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const daysRemaining = () => {
    if (!subscription?.expires_at) return 0;
    const diff = new Date(subscription.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) return null;

  const currentPlan = subscription?.plan;
  const isFree = !subscription || subscription.status === "expired" || subscription.status === "cancelled";

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Subscription</h1>

      {/* Current plan card */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm mb-6">
        <div className={`bg-gradient-to-br ${planColor(currentPlan?.name || "free")} p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown size={20} />
                <h2 className="text-xl font-semibold capitalize">
                  {currentPlan?.name || "Free"} Plan
                </h2>
              </div>
              <p className="text-sm opacity-80">
                {isFree ? "You are on the free plan" : `Active until ${formatDate(subscription?.expires_at)}`}
              </p>
            </div>
            <div className="text-right">
              {isFree ? (
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                  Free
                </span>
              ) : (
                <>
                  <p className="text-3xl font-bold">{daysRemaining()}</p>
                  <p className="text-xs opacity-70">days left</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-5">
          {currentPlan && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div>
                <p className="text-xs text-neutral-400">Streaming</p>
                <p className="text-sm font-medium text-neutral-900">{currentPlan.streaming_quality}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Downloads/day</p>
                <p className="text-sm font-medium text-neutral-900">{currentPlan.daily_download_limit}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Watch hours</p>
                <p className="text-sm font-medium text-neutral-900">
                  {currentPlan.max_watch_hours === 0 ? "Unlimited" : `${currentPlan.max_watch_hours} hrs`}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Ads</p>
                <p className="text-sm font-medium text-neutral-900">
                  {currentPlan.ad_free ? "Ad-free" : "With ads"}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Crown size={16} />
              {isFree ? "Upgrade" : "Change plan"}
            </Link>

            {!isFree && subscription?.status === "active" && (
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {canceling ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                Cancel subscription
              </button>
            )}

            {!isFree && subscription?.status === "active" && daysRemaining() <= 7 && (
              <button
                onClick={() => setShowRenewModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <RefreshCw size={16} />
                Renew now
              </button>
            )}
          </div>

          {cancelMessage && (
            <p className="text-sm text-neutral-600 mt-3 bg-neutral-50 rounded-lg p-3">{cancelMessage}</p>
          )}
        </div>
      </div>

      {/* Plan features */}
      {currentPlan && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm mb-6">
          <h3 className="text-sm font-medium text-neutral-900 mb-3">Your plan includes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currentPlan.features?.map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-neutral-700">
                <Check size={16} className="text-green-600" />
                {feat}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Billing history */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-neutral-200">
          <Receipt size={18} className="text-neutral-600" />
          <h3 className="text-sm font-medium text-neutral-900">Billing history</h3>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <CreditCard size={36} className="text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">No transactions yet</p>
            <p className="text-xs text-neutral-400 mt-1">
              Your payment history will appear here after your first purchase.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left text-xs font-medium text-neutral-500 p-3">Invoice</th>
                  <th className="text-left text-xs font-medium text-neutral-500 p-3">Plan</th>
                  <th className="text-left text-xs font-medium text-neutral-500 p-3">Date</th>
                  <th className="text-left text-xs font-medium text-neutral-500 p-3">Amount</th>
                  <th className="text-left text-xs font-medium text-neutral-500 p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="text-sm text-neutral-700 p-3 font-mono text-xs">
                      {tx.invoice_number || "—"}
                    </td>
                    <td className="text-sm text-neutral-700 p-3 capitalize">
                      {(tx.plan as { name: string })?.name || "—"}
                    </td>
                    <td className="text-sm text-neutral-700 p-3">
                      {formatDate(tx.created_at)}
                    </td>
                    <td className="text-sm text-neutral-900 p-3 font-medium">
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.payment_status === "paid" ? "bg-green-100 text-green-700" :
                        tx.payment_status === "failed" ? "bg-red-100 text-red-700" :
                        tx.payment_status === "cancelled" ? "bg-neutral-100 text-neutral-600" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {tx.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Renew modal */}
      {showRenewModal && currentPlan && (
        <PaymentModal
          plan={currentPlan}
          onClose={() => setShowRenewModal(false)}
          onSuccess={() => {
            setShowRenewModal(false);
            void fetchData();
          }}
        />
      )}
    </div>
  );
}
