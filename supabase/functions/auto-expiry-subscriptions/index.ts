import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const now = new Date().toISOString();

    // Find all active subscriptions that have expired
    const { data: expiredSubs, error: fetchErr } = await serviceClient
      .from("user_subscriptions")
      .select("id, user_id, plan_id, expires_at")
      .eq("status", "active")
      .lt("expires_at", now);

    if (fetchErr) {
      return jsonResponse({ error: "Failed to fetch expired subscriptions" }, 500);
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      return jsonResponse({ success: true, message: "No expired subscriptions found", expiredCount: 0 });
    }

    // Mark all expired subscriptions
    const expiredIds = expiredSubs.map((s: { id: string }) => s.id);
    const { error: updateErr } = await serviceClient
      .from("user_subscriptions")
      .update({ status: "expired" })
      .in("id", expiredIds);

    if (updateErr) {
      return jsonResponse({ error: "Failed to update expired subscriptions" }, 500);
    }

    console.log(`[auto-expiry] Downgraded ${expiredIds.length} expired subscriptions to expired status`);

    return jsonResponse({
      success: true,
      message: "Expired subscriptions downgraded",
      expiredCount: expiredIds.length,
      expiredIds,
    });
  } catch (err) {
    console.error("Auto-expiry error:", err);
    return jsonResponse({ error: "Auto-expiry service error" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
