"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { Finding, FindingStatus, Severity } from "@/types";
import {
  ChevronRight,
  Database,
  Filter,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect, Suspense } from "react";

export const dynamic = "force-dynamic";

const SEVERITY_OPTIONS: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUS_OPTIONS: FindingStatus[] = ["open", "resolved", "ignored"];

export default function FindingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading findings...</div>}>
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
      }
    }
    void fetchFindings();
    return () => {
      mounted = false;
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
        !f.repository.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      if (severityFilter && f.severity !== severityFilter) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      if (repoFilter && f.repository !== repoFilter) return false;
      return true;
    });
  }, [findings, query, severityFilter, statusFilter, repoFilter]);

  const openCount = findings.filter((f) => f.status === "open").length;
  const criticalCount = findings.filter(
    (f) => f.status === "open" && f.severity === "CRITICAL"
  ).length;

  return (
    <div className="max-w-screen-2xl mx-auto space-y-5">
      {/* Live Neon status */}
      {isLive && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2 text-xs text-emerald-400">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 animate-pulse" />
            <span>
              <strong>Neon Database:</strong> Real-time scan findings retrieved from PostgreSQL.
            </span>
          </div>
          <button
            onClick={() => {
              void handleRefresh();
            }}
            className="flex items-center gap-1 text-[11px] hover:underline"
          >
            <RefreshCcw className="h-3 w-3" /> Refresh
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h2 className="text-sm text-slate-400">
            {openCount} open · {criticalCount} critical
          </h2>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 flex-1 min-w-48">
            <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search findings, files, repositories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none flex-1"
            />
            {query && (
              <button onClick={() => setQuery("")}>
                <X className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300" />
              </button>
            )}
          </div>

          {/* Severity */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as Severity | "")}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 outline-none"
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
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 outline-none"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          {/* Repository */}
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 outline-none"
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
        <CardHeader>
          <CardTitle>
            {filtered.length} finding{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-500">
              {findings.length === 0 ? (
                <>
                  <ShieldCheck className="h-10 w-10 mb-3 text-emerald-500" />
                  <p className="text-sm font-medium text-slate-300">No security findings</p>
                  <p className="text-xs text-slate-500 mt-1">All scanned repositories are clean and secure</p>
                </>
              ) : (
                <>
                  <Filter className="h-8 w-8 mb-3" />
                  <p className="text-sm">No findings match your filters</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
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
  return (
    <Link
      href={`/findings/${finding.id}`}
      className="group flex items-start gap-4 py-4 hover:bg-white/[0.02] -mx-2 px-2 rounded transition-colors"
    >
      <SeverityBadge severity={finding.severity} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-200">
            {finding.type}
          </span>
          <StatusBadge status={finding.status} />
        </div>
        <p className="text-xs text-slate-500 truncate">
          {finding.repository} ·{" "}
          <span className="font-mono">
            {finding.filePath}:{finding.lineNumber}
          </span>
        </p>
        {finding.recommendation && (
          <p className="text-xs text-slate-600 truncate mt-0.5">
            {finding.recommendation}
          </p>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 shrink-0">
        <span>{new Date(finding.firstDetected).toLocaleDateString()}</span>
        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}
