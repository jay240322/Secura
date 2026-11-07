"use client";

import { useEffect, useState } from "react";
import { Search, Sun, Moon } from "lucide-react";
import { usePathname } from "next/navigation";
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

function GithubMiniIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function GoogleMiniIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const isRepoDetail = pathname.startsWith("/repositories/") && pathname !== "/repositories";
  const repoId = isRepoDetail ? pathname.split("/repositories/")[1]?.split("/")[0]?.split("?")[0] : null;

  const [repoName, setRepoName] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  useEffect(() => {
    if (isRepoDetail && repoId) {
      const decoded = decodeURIComponent(repoId);
      const cached = api.getCachedRepository?.(decoded);
      let initialGuess = cached?.name || (cached?.fullName ? cached.fullName.split("/").pop() : null);

      if (!initialGuess) {
        const isIdLike =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded) ||
          decoded.startsWith("repo-") ||
          decoded.length >= 32;

        if (isIdLike) {
          if (decoded.startsWith("repo-")) {
            const parts = decoded.split("-");
            initialGuess = parts.length > 2 ? parts.slice(2).join("-") : "Repository";
          } else {
            initialGuess = "Repository";
          }
        } else {
          initialGuess = decoded;
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

  // Helper to extract authentic display name (only username, never email or noreply addresses)
  function getCleanDisplayName(user: UserType | null): string {
    if (!user) return "Developer";

    // 1. Google sign-in: prioritize authentic Google Profile name
    if (user.provider === "google") {
      if (user.name && !user.name.includes("@")) return user.name;
      if (user.email) return user.email.split("@")[0];
      return "Google User";
    }

    // 2. GitHub sign-in: prioritize clean GitHub username / handle
    if (user.githubUsername) {
      return user.githubUsername.replace(/^@/, "").split("@")[0].trim();
    }
    if (user.name) {
      const clean = user.name.replace(/^@/, "").split("@")[0].trim();
      if (clean && clean.toLowerCase() !== "users") return clean;
    }
    if (user.email) {
      return user.email.split("@")[0].replace(/^@/, "").trim();
    }
    return "Developer";
  }

  const isGitHub =
    currentUser?.provider === "github" ||
    Boolean(currentUser?.githubUsername) ||
    Boolean(currentUser?.email?.includes("github"));

  const isGoogle =
    currentUser?.provider === "google" ||
    Boolean(currentUser?.email?.includes("gmail"));

  const ghHandle =
    currentUser?.githubUsername
      ? currentUser.githubUsername.replace(/^@/, "").split("@")[0].trim()
      : (currentUser?.email?.includes("@users.noreply.github.com")
          ? currentUser.email.split("@")[0].replace(/^@/, "").trim()
          : undefined);

  const displayName = getCleanDisplayName(currentUser);
  const initialChar = (displayName || "U").charAt(0).toUpperCase();

  // Resolve user avatar URL with GitHub/Google fallbacks
  const avatarUrl =
    currentUser?.avatarUrl ||
    (ghHandle
      ? `https://github.com/${ghHandle}.png`
      : undefined);

  return (
    <header className="flex h-16 items-center border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-md px-6 shrink-0 relative z-30 select-none transition-colors duration-200">
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
        onClick={(e) => toggleTheme(e)}
        suppressHydrationWarning
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:bg-[#EDE9E6] dark:hover:bg-zinc-900 transition-colors mr-3 shadow-2xs cursor-pointer"
        aria-label="Toggle theme"
        title="Toggle theme (Minimal Light / Pure Darkness)"
      >
        <Sun className="hidden dark:block h-4 w-4 text-amber-400 transition-transform rotate-0 scale-100" />
        <Moon className="block dark:hidden h-4 w-4 text-[#281C59] transition-transform rotate-0 scale-100" />
      </button>

      {/* User Profile / Auth State */}
      {currentUser ? (
        <div suppressHydrationWarning className="relative">
          {/* Highlighted Profile Button: Direct Navigation to Settings */}
          <Link
            href="/settings"
            suppressHydrationWarning
            className="flex items-center gap-2.5 rounded-xl border border-[#281C59]/20 dark:border-zinc-800 bg-[#EDE9E6] dark:bg-zinc-900/90 pl-1.5 pr-3 py-1 text-xs text-slate-800 dark:text-zinc-200 hover:bg-[#EDE9E6]/80 dark:hover:bg-zinc-850 hover:border-[#281C59]/40 transition-all shadow-xs cursor-pointer group"
            aria-label="Account Settings"
            title="Click to open Account Settings"
          >
            {/* Avatar Photo with Provider Badge Overlay */}
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-7 w-7 rounded-full object-cover ring-2 ring-[#281C59]/25 dark:ring-zinc-700 shadow-2xs group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#281C59] text-white dark:bg-zinc-800 dark:text-zinc-200 font-bold text-xs ring-2 ring-[#281C59]/25 shadow-2xs">
                  {initialChar}
                </div>
              )}
              {isGitHub && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-slate-900 text-white dark:bg-black ring-1 ring-white dark:ring-zinc-800 flex items-center justify-center">
                  <GithubMiniIcon className="h-2 w-2 fill-current" />
                </span>
              )}
              {isGoogle && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-white dark:bg-zinc-900 ring-1 ring-slate-200 dark:ring-zinc-700 flex items-center justify-center shadow-2xs">
                  <GoogleMiniIcon className="h-2.5 w-2.5" />
                </span>
              )}
            </div>

            {/* Highlighted User Name */}
            <div className="flex items-center gap-1.5">
              <span className="max-w-[130px] truncate font-bold text-xs text-[#281C59] dark:text-white tracking-tight">
                {displayName}
              </span>
            </div>
          </Link>
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
