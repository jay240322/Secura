"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { api, DEFAULT_SUMMARY } from "@/lib/api-client";
import {
  Finding,
  Repository,
  Scan,
  DashboardSummary,
  FindingOverTime,
  FindingBySeverity,
} from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Shield,
  TrendingDown,
  TrendingUp,
  ExternalLink,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import Link from "next/link";
import Loader from "@/components/ui/loader";

// ─── Severity colours for charts ──────────────────────────────────────────
const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
};


// ─── Summary card ─────────────────────────────────────────────────────────
interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  highlight?: "critical" | "high" | "success" | "neutral";
}

function SummaryCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  highlight,
}: SummaryCardProps) {
  const highlightClass = {
    critical: "border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20",
    high: "border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/20",
    success: "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20",
    neutral: "border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950",
  }[highlight ?? "neutral"];

  return (
    <Card className={highlightClass}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-[#281C59] dark:text-zinc-100">{value}</p>
          {trend && trendLabel && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
              {trend === "up" ? (
                <TrendingUp className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              ) : trend === "down" ? (
                <TrendingDown className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              ) : null}
              {trendLabel}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-[#EDE9E6] dark:bg-zinc-900 p-2 text-[#281C59] dark:text-zinc-400 border border-[#EDE9E6] dark:border-zinc-800">
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────
function DashboardContent() {
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [installedBanner, setInstalledBanner] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary>(DEFAULT_SUMMARY);
  const [findingsOverTime, setFindingsOverTime] = useState<FindingOverTime[]>([]);
  const [findingsBySeverity, setFindingsBySeverity] = useState<FindingBySeverity[]>([]);
  const [recentFindings, setRecentFindings] = useState<Finding[]>([]);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);

  useEffect(() => {
    setIsMounted(true);
    let mounted = true;
    let inFlight = false;
    const isInstalled = searchParams.get("installed") === "true";
    const instId = searchParams.get("installation_id");
    const setupAction = searchParams.get("setup_action");

    // Hydrate immediately from SWR cache to avoid blocking spinner on navigation
    const cached = api.getCachedDashboard();
    if (cached && cached.isLive) {
      setIsLive(true);
      setSummary(cached.insights.summary);
      setFindingsOverTime(cached.insights.findingsOverTime);
      setFindingsBySeverity(cached.insights.findingsBySeverity);
      setRepos(cached.repositories);
      setRecentFindings(cached.recentFindings);
      setRecentScans(cached.recentScans);
      setLoading(false);
    }

    if (isInstalled || instId || setupAction) {
      setInstalledBanner(true);
      void api.syncRepositories().then(() => {
        if (mounted) void loadData();
      });
      void api.syncPullRequests();
    }

    async function loadData() {
      if (inFlight) return;
      inFlight = true;
      try {
        const dash = await api.getDashboardOverview();
        if (!mounted) return;
        if (dash.isLive) {
          setIsLive(true);
          setSummary(dash.insights.summary);
          setFindingsOverTime(dash.insights.findingsOverTime);
          setFindingsBySeverity(dash.insights.findingsBySeverity);
          setRepos(dash.repositories);
          setRecentFindings(dash.recentFindings);
          setRecentScans(dash.recentScans);
        }
      } catch (e) {
        console.error("Dashboard data load error:", e);
      } finally {
        inFlight = false;
        if (mounted) setLoading(false);
      }
    }
    void loadData();

    // Background refresh every 30s (only while tab is visible)
    const interval = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        void loadData();
      }
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-slate-500 dark:text-zinc-400 gap-3">
        <Loader />
        <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Loading security command center...</span>
      </div>
    );
  }

  const reposNeedingAttention = repos
    .filter((r) => r.criticalFindings > 0 || r.highFindings > 0 || r.openFindings > 0)
    .slice(0, 3);

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6">
      {/* GitHub App Connection Alert */}
      {installedBanner && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-emerald-900">GitHub App Linked!</p>
              <p className="text-emerald-700 mt-0.5">
                Successfully synced your selected repositories. Pull requests will now be automatically scanned for secret leaks.
              </p>
            </div>
          </div>
          <button
            onClick={() => setInstalledBanner(false)}
            className="text-emerald-600 hover:text-emerald-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Official GitHub App Integration Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-[#EDE9E6]/40 dark:bg-zinc-950 backdrop-blur-md p-4 sm:p-5 text-xs shadow-xs transition-all hover:border-slate-300 dark:hover:border-zinc-700">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDE9E6] dark:bg-zinc-900 border border-[#EDE9E6] dark:border-zinc-800 text-[#281C59] dark:text-zinc-200">
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#281C59] dark:text-zinc-100 tracking-tight">Secura Security Scanner</span>
              <span className="rounded-full bg-[#EDE9E6] dark:bg-zinc-900 border border-[#EDE9E6] dark:border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-[#281C59] dark:text-zinc-300">
                GitHub App
              </span>
            </div>
            <p className="text-slate-500 dark:text-zinc-400 mt-0.5">
              Automated pull request inspection for exposed credentials, API tokens, and vulnerable code.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/repositories"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-[#EDE9E6] dark:hover:bg-zinc-800 hover:text-[#281C59] dark:hover:text-zinc-100 shadow-xs transition-all"
          >
            <span>Manage Repos</span>
          </Link>
          <a
            href="https://github.com/apps/secura-security-scanner"
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#281C59] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#281C59]/90 transition-all"
          >
            <span>Configure on GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          label="Connected Repos"
          value={summary.connectedRepositories}
          icon={<GitBranch className="h-5 w-5" />}
        />
        <SummaryCard
          label="Open Findings"
          value={summary.totalOpenFindings}
          icon={<AlertTriangle className="h-5 w-5" />}
          highlight={summary.totalOpenFindings > 0 ? "critical" : "neutral"}
        />
        <SummaryCard
          label="Critical Findings"
          value={summary.criticalFindings}
          icon={<Shield className="h-5 w-5 text-red-400" />}
          highlight="critical"
        />
        <SummaryCard
          label="High Findings"
          value={summary.highFindings}
          icon={<AlertTriangle className="h-5 w-5 text-orange-400" />}
          highlight="high"
        />
        <SummaryCard
          label="Resolved"
          value={summary.resolvedFindings}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
          highlight="success"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Findings over time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Findings over time</CardTitle>
            <span className="text-xs text-slate-500">Trend & Resolution</span>
          </CardHeader>
          <CardContent>
            {!isMounted || findingsOverTime.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center text-xs text-slate-500">
                <CheckCircle2 className="h-6 w-6 text-emerald-500/80 mb-2" />
                <span>No historical findings recorded</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={findingsOverTime}>
                  <defs>
                    <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    stroke="#94a3b8"
                    fontSize={11}
                  />
                  <YAxis
                    tickLine={false}
                    stroke="#94a3b8"
                    fontSize={11}
                    width={24}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="critical"
                    stroke="#ef4444"
                    fill="url(#gc)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="high"
                    stroke="#f97316"
                    fill="url(#gh)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="resolved"
                    stroke="#10b981"
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Findings by severity */}
        <Card>
          <CardHeader>
            <CardTitle>By severity</CardTitle>
          </CardHeader>
          <CardContent>
            {!isMounted || findingsBySeverity.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center text-xs text-slate-500">
                <CheckCircle2 className="h-6 w-6 text-emerald-500/80 mb-2" />
                <span>No active findings by severity</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={findingsBySeverity}
                    dataKey="count"
                    nameKey="severity"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={40}
                  >
                    {findingsBySeverity.map((entry) => (
                      <Cell
                        key={entry.severity}
                        fill={SEV_COLORS[entry.severity] || "#94a3b8"}
                        opacity={0.85}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    formatter={(v) => (
                      <span className="text-xs text-slate-600 font-medium">{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent findings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent open findings</CardTitle>
            <Link
              href="/findings"
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {recentFindings.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-500" />
                <p className="text-sm">No open findings detected</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {recentFindings.map((f) => (
                  <Link
                    key={f.id}
                    href={`/findings/${f.id}`}
                    className="flex items-start gap-3 py-3 hover:bg-slate-50/80 dark:hover:bg-zinc-900/50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <SeverityBadge severity={f.severity} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">{f.type}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {f.repository} · {f.filePath}:{f.lineNumber}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Repos needing attention */}
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <Link
              href="/repositories"
              className="text-xs font-medium text-blue-600 hover:text-blue-500"
            >
              All repos →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {repos.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 dark:text-zinc-400 space-y-1">
                  <p className="font-medium text-slate-700 dark:text-zinc-300">No repositories added yet</p>
                  <Link href="/repositories" className="text-blue-600 dark:text-blue-400 font-medium hover:underline inline-block">
                    + Add Repository to start monitoring
                  </Link>
                </div>
              ) : reposNeedingAttention.length === 0 ? (
                <div className="text-center py-6 text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                  <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-500" />
                  <p className="font-semibold text-sm text-slate-900 dark:text-zinc-100">All repositories are clean ✅</p>
                  <p className="text-slate-500 dark:text-zinc-400">
                    Zero open vulnerabilities detected across {repos.length} {repos.length === 1 ? "monitored repository" : "monitored repositories"}
                  </p>
                </div>
              ) : (
                reposNeedingAttention.map((r) => (
                  <Link
                    key={r.id}
                    href={`/repositories/${r.id}`}
                    className="block rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 p-3 hover:bg-slate-50 dark:hover:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                        {r.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.lastScanStatus} />
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs">
                      {r.criticalFindings > 0 && (
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          {r.criticalFindings} critical
                        </span>
                      )}
                      {r.highFindings > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {r.highFindings} high
                        </span>
                      )}
                      {r.openFindings > 0 && (
                        <span className="text-slate-500 dark:text-zinc-400">
                          {r.openFindings} total open
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Recent PR Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Pull Request Checks</CardTitle>
          <Link
            href="/pull-requests"
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            All Pull Requests →
          </Link>
        </CardHeader>
        <CardContent>
          {recentScans.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No pull requests checked yet. Open or update a Pull Request on GitHub to trigger Secura.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="pb-3 text-left">Repository</th>
                    <th className="pb-3 text-left">Branch</th>
                    <th className="pb-3 text-left">Commit</th>
                    <th className="pb-3 text-left">PR Gate Status</th>
                    <th className="pb-3 text-right">Findings</th>
                    <th className="pb-3 text-right">Security Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {recentScans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="py-3 text-slate-900 dark:text-zinc-100 font-medium">
                        {scan.repository.includes("/") ? scan.repository.split("/")[1] : scan.repository}
                      </td>
                      <td className="py-3">
                        <span className="font-mono text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200/80 dark:border-zinc-700">
                          {scan.branch}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="font-mono text-slate-500 dark:text-zinc-400">
                          {scan.commitSha}
                        </span>
                      </td>
                      <td className="py-3">
                        {scan.result && <StatusBadge status={scan.result} />}
                      </td>
                      <td className="py-3 text-right text-slate-700 dark:text-zinc-300 font-medium">{scan.totalFindings}</td>
                      <td className="py-3 text-right">
                        <span
                          className={`font-semibold font-mono ${
                            (scan.score ?? 0) >= 80
                              ? "text-emerald-600 dark:text-emerald-400"
                              : (scan.score ?? 0) >= 50
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {scan.score}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader />
          <span className="text-xs">Loading command center...</span>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
