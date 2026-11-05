"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  GitBranch,
  AlertTriangle,
  GitPullRequest,
  BarChart3,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories", icon: GitBranch },
  { href: "/pull-requests", label: "Pull Requests", icon: GitPullRequest },
  { href: "/findings", label: "Findings", icon: AlertTriangle },
  { href: "/insights", label: "Security Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const isRepoDetail = pathname.startsWith("/repositories/") && pathname !== "/repositories";
  const [collapsed, setCollapsed] = useState(isRepoDetail);

  useEffect(() => {
    const isDetail = pathname.startsWith("/repositories/") && pathname !== "/repositories";
    setCollapsed(isDetail);
  }, [pathname]);

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen border-r border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 backdrop-blur-md transition-all duration-300 shrink-0 z-20 select-none",
        collapsed ? "w-16 min-w-[4rem]" : "w-60 min-w-[15rem]"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-slate-200/80 dark:border-zinc-800/80 shrink-0",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <img
            src="/logo.png"
            alt="Secura"
            className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
          />
          {!collapsed && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-[#281C59] dark:text-white">
                Secura
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-zinc-400 border border-[#EDE9E6] dark:border-zinc-800 font-semibold">
                v1.0
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        {!collapsed && (
          <div className="px-2 pb-2 text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-zinc-500">
            Platform
          </div>
        )}
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-150",
                collapsed ? "justify-center" : "gap-3",
                isActive
                  ? "bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-zinc-100 font-semibold shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-[#EDE9E6]/60 dark:hover:bg-zinc-900/80 hover:text-[#281C59] dark:hover:text-zinc-100"
              )}
              title={collapsed ? label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#281C59] dark:bg-zinc-300" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-[#281C59] dark:text-zinc-100" : "text-slate-400 dark:text-zinc-500 group-hover:text-[#281C59] dark:group-hover:text-zinc-300"
                )}
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* GitHub App Quick Access */}
      <div className="px-2.5 pb-2">
        <a
          href="https://github.com/apps/secura-security-scanner"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "group flex items-center rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all",
            collapsed ? "justify-center" : "gap-2.5"
          )}
          title="Install Secura GitHub App"
        >
          <svg className="h-4 w-4 shrink-0 fill-current text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white" viewBox="0 0 24 24">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
          {!collapsed && (
            <div className="flex flex-1 items-center justify-between overflow-hidden">
              <span className="truncate">GitHub App</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
            </div>
          )}
        </a>
      </div>

      {/* Collapse Toggle */}
      <div className="px-2.5 pb-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          suppressHydrationWarning
          className={cn(
            "flex w-full items-center rounded-xl px-2.5 py-1.5 text-xs text-slate-500 dark:text-zinc-500",
            "hover:bg-slate-100/70 dark:hover:bg-zinc-900 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors",
            collapsed ? "justify-center" : "gap-2.5"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
