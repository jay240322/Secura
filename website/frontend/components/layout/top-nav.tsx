"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { User as UserType } from "@/types";
import { useTheme } from "@/components/theme-provider";
import { GlobalSearchBar } from "./global-search-bar";
import { GithubIcon } from "@/components/ui/github-icon";
import { GoogleIcon } from "@/components/ui/google-icon";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/repositories": "Repositories",
  "/pull-requests": "Pull Requests",
  "/findings": "Findings",
  "/insights": "Security Insights",
  "/settings": "Settings",
  "/settings/about": "About Secura",
  "/settings/privacy": "Privacy Policy",
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
    // getMe() deduplicates and caches for 2 minutes so route switches don't spam /auth/me
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
  }, []);

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

      {/* Global Search Bar with Scope Dropdown (Repo vs PR) */}
      <GlobalSearchBar />

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
                  <GithubIcon className="h-2 w-2 fill-current" />
                </span>
              )}
              {isGoogle && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-white dark:bg-zinc-900 ring-1 ring-slate-200 dark:ring-zinc-700 flex items-center justify-center shadow-2xs">
                  <GoogleIcon className="h-2.5 w-2.5" />
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
