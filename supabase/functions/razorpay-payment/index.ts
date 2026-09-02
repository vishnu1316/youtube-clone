import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = authData.user.id;
    const userEmail = authData.user.email || "";
    const userName = (authData.user.user_metadata?.full_name as string) || userEmail;

    const body = await req.json();
    const action = body.action as string;

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") || "rzp_test_1DP5mmOlF5G5AG";
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") || "";

    // ---- CREATE ORDER ----
    if (action === "create-order") {
      const planId = body.planId as string;
      if (!planId) return jsonResponse({ error: "Missing planId" }, 400);

      const { data: plan, error: planError } = await serviceClient
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();

      if (planError || !plan) return jsonResponse({ error: "Plan not found" }, 404);
      if (plan.name === "free") return jsonResponse({ error: "Cannot purchase free plan" }, 400);

      // Check for existing pending transaction for same plan
      const { data: existingTx } = await serviceClient
        .from("payment_transactions")
        .select("id, razorpay_order_id")
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .eq("payment_status", "created")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingTx?.razorpay_order_id) {
        return jsonResponse({
          orderId: existingTx.razorpay_order_id,
          transactionId: existingTx.id,
          amount: plan.price * 100,
          currency: "INR",
          keyId: RAZORPAY_KEY_ID,
          planName: plan.name,
          planPrice: plan.price,
          message: "Existing pending order found",
        });
      }

      // Create Razorpay order
      const amountInPaise = Math.round(plan.price * 100);
      const orderPayload = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `sub_${Date.now()}`,
        notes: {
          user_id: userId,
          plan_id: planId,
          plan_name: plan.name,
        },
      };

      let orderId: string;
      try {
        const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
          },
          body: JSON.stringify(orderPayload),
        });

        if (!orderRes.ok) {
          const errText = await orderRes.text();
          console.error("Razorpay order creation failed:", errText);
          return jsonResponse({ error: "Failed to create payment order. Check Razorpay credentials." }, 502);
        }

        const orderData = await orderRes.json();
        orderId = orderData.id;
      } catch (err) {
        console.error("Razorpay API error:", err);
        return jsonResponse({ error: "Payment service unavailable" }, 502);
      }

      // Create transaction record
      const invoiceNumber = `INV-${Date.now()}-${userId.slice(0, 6)}`;
      const { data: tx, error: txError } = await serviceClient
        .from("payment_transactions")
        .insert({
          user_id: userId,
          plan_id: planId,
          razorpay_order_id: orderId,
          invoice_number: invoiceNumber,
          amount: plan.price,
          currency: "INR",
          payment_status: "created",
          validity_period: plan.validity_period,
        })
        .select()
        .single();

      if (txError) {
        return jsonResponse({ error: "Failed to create transaction record" }, 500);
      }

      return jsonResponse({
        orderId,
        transactionId: tx.id,
        amount: amountInPaise,
        currency: "INR",
        keyId: RAZORPAY_KEY_ID,
        planName: plan.name,
        planPrice: plan.price,
        userName,
        userEmail,
      });
    }

    // ---- VERIFY PAYMENT ----
    if (action === "verify-payment") {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature, transactionId } = body;
      if (!razorpayPaymentId || !razorpayOrderId || !transactionId) {
        return jsonResponse({ error: "Missing payment details" }, 400);
      }

      // Verify signature if secret is configured
      if (RAZORPAY_KEY_SECRET) {
        const crypto = globalThis.crypto;
        const encoder = new TextEncoder();
        const keyData = encoder.encode(RAZORPAY_KEY_SECRET);
        const messageData = encoder.encode(`${razorpayOrderId}|${razorpayPaymentId}`);

        const key = await crypto.subtle.importKey(
          "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        );
        const signature = await crypto.subtle.sign("HMAC", key, messageData);
        const expectedSignature = Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, "0")).join("");

        if (expectedSignature !== razorpaySignature) {
          // Mark transaction as failed
          await serviceClient
            .from("payment_transactions")
            .update({ payment_status: "failed", razorpay_payment_id: razorpayPaymentId, razorpay_signature: razorpaySignature, updated_at: new Date().toISOString() })
            .eq("id", transactionId);

          return jsonResponse({ error: "Payment verification failed. Signature mismatch." }, 400);
        }
      }

      // Fetch transaction
      const { data: tx, error: txError } = await serviceClient
        .from("payment_transactions")
        .select("*, plan:subscription_plans(*)")
        .eq("id", transactionId)
        .eq("user_id", userId)
        .maybeSingle();

      if (txError || !tx) {
        return jsonResponse({ error: "Transaction not found" }, 404);
      }

      // Check for duplicate payment
      if (tx.payment_status === "paid") {
        return jsonResponse({
          success: true,
          message: "Payment already verified",
          transaction: tx,
          duplicate: true,
        });
      }

      // Calculate subscription dates
      const now = new Date();
      let endDate = new Date(now);
      const validity = tx.validity_period || "monthly";
      if (validity === "monthly") endDate.setMonth(endDate.getMonth() + 1);
      else if (validity === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
      else if (validity === "yearly") endDate.setFullYear(endDate.getFullYear() + 1);

      // Update transaction as paid
      const { error: updateErr } = await serviceClient
        .from("payment_transactions")
        .update({
          payment_status: "paid",
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature || null,
          subscription_start_date: now.toISOString(),
          subscription_end_date: endDate.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", transactionId);

      if (updateErr) {
        return jsonResponse({ error: "Failed to update transaction" }, 500);
      }

      // Cancel any existing active subscription
      await serviceClient
        .from("user_subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("status", "active");

      // Create new subscription
      const { error: subErr } = await serviceClient
        .from("user_subscriptions")
        .insert({
          user_id: userId,
          plan_id: tx.plan_id,
          status: "active",
          started_at: now.toISOString(),
          expires_at: endDate.toISOString(),
        });

      if (subErr) {
        return jsonResponse({ error: "Payment verified but subscription creation failed" }, 500);
      }

      return jsonResponse({
        success: true,
        message: "Payment verified and subscription activated",
        planName: (tx.plan as { name: string })?.name || "unknown",
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        invoiceNumber: tx.invoice_number,
        amount: tx.amount,
        currency: tx.currency,
      });
    }

    // ---- CANCEL PAYMENT ----
    if (action === "cancel-payment") {
      const { transactionId } = body;
      if (!transactionId) return jsonResponse({ error: "Missing transactionId" }, 400);

      await serviceClient
        .from("payment_transactions")
        .update({ payment_status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", transactionId)
        .eq("user_id", userId)
        .in("payment_status", ["created", "pending"]);

      return jsonResponse({ success: true, message: "Payment cancelled" });
    }

    // ---- CANCEL SUBSCRIPTION ----
    if (action === "cancel-subscription") {
      const { error: cancelErr } = await serviceClient
        .from("user_subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("status", "active");

      if (cancelErr) {
        return jsonResponse({ error: "Failed to cancel subscription" }, 500);
      }

      return jsonResponse({ success: true, message: "Subscription cancelled" });
    }

    // ---- GET SUBSCRIPTION STATUS ----
    if (action === "status") {
      const { data: sub } = await serviceClient
        .from("user_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: transactions } = await serviceClient
        .from("payment_transactions")
        .select("*, plan:subscription_plans(name, price)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Check if subscription expired
      if (sub && sub.expires_at && new Date(sub.expires_at) < new Date()) {
        await serviceClient
          .from("user_subscriptions")
          .update({ status: "expired" })
          .eq("id", sub.id);
        sub.status = "expired";
      }

      return jsonResponse({
        subscription: sub ? {
          ...sub,
          plan: sub.plan,
        } : null,
        transactions: transactions || [],
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Payment service error:", err);
    return jsonResponse({ error: "Payment service error" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
