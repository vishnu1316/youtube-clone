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
      const billingPeriod = (body.billingPeriod as string) || "monthly";
      if (!planId) return jsonResponse({ error: "Missing planId" }, 400);

      const { data: plan, error: planError } = await serviceClient
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();

      if (planError || !plan) return jsonResponse({ error: "Plan not found" }, 404);
      if (plan.name === "free") return jsonResponse({ error: "Cannot purchase free plan" }, 400);

      const amount = billingPeriod === "quarterly"
        ? (plan.quarterly_price || plan.price * 3)
        : billingPeriod === "yearly"
        ? (plan.yearly_price || plan.price * 12)
        : plan.price;

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
          amount: Math.round(amount * 100),
          currency: "INR",
          keyId: RAZORPAY_KEY_ID,
          planName: plan.name,
          planPrice: amount,
          userName,
          userEmail,
          message: "Existing pending order found",
        });
      }

      const amountInPaise = Math.round(amount * 100);
      const orderPayload = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `sub_${Date.now()}`,
        notes: {
          user_id: userId,
          plan_id: planId,
          plan_name: plan.name,
          billing_period: billingPeriod,
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

      const invoiceNumber = `INV-${Date.now()}-${userId.slice(0, 6)}`;
      const { data: tx, error: txError } = await serviceClient
        .from("payment_transactions")
        .insert({
          user_id: userId,
          plan_id: planId,
          razorpay_order_id: orderId,
          invoice_number: invoiceNumber,
          amount: amount,
          currency: "INR",
          payment_status: "created",
          validity_period: billingPeriod,
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
        planPrice: amount,
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
          await serviceClient
            .from("payment_transactions")
            .update({ payment_status: "failed", razorpay_payment_id: razorpayPaymentId, razorpay_signature: razorpaySignature, updated_at: new Date().toISOString() })
            .eq("id", transactionId);

          return jsonResponse({ error: "Payment verification failed. Signature mismatch." }, 400);
        }
      }

      const { data: tx, error: txError } = await serviceClient
        .from("payment_transactions")
        .select("*, plan:subscription_plans(*)")
        .eq("id", transactionId)
        .eq("user_id", userId)
        .maybeSingle();

      if (txError || !tx) {
        return jsonResponse({ error: "Transaction not found" }, 404);
      }

      if (tx.payment_status === "paid") {
        return jsonResponse({
          success: true,
          message: "Payment already verified",
          transaction: tx,
          duplicate: true,
        });
      }

      const now = new Date();
      let endDate = new Date(now);
      const validity = tx.validity_period || "monthly";
      if (validity === "monthly") endDate.setMonth(endDate.getMonth() + 1);
      else if (validity === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
      else if (validity === "yearly") endDate.setFullYear(endDate.getFullYear() + 1);

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

      await serviceClient
        .from("user_subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("status", "active");

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

      // Send confirmation email
      const planName = (tx.plan as { name: string })?.name || "unknown";
      const planPrice = tx.amount;
      const invoiceNum = tx.invoice_number || "N/A";
      const startDateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const endDateStr = endDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const validityLabel = validity === "quarterly" ? "3 months" : validity === "yearly" ? "1 year" : "1 month";

      await sendConfirmationEmail(userEmail, userName, {
        planName,
        planPrice,
        invoiceNum,
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        startDateStr,
        endDateStr,
        validityLabel,
      });

      return jsonResponse({
        success: true,
        message: "Payment verified and subscription activated",
        planName,
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
        .in("status", ["active", "expired"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: transactions } = await serviceClient
        .from("payment_transactions")
        .select("*, plan:subscription_plans(name, price)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (sub && sub.expires_at && new Date(sub.expires_at) < new Date() && sub.status === "active") {
        await serviceClient
          .from("user_subscriptions")
          .update({ status: "expired" })
          .eq("id", sub.id);
        sub.status = "expired";
      }

      return jsonResponse({
        subscription: sub ? { ...sub, plan: sub.plan } : null,
        transactions: transactions || [],
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Payment service error:", err);
    return jsonResponse({ error: "Payment service error" }, 500);
  }
});

async function sendConfirmationEmail(email: string, name: string, details: {
  planName: string;
  planPrice: number;
  invoiceNum: string;
  paymentId: string;
  orderId: string;
  startDateStr: string;
  endDateStr: string;
  validityLabel: string;
}) {
  const subject = `Subscription Confirmation - ${details.planName.toUpperCase()} Plan`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb;">Subscription Activated!</h1>
      <p>Hi ${name},</p>
      <p>Your subscription to the <strong>${details.planName.toUpperCase()}</strong> plan has been successfully activated.</p>
      
      <h2 style="color: #333; font-size: 18px;">Subscription Details</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Plan</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; text-transform: capitalize;">${details.planName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Validity</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${details.validityLabel}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Start Date</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${details.startDateStr}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Expiry Date</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${details.endDateStr}</td></tr>
      </table>

      <h2 style="color: #333; font-size: 18px;">Transaction Information</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Invoice Number</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${details.invoiceNum}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Payment ID</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${details.paymentId}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Order ID</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${details.orderId}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Amount</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${details.planPrice.toFixed(2)}</td></tr>
      </table>

      <p style="background: #f0f9ff; padding: 12px; border-radius: 8px; color: #666; font-size: 14px;">
        Need help? Contact our support team at support@youtubeclone.app
      </p>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">This is an automated email. Please do not reply.</p>
    </div>
  `;

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "YouTube Clone <noreply@youtubeclone.app>",
          to: [email],
          subject,
          html,
        }),
      });
    } catch (err) {
      console.error("Failed to send confirmation email via Resend:", err);
    }
  } else {
    console.log(`[Email] Confirmation email would be sent to ${email}: ${subject}`);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
