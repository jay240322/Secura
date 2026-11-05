"use client";

import { useEffect, useState } from "react";
import { Bell, Search, User, LogOut, Settings as SettingsIcon, Sun, Moon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { User as UserType } from "@/types";
import { useTheme } from "@/components/theme-provider";

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
  const { theme, toggleTheme } = useTheme();

  const isRepoDetail = pathname.startsWith("/repositories/") && pathname !== "/repositories";
  const repoId = isRepoDetail ? pathname.split("/repositories/")[1]?.split("/")[0]?.split("?")[0] : null;

  const [repoName, setRepoName] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (isRepoDetail && repoId) {
      const decoded = decodeURIComponent(repoId);
      let initialGuess = decoded;
      if (initialGuess.startsWith("repo-")) {
        const parts = initialGuess.split("-");
        if (parts.length > 2) {
          initialGuess = parts.slice(2).join("-");
        } else {
          initialGuess = "Repository";
        }
      }
      setRepoName(initialGuess);

      void api.getRepositoryById(repoId).then((r) => {
        if (r) {
          const cleanName = r.name || (r.fullName ? r.fullName.split("/").pop() : null);
          if (cleanName) {
            setRepoName(cleanName);
          }
        }
      });
    } else {
      setRepoName(null);
    }
  }, [pathname, isRepoDetail, repoId]);

  const baseTitle = getTitle(pathname);
  const title = isRepoDetail && repoName ? repoName : baseTitle;

  useEffect(() => {
    const stored = api.getStoredUser();
    if (stored) {
      setCurrentUser(stored);
    }
    void api
      .getMe()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const handleSignOut = () => {
    api.clearAuth();
    setCurrentUser(null);
    setDropdownOpen(false);
    router.push("/login");
  };

  return (
    <header className="flex h-16 items-center border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-black/80 backdrop-blur-md px-6 shrink-0 relative z-30 select-none transition-colors duration-200">
      {/* Page Title */}
      <div className="flex items-center gap-2 mr-auto">
        <h1 className="text-sm font-semibold tracking-tight text-[#281C59] dark:text-white">{title}</h1>
      </div>

      {/* Quick Search */}
      <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#EDE9E6]/60 dark:bg-zinc-900/60 px-3 py-1.5 text-xs text-slate-600 dark:text-zinc-400 w-56 mr-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors cursor-pointer">
        <Search className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
        <span className="text-slate-400 dark:text-zinc-500">Quick search…</span>
        <kbd className="ml-auto rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-zinc-400 shadow-2xs">
          ⌘K
        </kbd>
      </div>

      {/* Theme Toggle Button (Light vs Pure Darkness) */}
      <button
        onClick={toggleTheme}
        suppressHydrationWarning
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:bg-[#EDE9E6] dark:hover:bg-zinc-900 transition-colors mr-2 shadow-2xs"
        aria-label="Toggle theme"
        title={theme === "dark" ? "Switch to Minimal Light theme" : "Switch to Pure Darkness theme"}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 scale-100" />
        ) : (
          <Moon className="h-4 w-4 text-[#281C59] transition-transform rotate-0 scale-100" />
        )}
      </button>

      {/* Notifications */}
      <button
        suppressHydrationWarning
        className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:bg-[#EDE9E6] dark:hover:bg-zinc-900 hover:text-[#281C59] dark:hover:text-white transition-colors mr-3 shadow-2xs"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#281C59]" />
      </button>

      {/* User Profile / Auth State */}
      {currentUser ? (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            suppressHydrationWarning
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:bg-[#EDE9E6]/60 dark:hover:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-2xs"
            aria-label="Profile dropdown"
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name || "User"}
                className="h-5 w-5 rounded-full object-cover ring-1 ring-slate-200 dark:ring-zinc-700"
              />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EDE9E6] text-[#281C59] dark:bg-blue-950 dark:text-blue-300 font-semibold text-[10px]">
                {(currentUser.name || currentUser.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <span className="max-w-[120px] truncate font-medium text-slate-800 dark:text-zinc-200">
              {currentUser.name || currentUser.email}
            </span>
          </button>

          {/* Profile Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 shadow-xl shadow-slate-900/10 dark:shadow-black/60 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-zinc-800 mb-1">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {currentUser.name || "Secura Developer"}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {currentUser.email}
                </div>
                {currentUser.githubUsername && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-zinc-400">
                    <svg className="h-3 w-3 fill-current text-slate-500 dark:text-zinc-400" viewBox="0 0 24 24">
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
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      @{currentUser.githubUsername}
                    </a>
                  </div>
                )}
              </div>

              <Link
                href="/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <SettingsIcon className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                <span>Account Settings</span>
              </Link>

              <button
                onClick={handleSignOut}
                suppressHydrationWarning
                className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors mt-0.5"
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
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-[#281C59] hover:bg-[#281C59]/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all"
          >
            Get Started
          </Link>
        </div>
      )}
    </header>
  );
}
