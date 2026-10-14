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

    const body = await req.json();
    const { otpCode, deviceInfo } = body as {
      otpCode: string;
      deviceInfo: {
        ipAddress: string;
        browserName: string;
        browserVersion: string;
        operatingSystem: string;
        deviceType: string;
        deviceModel: string | null;
        city: string | null;
        state: string | null;
        country: string | null;
        approximateLocation: string | null;
      };
    };

    if (!otpCode) {
      return jsonResponse({ error: "OTP code is required" }, 400);
    }

    // Find the latest unused, non-expired OTP for this user
    const { data: otpRecord, error: otpErr } = await serviceClient
      .from("otp_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("is_verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpErr || !otpRecord) {
      // Record failed OTP attempt
      await serviceClient.from("login_history").insert({
        user_id: userId,
        ip_address: deviceInfo.ipAddress,
        browser_name: deviceInfo.browserName,
        browser_version: deviceInfo.browserVersion,
        operating_system: deviceInfo.operatingSystem,
        device_type: deviceInfo.deviceType,
        device_model: deviceInfo.deviceModel,
        city: deviceInfo.city,
        state: deviceInfo.state,
        country: deviceInfo.country,
        approximate_location: deviceInfo.approximateLocation,
        login_status: "failed_otp",
      });

      return jsonResponse({ error: "Invalid or expired OTP code" }, 400);
    }

    if (otpRecord.otp_code !== otpCode) {
      // Record failed OTP attempt
      await serviceClient.from("login_history").insert({
        user_id: userId,
        ip_address: deviceInfo.ipAddress,
        browser_name: deviceInfo.browserName,
        browser_version: deviceInfo.browserVersion,
        operating_system: deviceInfo.operatingSystem,
        device_type: deviceInfo.deviceType,
        device_model: deviceInfo.deviceModel,
        city: deviceInfo.city,
        state: deviceInfo.state,
        country: deviceInfo.country,
        approximate_location: deviceInfo.approximateLocation,
        login_status: "failed_otp",
      });

      return jsonResponse({ error: "Incorrect OTP code. Please try again." }, 400);
    }

    // Mark OTP as verified
    await serviceClient
      .from("otp_codes")
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    const deviceFingerprint = otpRecord.device_fingerprint;

    // Mark device as trusted (30 days)
    const trustExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Check if device already exists in trusted_devices
    const { data: existingDevice } = await serviceClient
      .from("trusted_devices")
      .select("id")
      .eq("user_id", userId)
      .eq("device_fingerprint", deviceFingerprint)
      .maybeSingle();

    if (existingDevice) {
      await serviceClient
        .from("trusted_devices")
        .update({
          is_active: true,
          expires_at: trustExpiresAt,
          ip_address: deviceInfo.ipAddress,
          city: deviceInfo.city,
          state: deviceInfo.state,
          country: deviceInfo.country,
        })
        .eq("id", existingDevice.id);
    } else {
      await serviceClient.from("trusted_devices").insert({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
        ip_address: deviceInfo.ipAddress,
        browser_name: deviceInfo.browserName,
        operating_system: deviceInfo.operatingSystem,
        device_type: deviceInfo.deviceType,
        city: deviceInfo.city,
        state: deviceInfo.state,
        country: deviceInfo.country,
        trusted_at: new Date().toISOString(),
        expires_at: trustExpiresAt,
        is_active: true,
      });
    }

    // Record successful OTP verification in login history
    await serviceClient.from("login_history").insert({
      user_id: userId,
      ip_address: deviceInfo.ipAddress,
      browser_name: deviceInfo.browserName,
      browser_version: deviceInfo.browserVersion,
      operating_system: deviceInfo.operatingSystem,
      device_type: deviceInfo.deviceType,
      device_model: deviceInfo.deviceModel,
      city: deviceInfo.city,
      state: deviceInfo.state,
      country: deviceInfo.country,
      approximate_location: deviceInfo.approximateLocation,
      login_status: "otp_verified",
    });

    return jsonResponse({
      success: true,
      message: "OTP verified successfully. Device has been marked as trusted.",
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return jsonResponse({ error: "OTP verification service error" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
