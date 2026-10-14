export type DeviceInfo = {
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

export function getBrowserInfo(): { name: string; version: string } {
  if (typeof navigator === "undefined") return { name: "Unknown", version: "" };

  const ua = navigator.userAgent;
  let name = "Unknown";
  let version = "";

  if (ua.includes("Edg/")) {
    name = "Edge";
    version = ua.match(/Edg\/([\d.]+)/)?.[1] || "";
  } else if (ua.includes("Chrome/") && !ua.includes("Edg/")) {
    name = "Chrome";
    version = ua.match(/Chrome\/([\d.]+)/)?.[1] || "";
  } else if (ua.includes("Firefox/")) {
    name = "Firefox";
    version = ua.match(/Firefox\/([\d.]+)/)?.[1] || "";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    name = "Safari";
    version = ua.match(/Version\/([\d.]+)/)?.[1] || "";
  } else if (ua.includes("OPR/") || ua.includes("Opera/")) {
    name = "Opera";
    version = ua.match(/(?:OPR|Opera)\/([\d.]+)/)?.[1] || "";
  }

  return { name, version };
}

export function getOSInfo(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  const platform = navigator.platform;

  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS") || ua.includes("MacOS")) return "macOS";
  if (ua.includes("Linux") && !ua.includes("Android")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (platform?.includes("Mac")) return "macOS";
  if (platform?.includes("Win")) return "Windows";
  if (platform?.includes("Linux")) return "Linux";

  return "Unknown";
}

export function getDeviceType(): string {
  if (typeof navigator === "undefined") return "Desktop";
  const ua = navigator.userAgent;

  if (ua.includes("iPad") || (ua.includes("Android") && !ua.includes("Mobile"))) {
    return "Tablet";
  }
  if (ua.includes("iPhone") || ua.includes("Android") && ua.includes("Mobile")) {
    return "Mobile";
  }

  return "Desktop";
}

export function getDeviceModel(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;

  const iphoneMatch = ua.match(/iPhone(\d+,\d+)/);
  if (iphoneMatch) return `iPhone${iphoneMatch[1]}`;

  const ipadMatch = ua.match(/iPad(\d+,\d+)/);
  if (ipadMatch) return `iPad${ipadMatch[1]}`;

  const androidMatch = ua.match(/Android; [\w\s]+; ([\w\s-]+)\)/);
  if (androidMatch) return androidMatch[1].trim();

  return null;
}

export async function collectDeviceInfo(): Promise<DeviceInfo> {
  const browser = getBrowserInfo();
  const os = getOSInfo();
  const deviceType = getDeviceType();
  const deviceModel = getDeviceModel();

  let ipAddress = "unknown";
  let city: string | null = null;
  let state: string | null = null;
  let country: string | null = null;
  let approximateLocation: string | null = null;

  try {
    const res = await fetch("https://ipapi.co/json/");
    if (res.ok) {
      const data = await res.json();
      ipAddress = data.ip || "unknown";
      city = data.city || null;
      state = data.region || null;
      country = data.country_name || null;
      approximateLocation = [city, state, country].filter(Boolean).join(", ") || null;
    }
  } catch {
    // non-critical
  }

  return {
    ipAddress,
    browserName: browser.name,
    browserVersion: browser.version,
    operatingSystem: os,
    deviceType,
    deviceModel,
    city,
    state,
    country,
    approximateLocation,
  };
}
