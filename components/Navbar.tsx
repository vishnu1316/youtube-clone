"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Mic,
  Menu,
  Video,
  Bell,
  Home,
  History,
  ThumbsUp,
  Clock,
  Rss,
  Download,
  Crown,
  X,
} from "lucide-react";
import AccountMenu from "./AccountMenu";

const sidebarLinks = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Subscriptions", icon: Rss, href: "/subscriptions" },
  { label: "History", icon: History, href: "/history" },
  { label: "Liked Videos", icon: ThumbsUp, href: "/liked" },
  { label: "Watch Later", icon: Clock, href: "/watch-later" },
  { label: "Downloads", icon: Download, href: "/downloads" },
  { label: "Subscription", icon: Crown, href: "/subscription" },
];

export default function Navbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-2 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-full hover:bg-neutral-100 transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} className="text-neutral-800" />
          </button>
          <Link href="/" className="flex items-center gap-1">
            <span className="text-brand text-2xl font-bold tracking-tighter">
              YouTube
            </span>
          </Link>
        </div>

        <div className="flex-1 max-w-xl mx-2 sm:mx-8 hidden sm:flex items-center">
          <form onSubmit={handleSearch} className="flex flex-1 items-center">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search"
              className="flex-1 h-10 px-4 bg-white border border-neutral-300 rounded-l-full outline-none focus:border-blue-500 text-sm text-neutral-900 placeholder:text-neutral-400"
            />
            <button
              type="submit"
              className="h-10 px-5 bg-neutral-100 border border-l-0 border-neutral-300 rounded-r-full hover:bg-neutral-200 transition-colors"
              aria-label="Search"
            >
              <Search size={20} className="text-neutral-500" />
            </button>
          </form>
          <button
            className="ml-3 p-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors"
            aria-label="Search with voice"
          >
            <Mic size={18} className="text-neutral-700" />
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/channel/upload"
            className="p-2 rounded-full hover:bg-neutral-100 transition-colors hidden sm:block"
            aria-label="Create"
          >
            <Video size={22} className="text-neutral-800" />
          </Link>
          <button
            className="p-2 rounded-full hover:bg-neutral-100 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell size={22} className="text-neutral-800" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brand rounded-full" />
          </button>
          <AccountMenu />
        </div>
      </header>

      <div className="sm:hidden fixed top-14 left-0 right-0 z-40 h-14 bg-white border-b border-neutral-200 flex items-center px-2">
        <form onSubmit={handleSearch} className="flex flex-1 items-center">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search"
            className="flex-1 h-10 px-4 bg-white border border-neutral-300 rounded-l-full outline-none focus:border-blue-500 text-sm text-neutral-900 placeholder:text-neutral-400"
          />
          <button
            type="submit"
            className="h-10 px-5 bg-neutral-100 border border-l-0 border-neutral-300 rounded-r-full hover:bg-neutral-200 transition-colors"
            aria-label="Search"
          >
            <Search size={20} className="text-neutral-500" />
          </button>
        </form>
      </div>

      <aside className="hidden md:flex fixed left-0 top-14 bottom-0 z-40 w-56 bg-white border-r border-neutral-200 flex-col">
        <nav className="py-3">
          {sidebarLinks.map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-5 px-6 py-3 hover:bg-neutral-100 transition-colors text-sm text-neutral-800"
            >
              <Icon size={20} className="text-neutral-600" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 h-full bg-white border-r border-neutral-200 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <span className="text-brand text-xl font-bold">YouTube</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="Close menu"
              >
                <X size={22} className="text-neutral-800" />
              </button>
            </div>
            <nav className="flex-1 py-2">
              {sidebarLinks.map(({ label, icon: Icon, href }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-5 px-6 py-3 hover:bg-neutral-100 transition-colors text-sm text-neutral-800"
                >
                  <Icon size={20} className="text-neutral-600" />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
