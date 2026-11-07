"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Loader } from "@/components/ui/loader";
import { api } from "@/lib/api-client";
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
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect, Suspense } from "react";

export const dynamic = "force-dynamic";

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
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [statusFilter, setStatusFilter] = useState<FindingStatus | "">("");
  const [repoFilter, setRepoFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchFindings() {
      try {
        const res = await api.getFindings();
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

    // Live polling every 6 seconds for new findings detected on pull requests
    const interval = setInterval(() => {
      void fetchFindings();
    }, 6000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRefresh = async () => {
    try {
      const res = await api.getFindings();
      setFindings(res.findings);
      setIsLive(res.isLive);
    } catch (e) {
      console.error("Failed to refresh findings:", e);
    }
  };

  const repos = useMemo(
    () => [...new Set(findings.map((f) => f.repository))],
    [findings]
  );

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (
        query &&
        !f.type.toLowerCase().includes(query.toLowerCase()) &&
        !f.filePath.toLowerCase().includes(query.toLowerCase()) &&
        !f.repository.toLowerCase().includes(query.toLowerCase()) &&
        !(f.ruleId && f.ruleId.toLowerCase().includes(query.toLowerCase())) &&
        !(f.detectedInCommit && f.detectedInCommit.toLowerCase().includes(query.toLowerCase())) &&
        !(f.resolvedInCommit && f.resolvedInCommit.toLowerCase().includes(query.toLowerCase()))
      )
        return false;
      if (severityFilter && f.severity !== severityFilter) return false;
      if (statusFilter) {
        if (statusFilter === "resolved" || statusFilter === "solved") {
          if (f.status !== "resolved" && f.status !== "solved" && !f.isResolved) return false;
        } else if (f.status !== statusFilter) {
          return false;
        }
      }
      if (repoFilter && f.repository !== repoFilter) return false;
      return true;
    });
  }, [findings, query, severityFilter, statusFilter, repoFilter]);

  const openCount = findings.filter((f) => f.status === "open" && !f.isResolved).length;
  const criticalCount = findings.filter(
    (f) => f.status === "open" && !f.isResolved && f.severity === "CRITICAL"
  ).length;
  const solvedCount = findings.filter(
    (f) => f.status === "resolved" || f.status === "solved" || Boolean(f.isResolved)
  ).length;

  return (
    <div className="max-w-screen-2xl mx-auto space-y-5">
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
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">No security findings</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">All scanned repositories are clean and secure</p>
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
                <FindingRow key={finding.id} finding={finding} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const isResolved = finding.status === "resolved" || finding.status === "solved" || Boolean(finding.isResolved);
  const detectedSha = finding.detectedInCommit || (finding.commitSha ? finding.commitSha.slice(0, 7) : null);
  const resolvedSha = finding.resolvedInCommit;

  return (
    <Link
      href={`/findings/${finding.id}`}
      className="group flex items-start gap-4 py-3.5 hover:bg-slate-50/70 dark:hover:bg-zinc-900/60 -mx-2 px-3 rounded-xl transition-colors"
    >
      <SeverityBadge severity={finding.severity} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 tracking-tight group-hover:text-[#281C59] dark:group-hover:text-blue-400 transition-colors">
            {finding.type}
          </span>
          <StatusBadge status={isResolved ? "resolved" : finding.status} />
          <span className="text-[10px] text-slate-600 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
            {finding.ruleId}
          </span>
          {isResolved ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" />
              <span>Solved in commit {resolvedSha || "latest commit"}</span>
            </span>
          ) : detectedSha ? (
            <span className="text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/40">
              Commit {detectedSha}
            </span>
          ) : null}
          {finding.pullNumber && (
            <span className="text-[10px] font-mono font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900/40">
              PR #{finding.pullNumber}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
          {finding.repository} ·{" "}
          <span className="font-mono text-slate-700 dark:text-zinc-300">
            {finding.filePath}:{finding.lineNumber}
          </span>
        </p>
        {isResolved ? (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-mono mt-1">
            <Check className="h-3 w-3 shrink-0" />
            <span>
              Detected in commit <code className="font-bold text-rose-600 dark:text-rose-400">{detectedSha || "prior commit"}</code> → Solved in commit <code className="font-bold text-emerald-600 dark:text-emerald-400">{resolvedSha || "latest commit"}</code>
            </span>
          </p>
        ) : finding.recommendation ? (
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
            {finding.recommendation}
          </p>
        ) : null}
      </div>
      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500 shrink-0">
        <span>{new Date(finding.firstDetected).toLocaleDateString()}</span>
        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 dark:text-zinc-400" />
      </div>
    </Link>
  );
}
