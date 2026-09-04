"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2 } from "lucide-react";
import { supabase, SubscriptionPlan } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import PaymentModal from "@/components/PaymentModal";

type PlanConfig = {
  gradient: string;
  badge: string;
  badgeColor: string;
  highlight: boolean;
};

const PLAN_CONFIGS: Record<string, PlanConfig> = {
  free: { gradient: "from-neutral-700 to-neutral-900", badge: "", badgeColor: "", highlight: false },
  bronze: { gradient: "from-amber-700 to-amber-900", badge: "Popular", badgeColor: "bg-amber-100 text-amber-700", highlight: false },
  silver: { gradient: "from-gray-600 to-gray-800", badge: "Best Value", badgeColor: "bg-gray-200 text-gray-700", highlight: true },
  gold: { gradient: "from-yellow-600 to-yellow-800", badge: "Premium", badgeColor: "bg-yellow-100 text-yellow-700", highlight: false },
};

export default function PricingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [currentPlanName, setCurrentPlanName] = useState("free");

  useEffect(() => {
    void fetchPlans();
  }, []);

  useEffect(() => {
    if (user) void fetchCurrentPlan();
  }, [user]);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true });
    setPlans((data as SubscriptionPlan[]) || []);
    setLoading(false);
  };

  const fetchCurrentPlan = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token || !supabaseUrl) return;

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/razorpay-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "status" }),
      });
      const data = await res.json();
      if (data.subscription?.plan?.name) {
        setCurrentPlanName(data.subscription.plan.name);
      }
    } catch {
      // non-critical
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    if (plan.name === currentPlanName) return;
    setSelectedPlan(plan);
  };

  const handlePaymentSuccess = () => {
    setSelectedPlan(null);
    router.push("/subscription");
  };

  if (loading || authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-3">
          Choose your plan
        </h1>
        <p className="text-neutral-500 text-sm sm:text-base max-w-xl mx-auto">
          Unlock premium features, higher quality streaming, and more downloads with a paid plan.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {plans.map((plan) => {
          const config = PLAN_CONFIGS[plan.name] || PLAN_CONFIGS.free;
          const isCurrent = plan.name === currentPlanName;
          const isFree = plan.name === "free";

          const cardBorder = config.highlight
            ? "border-blue-500 shadow-lg scale-[1.02]"
            : "border-neutral-200 shadow-sm";
          const cardHover = isCurrent ? "opacity-75" : "hover:shadow-md hover:border-neutral-300";

          let btnClass = "bg-neutral-900 text-white hover:bg-neutral-800";
          if (isCurrent) btnClass = "bg-neutral-100 text-neutral-500 cursor-default";
          else if (isFree) btnClass = "bg-neutral-100 text-neutral-700 hover:bg-neutral-200";
          else if (config.highlight) btnClass = "bg-blue-600 text-white hover:bg-blue-700";

          const btnLabel = isCurrent
            ? "Current Plan"
            : isFree
            ? "Your default"
            : `Get ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}`;

          return (
            <div key={plan.id} className={`relative bg-white rounded-2xl border-2 transition-all ${cardBorder} ${cardHover}`}>
              {config.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium ${config.badgeColor}`}>
                  {config.badge}
                </div>
              )}

              <div className={`bg-gradient-to-br ${config.gradient} rounded-t-xl p-5 text-white`}>
                <div className="flex items-center gap-2 mb-1">
                  <Crown size={18} />
                  <h3 className="text-lg font-semibold capitalize">{plan.name}</h3>
                </div>
                <p className="text-xs opacity-80 mb-3">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">${plan.price.toFixed(2)}</span>
                  <span className="text-sm opacity-70">/{plan.validity_period}</span>
                </div>
              </div>

              <div className="p-5">
                <ul className="space-y-2.5 mb-5">
                  {plan.features?.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-neutral-700">
                      <Check size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${btnClass}`}
                >
                  {btnLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <h2 className="text-lg font-semibold text-neutral-900 p-5 border-b border-neutral-200">
          Feature comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left text-sm font-medium text-neutral-600 p-4">Feature</th>
                {plans.map((p) => (
                  <th key={p.id} className="text-center text-sm font-medium text-neutral-900 p-4 capitalize">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ComparisonRow label="Monthly price" values={plans.map(p => `$${p.price.toFixed(2)}`)} />
              <ComparisonRow label="Streaming quality" values={plans.map(p => p.streaming_quality)} />
              <ComparisonRow label="Daily downloads" values={plans.map(p => `${p.daily_download_limit}`)} />
              <ComparisonRow label="Daily watch hours" values={plans.map(p => p.max_watch_hours === 0 ? "Unlimited" : `${p.max_watch_hours} hrs`)} />
              <ComparisonRow label="Ad-free viewing" values={plans.map(p => p.ad_free)} boolean />
              <ComparisonRow label="Offline downloads" values={plans.map(p => p.offline_downloads)} boolean />
              <ComparisonRow label="Faster streaming" values={plans.map(p => p.faster_streaming)} boolean />
              <ComparisonRow label="Priority content" values={plans.map(p => p.priority_content)} boolean />
              <ComparisonRow label="Premium courses" values={plans.map(p => p.premium_courses)} boolean />
            </tbody>
          </table>
        </div>
      </div>

      {selectedPlan && (
        <PaymentModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

function ComparisonRow({ label, values, boolean }: { label: string; values: (string | boolean)[]; boolean?: boolean }) {
  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
      <td className="text-sm text-neutral-700 p-4">{label}</td>
      {values.map((v, idx) => (
        <td key={idx} className="text-center p-4">
          {boolean ? (
            v ? <Check size={18} className="text-green-600 mx-auto" /> : <span className="text-neutral-300">—</span>
          ) : (
            <span className="text-sm text-neutral-900 font-medium">{v}</span>
          )}
        </td>
      ))}
    </tr>
  );
}
