"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  GitBranch,
  AlertTriangle,
  GitPullRequest,
  History,
  BarChart3,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen border-r border-white/[0.06] bg-[#0d1117] transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-white/[0.06] shrink-0",
          collapsed ? "justify-center" : "gap-2.5"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600/90 shadow-lg shadow-blue-500/20">
          <Shield className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold tracking-wide text-slate-100">
            Secura
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center" : "gap-2.5",
                isActive
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                )}
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* GitHub App Link */}
      <div className="px-2 pb-2">
        <a
          href="https://github.com/apps/secura-security-scanner"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "group flex items-center rounded-lg border border-blue-500/25 bg-blue-500/10 px-2.5 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 hover:text-blue-300 transition-all",
            collapsed ? "justify-center" : "gap-2"
          )}
          title="Install Secura GitHub App"
        >
          <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
          {!collapsed && (
            <div className="flex flex-1 items-center justify-between overflow-hidden">
              <span className="truncate">Install GitHub App</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-70 group-hover:opacity-100" />
            </div>
          )}
        </a>
      </div>

      {/* Collapse toggle */}
      <div className="px-2 pb-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-slate-500",
            "hover:bg-white/[0.04] hover:text-slate-300 transition-colors",
            collapsed ? "justify-center" : "gap-2.5"
          )}
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

