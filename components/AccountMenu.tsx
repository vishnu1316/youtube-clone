"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { User, LogOut, Settings, UserCircle, Crown, Download } from "lucide-react";

export default function AccountMenu() {
  const { user, channel, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleClick = () => setOpen(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  if (!user) {
    return (
      <Link
        href="/auth/signin"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-300 text-sm font-medium text-neutral-800 hover:bg-neutral-100 transition-colors"
      >
        <UserCircle size={28} className="text-neutral-700" />
        <span>Sign in</span>
      </Link>
    );
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-800 text-sm font-medium hover:bg-neutral-400 transition-colors"
        aria-label="Account menu"
      >
        {channel?.avatar_url ? (
          <img
            src={channel.avatar_url}
            alt={channel.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          user.email?.charAt(0).toUpperCase()
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-xl border border-neutral-200 py-2 z-50">
          <div className="px-4 py-3 border-b border-neutral-200">
            <p className="text-neutral-900 text-sm font-medium truncate">
              {channel?.name || user.email}
            </p>
            <p className="text-neutral-500 text-xs truncate">{user.email}</p>
            <Link
              href="/auth/signin"
              onClick={() => setOpen(false)}
              className="text-blue-600 text-xs mt-1 hover:underline"
            >
              Switch account
            </Link>
          </div>
          <Link
            href={channel ? `/channel/${channel.id}` : "/channel/create"}
            onClick={() => setOpen(false)}
            className="flex items-center gap-4 px-4 py-2.5 text-sm text-neutral-800 hover:bg-neutral-100 transition-colors"
          >
            <User size={18} className="text-neutral-500" />
            Your channel
          </Link>
          <Link
            href="/channel/upload"
            onClick={() => setOpen(false)}
            className="flex items-center gap-4 px-4 py-2.5 text-sm text-neutral-800 hover:bg-neutral-100 transition-colors"
          >
            <Settings size={18} className="text-neutral-500" />
            Upload video
          </Link>
          <Link
            href="/downloads"
            onClick={() => setOpen(false)}
            className="flex items-center gap-4 px-4 py-2.5 text-sm text-neutral-800 hover:bg-neutral-100 transition-colors"
          >
            <Download size={18} className="text-neutral-500" />
            Downloads
          </Link>
          <Link
            href="/subscription"
            onClick={() => setOpen(false)}
            className="flex items-center gap-4 px-4 py-2.5 text-sm text-neutral-800 hover:bg-neutral-100 transition-colors"
          >
            <Crown size={18} className="text-neutral-500" />
            Subscription
          </Link>
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="flex items-center gap-4 px-4 py-2.5 text-sm text-neutral-800 hover:bg-neutral-100 transition-colors"
          >
            <Crown size={18} className="text-neutral-500" />
            Upgrade plan
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-4 px-4 py-2.5 text-sm text-neutral-800 hover:bg-neutral-100 transition-colors"
          >
            <LogOut size={18} className="text-neutral-500" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
