import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DownloadQuota {
  planName: string;
  dailyLimit: number;
  monthlyLimit: number;
  todayDownloads: number;
  monthDownloads: number;
  remainingToday: number;
  remainingThisMonth: number;
  alreadyDownloadedToday: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;

    const body = await req.json();
    const action = body.action as string;

    // Parse device info from request
    const userAgent = req.headers.get("user-agent") || "unknown";
    const forwarded = req.headers.get("x-forwarded-for") || "";
    const ip = forwarded.split(",")[0].trim() || "unknown";

    const deviceInfo = parseDeviceInfo(userAgent);
    const browser = parseBrowser(userAgent);

    // ---- CHECK QUOTA ----
    if (action === "check-quota") {
      const quota = await getQuota(supabase, userId);
      return new Response(JSON.stringify({ quota }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- AUTHORIZE DOWNLOAD ----
    if (action === "authorize") {
      const videoId = body.videoId as string;
      if (!videoId) {
        return new Response(JSON.stringify({ error: "Missing videoId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify video exists and has a URL
      const { data: video, error: videoError } = await supabase
        .from("videos")
        .select("id, title, video_url, thumbnail_url, duration")
        .eq("id", videoId)
        .maybeSingle();

      if (videoError || !video) {
        return new Response(JSON.stringify({ error: "Video not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!video.video_url) {
        return new Response(JSON.stringify({ error: "This video has no downloadable source" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get quota
      const quota = await getQuota(supabase, userId);

      // Check if already downloaded today (duplicate doesn't count)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: existingDownload } = await supabase
        .from("download_records")
        .select("id, status")
        .eq("user_id", userId)
        .eq("video_id", videoId)
        .gte("downloaded_at", todayStart.toISOString())
        .order("downloaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const alreadyDownloadedToday = Boolean(existingDownload);

      // If already downloaded today, allow re-download without consuming quota
      if (alreadyDownloadedToday) {
        return new Response(JSON.stringify({
          authorized: true,
          video: {
            id: video.id,
            title: video.title,
            video_url: video.video_url,
            thumbnail_url: video.thumbnail_url,
            duration: video.duration,
          },
          quota,
          alreadyDownloadedToday: true,
          message: "You already downloaded this video today. Re-downloading does not count against your quota.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check daily quota
      if (quota.remainingToday <= 0) {
        return new Response(JSON.stringify({
          authorized: false,
          error: `You have reached your daily download limit (${quota.dailyLimit}) for the ${quota.planName} plan. Your quota resets at midnight.`,
          quota,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check monthly quota (if applicable)
      if (quota.monthlyLimit > 0 && quota.remainingThisMonth <= 0) {
        return new Response(JSON.stringify({
          authorized: false,
          error: `You have reached your monthly download limit (${quota.monthlyLimit}) for the ${quota.planName} plan.`,
          quota,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        authorized: true,
        video: {
          id: video.id,
          title: video.title,
          video_url: video.video_url,
          thumbnail_url: video.thumbnail_url,
          duration: video.duration,
        },
        quota,
        alreadyDownloadedToday: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- RECORD DOWNLOAD ----
    if (action === "record") {
      const videoId = body.videoId as string;
      const status = body.status as string || "completed";
      const fileSize = body.fileSize as string || null;

      if (!videoId) {
        return new Response(JSON.stringify({ error: "Missing videoId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get plan name
      const planName = await getPlanName(supabase, userId);

      // Check if already recorded today (prevent duplicate count)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: existingRecord } = await supabase
        .from("download_records")
        .select("id")
        .eq("user_id", userId)
        .eq("video_id", videoId)
        .gte("downloaded_at", todayStart.toISOString())
        .maybeSingle();

      if (existingRecord) {
        // Already recorded today, return existing info
        const quota = await getQuota(supabase, userId);
        return new Response(JSON.stringify({
          success: true,
          alreadyRecorded: true,
          message: "Download already recorded today. No additional quota consumed.",
          quota,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Insert download record
      const { error: insertError } = await supabase
        .from("download_records")
        .insert({
          user_id: userId,
          video_id: videoId,
          ip_address: ip,
          device_info: deviceInfo,
          browser,
          plan_used: planName,
          status,
          file_size: fileSize,
        });

      if (insertError) {
        return new Response(JSON.stringify({ error: "Failed to record download" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const quota = await getQuota(supabase, userId);

      return new Response(JSON.stringify({
        success: true,
        alreadyRecorded: false,
        quota,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Download service error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getQuota(supabase: ReturnType<typeof createClient>, userId: string): Promise<DownloadQuota> {
  const planName = await getPlanName(supabase, userId);

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("daily_download_limit, monthly_download_limit")
    .eq("name", planName)
    .maybeSingle();

  const dailyLimit = plan?.daily_download_limit ?? 1;
  const monthlyLimit = plan?.monthly_download_limit ?? 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: todayCount } = await supabase
    .from("download_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("downloaded_at", todayStart.toISOString());

  const { count: monthCount } = await supabase
    .from("download_records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("downloaded_at", monthStart.toISOString());

  const todayDownloads = todayCount ?? 0;
  const monthDownloads = monthCount ?? 0;

  return {
    planName,
    dailyLimit,
    monthlyLimit,
    todayDownloads,
    monthDownloads,
    remainingToday: Math.max(0, dailyLimit - todayDownloads),
    remainingThisMonth: monthlyLimit > 0 ? Math.max(0, monthlyLimit - monthDownloads) : -1,
    alreadyDownloadedToday: false,
  };
}

async function getPlanName(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("status, expires_at, plan:subscription_plans(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub && sub.status === "active") {
    // Check expiry
    if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
      return "free";
    }
    const planData = sub.plan as { name: string } | null;
    if (planData?.name) return planData.name;
  }

  return "free";
}

function parseDeviceInfo(userAgent: string): string {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const osMatch = userAgent.match(/\(([^)]+)\)/);
  const os = osMatch ? osMatch[1].split(";")[0].trim() : "Unknown OS";
  return `${isMobile ? "Mobile" : "Desktop"} - ${os}`;
}

function parseBrowser(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return "Microsoft Edge";
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return "Google Chrome";
  if (/Firefox\//.test(userAgent)) return "Mozilla Firefox";
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Apple Safari";
  if (/OPR\//.test(userAgent)) return "Opera";
  return "Unknown Browser";
}
