"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { collectDeviceInfo, type DeviceInfo } from "@/lib/device-info";
import { Loader2, ShieldCheck, AlertCircle, Mail } from "lucide-react";

export default function VerifyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"checking" | "otp-required" | "verifying" | "success" | "failed">("checking");
  const [message, setMessage] = useState("");
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [resendDisabled, setResendDisabled] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    void checkLogin();
  }, [authLoading, user]);

  const checkLogin = async () => {
    if (!user) return;
    setStatus("checking");

    const info = await collectDeviceInfo();
    setDeviceInfo(info);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token || !supabaseUrl) {
      router.push("/");
      return;
    }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/track-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "check-login", ...info }),
      });
      const data = await res.json();

      if (data.requiresOtp) {
        setStatus("otp-required");
        setMessage(data.message || "OTP sent to your email");
      } else {
        setStatus("success");
        setTimeout(() => router.push("/"), 1500);
      }
    } catch {
      setStatus("failed");
      setError("Could not verify device. Please try again.");
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((d) => d !== "") && newOtp.join("").length === 6) {
      void verifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split("");
      setOtp(newOtp);
      void verifyOtp(pasted);
    }
  };

  const verifyOtp = async (code: string) => {
    if (!user || !deviceInfo) return;
    setStatus("verifying");
    setError("");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token || !supabaseUrl) {
      router.push("/");
      return;
    }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otpCode: code, deviceInfo }),
      });
      const data = await res.json();

      if (data.error) {
        setStatus("otp-required");
        setError(data.error);
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      if (data.success) {
        setStatus("success");
        setMessage(data.message || "Verification successful");
        setTimeout(() => router.push("/"), 1500);
      }
    } catch {
      setStatus("otp-required");
      setError("Verification failed. Please try again.");
      setOtp(["", "", "", "", "", ""]);
    }
  };

  const resendOtp = async () => {
    setResendDisabled(true);
    await checkLogin();
    setTimeout(() => setResendDisabled(false), 30000);
  };

  if (authLoading || status === "checking") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 size={32} className="animate-spin text-blue-600 mb-3" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Checking device security...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck size={32} className="text-green-600 dark:text-green-400" />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{message}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-8 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3">
              <Mail size={28} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 text-center">
              Verify your device
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mt-2">
              We detected a login from a new device or browser. Enter the 6-digit code sent to your email.
            </p>
          </div>

          {status === "failed" ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={28} className="text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={() => void checkLogin()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {error && (
                <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4 text-center">
                  {error}
                </p>
              )}

              <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    disabled={status === "verifying"}
                    className="w-12 h-14 text-center text-xl font-bold bg-neutral-50 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-700 rounded-lg outline-none focus:border-blue-500 text-neutral-900 dark:text-neutral-100 transition-colors disabled:opacity-50"
                  />
                ))}
              </div>

              {status === "verifying" && (
                <div className="flex items-center justify-center mb-4">
                  <Loader2 size={20} className="animate-spin text-blue-600 mr-2" />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Verifying...</span>
                </div>
              )}

              <button
                onClick={() => void resendOtp()}
                disabled={resendDisabled || status === "verifying"}
                className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline text-center"
              >
                {resendDisabled ? "Resend code in 30s" : "Resend code"}
              </button>

              <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="text-xs text-neutral-400 dark:text-neutral-500 space-y-1">
                  <p>Browser: {deviceInfo?.browserName} {deviceInfo?.browserVersion}</p>
                  <p>OS: {deviceInfo?.operatingSystem}</p>
                  <p>Device: {deviceInfo?.deviceType}</p>
                  {deviceInfo?.approximateLocation && (
                    <p>Location: {deviceInfo.approximateLocation}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
