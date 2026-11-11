"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { FindingRow } from "@/components/findings/finding-row";
import { Loader } from "@/components/ui/loader";
import { api, cleanRepoDisplay } from "@/lib/api-client";
import type { Finding, FindingStatus, Severity } from "@/types";
import {
  ChevronRight,
  Filter,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
  Check,
  Sparkles,
  GitCommit,
  GitPullRequest,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, Suspense } from "react";

const SEVERITY_OPTIONS: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUS_OPTIONS: FindingStatus[] = ["open", "resolved", "ignored"];

export default function FindingsPage() {
  return (
    <Suspense fallback={<div className="py-24 flex justify-center"><Loader size="md" /></div>}>
      <FindingsContent />
    </Suspense>
  );
}

function FindingsContent() {
  const searchParams = useSearchParams();
  const urlRepo = searchParams.get("repo") || "";
  const urlPr = searchParams.get("pr");
  const initialPr = urlPr ? Number.parseInt(urlPr, 10) : null;
  const urlStatus = (searchParams.get("status") as FindingStatus) || "";

  const [findings, setFindings] = useState<Finding[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [statusFilter, setStatusFilter] = useState<FindingStatus | "">(urlStatus);
  const [repoFilter, setRepoFilter] = useState(urlRepo);
  const [prFilter, setPrFilter] = useState<number | null>(initialPr);
  const [loading, setLoading] = useState(true);

  // Sync state when URL search parameters change (e.g. user navigates from PR or directly to Findings)
  useEffect(() => {
    const p = searchParams.get("pr");
    setPrFilter(p ? Number.parseInt(p, 10) : null);
    setRepoFilter(searchParams.get("repo") || "");
    setStatusFilter((searchParams.get("status") as FindingStatus) || "");
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const cleanApiRepo =
      repoFilter &&
      repoFilter.toLowerCase() !== "all" &&
      repoFilter.toLowerCase() !== "repository" &&
      repoFilter.toLowerCase() !== "unknown"
        ? cleanRepoDisplay(repoFilter)
        : undefined;

    const queryParams = {
      repoName: cleanApiRepo,
      pullNumber: prFilter !== null ? prFilter : undefined,
      status: statusFilter || undefined,
    };

    // Hydrate immediately from SWR cache for instant navigation
    const cached = api.getCachedFindings(queryParams);
    if (cached && cached.isLive) {
      setFindings(cached.findings);
      setIsLive(true);
      setLoading(false);
    }

    async function fetchFindings() {
      try {
        const res = await api.getFindings(queryParams);
        if (mounted) {
          setFindings(res.findings);
          setIsLive(res.isLive);
        }
      } catch (e) {
        console.error("Failed to fetch findings:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void fetchFindings();

    // Background refresh every 25s (only while tab is visible)
    const interval = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        void fetchFindings();
      }
    }, 25000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [repoFilter, prFilter, statusFilter]);

  const handleRefresh = async () => {
    try {
      const cleanApiRepo =
        repoFilter &&
        repoFilter.toLowerCase() !== "all" &&
        repoFilter.toLowerCase() !== "repository" &&
        repoFilter.toLowerCase() !== "unknown"
          ? cleanRepoDisplay(repoFilter)
          : undefined;

      const res = await api.getFindings({
        repoName: cleanApiRepo,
        pullNumber: prFilter !== null ? prFilter : undefined,
        status: statusFilter || undefined,
      });
      setFindings(res.findings);
      setIsLive(res.isLive);
    } catch (e) {
      console.error("Failed to refresh findings:", e);
    }
  };

  const repos = useMemo(() => {
    const set = new Set<string>();
    for (const f of findings) {
      const cr = cleanRepoDisplay(f.repository);
      if (
        cr &&
        cr.toLowerCase() !== "unknown" &&
        cr.toLowerCase() !== "repository" &&
        cr.toLowerCase() !== "undefined"
      ) {
        set.add(cr);
      }
    }
    if (
      repoFilter &&
      repoFilter.toLowerCase() !== "unknown" &&
      repoFilter.toLowerCase() !== "repository" &&
      repoFilter.toLowerCase() !== "all"
    ) {
      set.add(cleanRepoDisplay(repoFilter));
    }
    return Array.from(set);
  }, [findings, repoFilter]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (prFilter !== null) {
        if (f.pullNumber !== prFilter) {
          return false;
        }
      }
      if (query) {
        const q = query.toLowerCase();
        const typeMatch = (f.type || "").toLowerCase().includes(q);
        const fileMatch = (f.filePath || "").toLowerCase().includes(q);
        const repoRaw = (f.repository || "").toLowerCase();
        const repoClean = cleanRepoDisplay(f.repository).toLowerCase();
        const repoMatch = repoRaw.includes(q) || repoClean.includes(q);
        const ruleMatch = (f.ruleId || "").toLowerCase().includes(q);
        const commitMatch = (f.detectedInCommit || "").toLowerCase().includes(q);
        const resolvedMatch = (f.resolvedInCommit || "").toLowerCase().includes(q);
        if (!typeMatch && !fileMatch && !repoMatch && !ruleMatch && !commitMatch && !resolvedMatch) {
          return false;
        }
      }
      if (severityFilter && f.severity !== severityFilter) return false;
      if (statusFilter) {
        if (statusFilter === "resolved" || statusFilter === "solved") {
          if (f.status !== "resolved" && f.status !== "solved" && !f.isResolved) return false;
        } else if (f.status !== statusFilter) {
          return false;
        }
      }
      if (
        repoFilter &&
        repoFilter.toLowerCase() !== "all" &&
        repoFilter.toLowerCase() !== "repository" &&
        repoFilter.toLowerCase() !== "unknown"
      ) {
        const targetClean = (cleanRepoDisplay(repoFilter) || repoFilter).toLowerCase().split("/").pop() || "";
        const fClean = (cleanRepoDisplay(f.repository) || f.repository || "").toLowerCase().split("/").pop() || "";
        if (targetClean && fClean && targetClean !== fClean) {
          return false;
        }
      }
      return true;
    });
  }, [findings, query, severityFilter, statusFilter, repoFilter, prFilter]);

  const openCount = findings.filter((f) => f.status === "open" && !f.isResolved).length;
  const criticalCount = findings.filter(
    (f) => f.status === "open" && !f.isResolved && f.severity === "CRITICAL"
  ).length;
  const solvedCount = findings.filter(
    (f) => f.status === "resolved" || f.status === "solved" || Boolean(f.isResolved)
  ).length;

  return (
    <div className="max-w-screen-2xl mx-auto space-y-5">
      {/* PR Filter Active Banner */}
      {prFilter !== null && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-blue-200 bg-blue-50/80 dark:border-blue-900/60 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
              <GitPullRequest className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold flex items-center gap-2 flex-wrap">
                <span>Findings for Pull Request #{prFilter}</span>
                {repoFilter && cleanRepoDisplay(repoFilter) !== "Repository" && (
                  <span className="font-mono text-[11px] text-blue-700 dark:text-blue-300 font-normal">
                    · {cleanRepoDisplay(repoFilter)}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Viewing all detected secrets and solved violations for this pull request.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPrFilter(null);
              setRepoFilter("");
              if (typeof window !== "undefined") {
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete("pr");
                newUrl.searchParams.delete("repo");
                newUrl.searchParams.delete("status");
                window.history.replaceState({}, "", newUrl.pathname);
              }
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-zinc-800 shadow-2xs transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            <span>View all findings</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-medium text-slate-500 dark:text-zinc-400">
            {loading ? "Loading findings posture..." : `${openCount} open · ${criticalCount} critical · ${solvedCount} solved`}
          </h2>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-2.5">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 flex-1 min-w-48 text-xs shadow-xs">
            <Search className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
            <input
              type="text"
              placeholder="Search findings, files, repositories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              suppressHydrationWarning
              className="bg-transparent text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none flex-1"
            />
            {query && (
              <button onClick={() => setQuery("")} suppressHydrationWarning>
                <X className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300" />
              </button>
            )}
          </div>

          {/* Severity */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as Severity | "")}
            suppressHydrationWarning
            className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-slate-800 dark:text-zinc-200 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-xs"
          >
            <option value="">All severities</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as FindingStatus | "")
            }
            suppressHydrationWarning
            className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-slate-800 dark:text-zinc-200 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-xs"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "resolved" ? "Solved" : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          {/* Repository */}
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            suppressHydrationWarning
            className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-slate-800 dark:text-zinc-200 outline-none cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-xs"
          >
            <option value="">All repositories</option>
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="border-b border-slate-100 dark:border-zinc-800/80 pb-3">
          <CardTitle className="text-slate-900 dark:text-zinc-100 font-semibold">
            {filtered.length} finding{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-zinc-400 gap-3">
              <Loader />
              <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">Loading security findings from database...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-500 dark:text-zinc-400">
              {findings.length === 0 ? (
                <>
                  <ShieldCheck className="h-10 w-10 mb-3 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                    {prFilter !== null ? `No security findings in Pull Request #${prFilter}` : "No security findings"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    {prFilter !== null
                      ? "This pull request is clean. Zero exposed secrets or policy violations detected."
                      : "All scanned repositories are clean and secure"}
                  </p>
                </>
              ) : (
                <>
                  <Filter className="h-8 w-8 mb-3 text-slate-400 dark:text-zinc-500" />
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">No findings match your filters</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {filtered.map((finding) => (
                <FindingRow key={finding.id} finding={finding} showRepo={true} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
