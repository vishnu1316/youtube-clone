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

    const body = await req.json();
    const action = body.action as string;

    // Parse device info from request body (sent from frontend)
    const deviceInfo = {
      ip_address: body.ipAddress || "unknown",
      browser_name: body.browserName || "Unknown",
      browser_version: body.browserVersion || "",
      operating_system: body.operatingSystem || "Unknown",
      device_type: body.deviceType || "Desktop",
      device_model: body.deviceModel || null,
      city: body.city || null,
      state: body.state || null,
      country: body.country || null,
      approximate_location: body.approximateLocation || null,
    };

    const deviceFingerprint = `${deviceInfo.browser_name}|${deviceInfo.operating_system}|${deviceInfo.device_type}|${deviceInfo.ip_address}`;

    // ---- CHECK LOGIN (called after signin to check if OTP is needed) ----
    if (action === "check-login") {
      // Check if this device is already trusted and not expired
      const { data: trustedDevice } = await serviceClient
        .from("trusted_devices")
        .select("*")
        .eq("user_id", userId)
        .eq("device_fingerprint", deviceFingerprint)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (trustedDevice) {
        // Device is trusted, record successful login
        await serviceClient.from("login_history").insert({
          user_id: userId,
          ...deviceInfo,
          login_status: "success",
        });

        return jsonResponse({
          requiresOtp: false,
          message: "Device trusted, login successful",
        });
      }

      // Device is not trusted, generate OTP
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Invalidate any previous unused OTPs
      await serviceClient
        .from("otp_codes")
        .update({ is_verified: true })
        .eq("user_id", userId)
        .eq("is_verified", false);

      const { error: otpErr } = await serviceClient.from("otp_codes").insert({
        user_id: userId,
        otp_code: otpCode,
        delivery_method: "email",
        device_fingerprint: deviceFingerprint,
        ip_address: deviceInfo.ip_address,
        expires_at: expiresAt,
      });

      if (otpErr) {
        return jsonResponse({ error: "Failed to generate OTP" }, 500);
      }

      // Record OTP sent in login history
      await serviceClient.from("login_history").insert({
        user_id: userId,
        ...deviceInfo,
        login_status: "otp_sent",
      });

      // Send OTP via email using Supabase auth admin
      try {
        await sendOtpEmail(userEmail, otpCode);
      } catch (err) {
        console.error("Failed to send OTP email:", err);
      }

      return jsonResponse({
        requiresOtp: true,
        message: "OTP sent to your registered email address",
        deliveryMethod: "email",
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Track login error:", err);
    return jsonResponse({ error: "Login tracking service error" }, 500);
  }
});

async function sendOtpEmail(email: string, otpCode: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb;">Verify Your Login</h1>
      <p>We detected a login from a new device or browser. For your security, please verify your identity.</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; background: #f0f9ff; padding: 15px 30px; border-radius: 12px;">${otpCode}</span>
      </div>
      <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you did not attempt to log in, please ignore this email and consider changing your password.</p>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">This is an automated email. Please do not reply.</p>
    </div>
  `;

  if (RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "YouTube Clone <noreply@youtubeclone.app>",
        to: [email],
        subject: "Your Login Verification Code",
        html,
      }),
    });
  } else {
    console.log(`[OTP] Code for ${email}: ${otpCode}`);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
