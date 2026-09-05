"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, AlertCircle, X } from "lucide-react";
import { supabase, SubscriptionPlan } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

type PaymentState = "idle" | "creating-order" | "checkout" | "verifying" | "success" | "error" | "cancelled";
type BillingPeriod = "monthly" | "quarterly" | "yearly";

export default function PaymentModal({
  plan,
  billingPeriod = "monthly",
  onClose,
  onSuccess,
}: {
  plan: SubscriptionPlan;
  billingPeriod?: BillingPeriod;
  onClose: () => void;
  onSuccess: (result: { planName: string; endDate: string; invoiceNumber: string }) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [state, setState] = useState<PaymentState>("idle");
  const [message, setMessage] = useState("");
  const [transactionId, setTransactionId] = useState("");

  useEffect(() => {
    if (plan.name === "free") {
      onClose();
      return;
    }
    void startPayment();
  }, [plan]);

  const callEdgeFunction = async (payload: Record<string, unknown>) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("No session");

    const res = await fetch(`${supabaseUrl}/functions/v1/razorpay-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  const startPayment = async () => {
    setState("creating-order");
    setMessage("");

    let orderResult: {
      orderId?: string;
      transactionId?: string;
      amount?: number;
      currency?: string;
      keyId?: string;
      planName?: string;
      planPrice?: number;
      userName?: string;
      userEmail?: string;
      error?: string;
    };

    try {
      orderResult = await callEdgeFunction({
        action: "create-order",
        planId: plan.id,
        billingPeriod,
      });
    } catch {
      setState("error");
      setMessage("Could not connect to payment service. Please try again.");
      return;
    }

    if (orderResult.error) {
      setState("error");
      setMessage(orderResult.error);
      return;
    }

    setTransactionId(orderResult.transactionId || "");
    setState("checkout");

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => openRazorpayCheckout(orderResult);
    script.onerror = () => {
      setState("error");
      setMessage("Failed to load payment checkout. Check your connection and try again.");
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  };

  const openRazorpayCheckout = (order: {
    orderId?: string;
    amount?: number;
    currency?: string;
    keyId?: string;
    planName?: string;
    userName?: string;
    userEmail?: string;
  }) => {
    const Razorpay = (window as unknown as Record<string, unknown>).Razorpay as unknown as new (opts: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: unknown) => void) => void;
    };

    if (!Razorpay) {
      setState("error");
      setMessage("Payment checkout failed to load.");
      return;
    }

    const options: Record<string, unknown> = {
      key: order.keyId || "rzp_test_1DP5mmOlF5G5AG",
      amount: order.amount,
      currency: order.currency || "INR",
      name: "YouTube Clone",
      description: `${order.planName} Plan Subscription (${billingPeriod})`,
      order_id: order.orderId,
      prefill: {
        name: order.userName || "",
        email: order.userEmail || "",
      },
      theme: { color: "#2563eb" },
      handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        void verifyPayment(response);
      },
      modal: {
        ondismiss: () => {
          if (state !== "success" && state !== "verifying") {
            setState("cancelled");
            setMessage("Payment was cancelled.");
            void cancelPayment();
          }
        },
      },
    };

    const rzp = new Razorpay(options);
    rzp.on("payment.failed", (resp: unknown) => {
      const err = resp as { error?: { description?: string } };
      setState("error");
      setMessage(err?.error?.description || "Payment failed. Please try again.");
    });
    rzp.open();
  };

  const verifyPayment = async (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    setState("verifying");
    setMessage("Verifying payment...");

    let verifyResult: {
      success?: boolean;
      error?: string;
      message?: string;
      planName?: string;
      endDate?: string;
      invoiceNumber?: string;
      duplicate?: boolean;
    };

    try {
      verifyResult = await callEdgeFunction({
        action: "verify-payment",
        razorpayPaymentId: response.razorpay_payment_id,
        razorpayOrderId: response.razorpay_order_id,
        razorpaySignature: response.razorpay_signature,
        transactionId,
      });
    } catch {
      setState("error");
      setMessage("Payment verification failed due to a network error. Your payment may have been processed. Please contact support.");
      return;
    }

    if (verifyResult.error) {
      setState("error");
      setMessage(verifyResult.error);
      return;
    }

    if (verifyResult.success) {
      setState("success");
      setMessage(verifyResult.message || "Payment successful!");
      setTimeout(() => {
        onSuccess({
          planName: verifyResult.planName || plan.name,
          endDate: verifyResult.endDate || "",
          invoiceNumber: verifyResult.invoiceNumber || "",
        });
      }, 2000);
    }
  };

  const cancelPayment = async () => {
    if (!transactionId) return;
    try {
      await callEdgeFunction({ action: "cancel-payment", transactionId });
    } catch {
      // non-critical
    }
  };

  if (!user) {
    router.push("/auth/signin");
    return null;
  }

  const periodLabel = billingPeriod === "quarterly" ? "3 months" : billingPeriod === "yearly" ? "1 year" : "1 month";
  const displayPrice = billingPeriod === "quarterly"
    ? plan.quarterly_price || plan.price * 3
    : billingPeriod === "yearly"
    ? plan.yearly_price || plan.price * 12
    : plan.price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            Subscribe to {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-100 transition-colors"
            disabled={state === "verifying"}
          >
            <X size={20} className="text-neutral-500" />
          </button>
        </div>

        <div className="bg-neutral-50 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-neutral-600">Plan</span>
            <span className="text-sm font-medium text-neutral-900 capitalize">{plan.name}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-neutral-600">Price</span>
            <span className="text-sm font-medium text-neutral-900">
              ${displayPrice.toFixed(2)} <span className="text-neutral-400">/ {periodLabel}</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-neutral-600">Validity</span>
            <span className="text-sm font-medium text-neutral-900 capitalize">{billingPeriod}</span>
          </div>
        </div>

        {(state === "creating-order" || state === "verifying") && (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={24} className="animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-neutral-600">{message}</span>
          </div>
        )}

        {state === "checkout" && (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={24} className="animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-neutral-600">Opening payment checkout...</span>
          </div>
        )}

        {state === "success" && (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={28} className="text-green-600" />
            </div>
            <p className="text-sm font-medium text-neutral-900">{message}</p>
            <p className="text-xs text-neutral-500 mt-2">A confirmation email has been sent to your inbox.</p>
            <p className="text-xs text-neutral-500 mt-1">Redirecting to your dashboard...</p>
          </div>
        )}

        {state === "error" && (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={28} className="text-red-600" />
            </div>
            <p className="text-sm font-medium text-red-600">{message}</p>
            <button
              onClick={() => void startPayment()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {state === "cancelled" && (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <X size={28} className="text-neutral-500" />
            </div>
            <p className="text-sm font-medium text-neutral-700">{message}</p>
            <button
              onClick={() => void startPayment()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {state === "idle" && (
          <button
            onClick={() => void startPayment()}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Proceed to pay ${displayPrice.toFixed(2)}
          </button>
        )}
      </div>
    </div>
  );
}
