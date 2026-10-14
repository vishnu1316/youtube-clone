"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import {
  Shield,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  Trash2,
  Sun,
  Moon,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  Globe,
} from "lucide-react";

type LoginRecord = {
  id: string;
  ip_address: string;
  browser_name: string;
  browser_version: string;
  operating_system: string;
  device_type: string;
  device_model: string | null;
  login_timestamp: string;
  city: string | null;
  state: string | null;
  country: string | null;
  approximate_location: string | null;
  login_status: string;
};

type TrustedDevice = {
  id: string;
  device_fingerprint: string;
  ip_address: string;
  browser_name: string;
  operating_system: string;
  device_type: string;
  city: string | null;
  state: string | null;
  country: string | null;
  trusted_at: string;
  expires_at: string;
  is_active: boolean;
};

export default function SecurityPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { theme, autoTheme, toggleTheme, setAutoTheme } = useTheme();
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [{ data: logins }, { data: devices }] = await Promise.all([
      supabase
        .from("login_history")
        .select("*")
        .order("login_timestamp", { ascending: false })
        .limit(50),
      supabase
        .from("trusted_devices")
        .select("*")
        .eq("is_active", true)
        .order("trusted_at", { ascending: false }),
    ]);

    setLoginHistory((logins as LoginRecord[]) || []);
    setTrustedDevices((devices as TrustedDevice[]) || []);
    setLoading(false);
  };

  const revokeDevice = async (deviceId: string) => {
    await supabase
      .from("trusted_devices")
      .update({ is_active: false })
      .eq("id", deviceId);
    setTrustedDevices((prev) => prev.filter((d) => d.id !== deviceId));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === "Mobile") return <Smartphone size={16} />;
    if (deviceType === "Tablet") return <Tablet size={16} />;
    return <Monitor size={16} />;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      otp_sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      otp_verified: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      failed_otp: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    const labels: Record<string, string> = {
      success: "Success",
      otp_sent: "OTP Sent",
      otp_verified: "OTP Verified",
      failed_otp: "Failed OTP",
      failed: "Failed",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Shield size={24} className="text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Account Security</h1>
      </div>

      {/* Theme preferences */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm mb-6">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-4">Theme Preference</h2>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              theme === "dark"
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            }`}
          >
            {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            {theme === "dark" ? "Dark theme" : "Light theme"}
          </button>

          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={autoTheme}
              onChange={(e) => setAutoTheme(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600"
            />
            Auto-switch based on login time (5 AM - 12 PM IST: light, otherwise dark)
          </label>
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-3">
          Your theme preference is saved to your account and persists across devices.
        </p>
      </div>

      {/* Trusted devices */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="flex items-center gap-2 p-5 border-b border-neutral-200 dark:border-neutral-800">
          <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />
          <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Trusted Devices</h2>
          <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">{trustedDevices.length} active</span>
        </div>

        {trustedDevices.length === 0 ? (
          <div className="p-8 text-center">
            <Monitor size={36} className="text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No trusted devices yet</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Devices that pass OTP verification will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {trustedDevices.map((device) => (
              <div key={device.id} className="flex items-center gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <div className="text-neutral-500 dark:text-neutral-400">
                  {getDeviceIcon(device.device_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {device.browser_name} - {device.operating_system}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Globe size={12} />
                      {device.ip_address}
                    </span>
                    {device.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {[device.city, device.state, device.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Trusted until {formatDate(device.expires_at)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => void revokeDevice(device.id)}
                  className="p-2 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Revoke trust"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Login history */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-neutral-200 dark:border-neutral-800">
          <Clock size={18} className="text-neutral-600 dark:text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Login History</h2>
          <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">{loginHistory.length} records</span>
        </div>

        {loginHistory.length === 0 ? (
          <div className="p-8 text-center">
            <Clock size={36} className="text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No login history yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 p-3">Browser</th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 p-3">OS</th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 p-3">Device</th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 p-3">IP</th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 p-3">Location</th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 p-3">Time</th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.map((record) => (
                  <tr key={record.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="text-sm text-neutral-700 dark:text-neutral-300 p-3">
                      {record.browser_name} {record.browser_version}
                    </td>
                    <td className="text-sm text-neutral-700 dark:text-neutral-300 p-3">{record.operating_system}</td>
                    <td className="text-sm text-neutral-700 dark:text-neutral-300 p-3">
                      {record.device_type}
                      {record.device_model && ` (${record.device_model})`}
                    </td>
                    <td className="text-sm text-neutral-700 dark:text-neutral-300 p-3 font-mono text-xs">{record.ip_address}</td>
                    <td className="text-sm text-neutral-700 dark:text-neutral-300 p-3">
                      {[record.city, record.state, record.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="text-sm text-neutral-700 dark:text-neutral-300 p-3 whitespace-nowrap">
                      {formatDate(record.login_timestamp)}
                    </td>
                    <td className="p-3">{getStatusBadge(record.login_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-5 mt-6">
        <div className="flex items-start gap-3">
          <Mail size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">How OTP verification works</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              When you log in from a new browser, device, IP address, or location, we send a 6-digit verification code to your email.
              Once verified, the device is trusted for 30 days. You can revoke trusted devices anytime above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
