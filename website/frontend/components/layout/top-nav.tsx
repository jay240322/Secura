"use client";

import { useEffect, useState } from "react";
import { Bell, Search, User, LogOut, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { User as UserType } from "@/types";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/repositories": "Repositories",
  "/pull-requests": "Pull Requests",
  "/findings": "Findings",
  "/insights": "Security Insights",
  "/settings": "Settings",
};

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const base = Object.keys(PAGE_TITLES).find((key) =>
    pathname.startsWith(key + "/")
  );
  return base ? PAGE_TITLES[base] : "Secura";
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const title = getTitle(pathname);

  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    // Load current user from stored session or backend
    const stored = api.getStoredUser();
    if (stored) {
      setCurrentUser(stored);
    }
    api.getMe().then((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    });
  }, [pathname]);

  const handleSignOut = () => {
    api.clearAuth();
    setCurrentUser(null);
    setDropdownOpen(false);
    router.push("/login");
  };

  return (
    <header className="flex h-16 items-center border-b border-white/[0.06] bg-[#0d1117] px-6 shrink-0 relative z-30">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-slate-100 mr-auto">{title}</h1>

      {/* Search */}
      <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-400 w-56 mr-4">
        <Search className="h-3.5 w-3.5 mr-1" />
        <span className="text-xs">Search findings…</span>
        <kbd className="ml-auto hidden rounded bg-white/[0.08] px-1.5 text-[10px] text-slate-500 sm:inline">
          ⌘K
        </kbd>
      </div>

      {/* Notifications */}
      <button
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-colors mr-3"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
      </button>

      {/* Auth state / User Profile */}
      {currentUser ? (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06] hover:border-white/[0.15] transition-all"
            aria-label="Profile dropdown"
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name || "User"}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600/30 text-blue-400 font-semibold text-[10px]">
                {(currentUser.name || currentUser.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <span className="max-w-[120px] truncate font-medium">
              {currentUser.name || currentUser.email}
            </span>
          </button>

          {/* Profile Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/[0.08] bg-[#0d1117] p-2 shadow-2xl shadow-black/80 backdrop-blur-xl">
              <div className="px-2.5 py-2 border-b border-white/[0.06] mb-1">
                <div className="text-xs font-semibold text-slate-100 truncate">
                  {currentUser.name || "Secura Developer"}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {currentUser.email}
                </div>
                {currentUser.githubUsername && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-300">
                    <svg className="h-3 w-3 fill-current text-slate-400" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                    <a
                      href={`https://github.com/${currentUser.githubUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      @{currentUser.githubUsername}
                    </a>
                  </div>
                )}
                {currentUser.provider && (
                  <span className="inline-block mt-1 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                    {currentUser.provider} account
                  </span>
                )}
              </div>

              <Link
                href="/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04] hover:text-white transition-colors"
              >
                <SettingsIcon className="h-3.5 w-3.5 text-slate-400" />
                <span>Account Settings</span>
              </Link>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors mt-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.06] transition-all"
          >
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>Sign In</span>
          </Link>
          <Link
            href="/signup"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all"
          >
            <span>Sign Up</span>
          </Link>
        </div>
      )}
    </header>
  );
}
