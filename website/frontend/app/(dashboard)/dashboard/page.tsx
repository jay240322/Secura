"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
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
  Database,
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
    critical: "border-red-500/20",
    high: "border-orange-500/20",
    success: "border-emerald-500/20",
    neutral: "border-white/[0.06]",
  }[highlight ?? "neutral"];

  return (
    <Card className={highlightClass}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-semibold text-slate-100">{value}</p>
          {trend && trendLabel && (
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              {trend === "up" ? (
                <TrendingUp className="h-3 w-3 text-red-400" />
              ) : trend === "down" ? (
                <TrendingDown className="h-3 w-3 text-emerald-400" />
              ) : null}
              {trendLabel}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-white/[0.04] p-2 text-slate-400">
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Circular Score Ring ──────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "#10b981" : score >= 50 ? "#eab308" : "#ef4444";

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width={100} height={100} className="rotate-[-90deg]">
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={8}
        />
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-slate-100">{score}</span>
        <span className="text-[10px] text-slate-500">/100</span>
      </div>
    </div>
  );
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0d1117] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-medium text-slate-300">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-slate-400 capitalize">{p.name}:</span>
          <span className="text-slate-200">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────
function DashboardContent() {
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [installedBanner, setInstalledBanner] = useState(false);
  const [isLive, setIsLive] = useState(false);
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
        const [insightsRes, reposRes, findingsRes, scansRes] = await Promise.allSettled([
          api.getInsights(),
          api.getRepositories(),
          api.getFindings({ status: "open" }),
          api.getScans(),
        ]);

        if (!mounted) return;

        if (insightsRes.status === "fulfilled") {
          setIsLive(insightsRes.value.isLive);
          setSummary(insightsRes.value.summary);
          setFindingsOverTime(insightsRes.value.findingsOverTime);
          setFindingsBySeverity(insightsRes.value.findingsBySeverity);
        }

        if (reposRes.status === "fulfilled") {
          setRepos(reposRes.value.repositories);
        }

        if (findingsRes.status === "fulfilled") {
          setRecentFindings(findingsRes.value.findings.slice(0, 5));
        }

        if (scansRes.status === "fulfilled") {
          setRecentScans(scansRes.value.scans.slice(0, 4));
        }
      } catch (e) {
        console.error("Dashboard data load error:", e);
      } finally {
        inFlight = false;
      }
    }
    void loadData();

    // Auto-poll every 10 seconds to keep live metrics and recent PR scans updated smoothly
    const interval = setInterval(() => {
      void loadData();
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const reposNeedingAttention = repos
    .filter((r) => r.criticalFindings > 0 || r.highFindings > 0)
    .slice(0, 3);

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6">
      {/* GitHub App Connection Alert */}
      {installedBanner && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 shadow-xl shadow-emerald-950/20 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-emerald-200">GitHub App Linked!</p>
              <p className="text-slate-300 mt-0.5">
                Successfully synced your selected repositories. Pull requests will now be automatically scanned for secret leaks.
              </p>
            </div>
          </div>
          <button
            onClick={() => setInstalledBanner(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Official GitHub App Integration Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-blue-500/25 bg-gradient-to-r from-blue-900/20 via-blue-950/25 to-[#0d1117] p-4 text-xs shadow-lg shadow-blue-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400">
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
              <span className="font-semibold text-slate-100">Secura Security Scanner GitHub App</span>
              <span className="rounded-full bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[9px] font-semibold text-blue-300">
                OFFICIAL APP
              </span>
            </div>
            <p className="text-slate-400 mt-0.5">
              Protect pull requests from leaking credentials, API keys, and vulnerable dependencies automatically.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/repositories"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3.5 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-all"
          >
            <span>Manage Repositories</span>
          </Link>
          <a
            href="https://github.com/apps/secura-security-scanner"
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all"
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
                    stroke="#475569"
                    fontSize={11}
                  />
                  <YAxis
                    tickLine={false}
                    stroke="#475569"
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
                      <span className="text-xs text-slate-400">{v}</span>
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
              className="text-xs text-blue-400 hover:text-blue-300"
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
              <div className="divide-y divide-white/[0.04]">
                {recentFindings.map((f) => (
                  <Link
                    key={f.id}
                    href={`/findings/${f.id}`}
                    className="flex items-start gap-3 py-3 hover:bg-white/[0.02] -mx-2 px-2 rounded transition-colors"
                  >
                    <SeverityBadge severity={f.severity} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200 truncate">{f.type}</p>
                      <p className="text-xs text-slate-500 truncate">
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
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              All repos →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reposNeedingAttention.map((r) => (
                <Link
                  key={r.id}
                  href={`/repositories/${r.id}`}
                  className="block rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 hover:border-white/[0.1] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {r.name}
                    </span>
                    <StatusBadge status={r.lastScanStatus} />
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400">
                      {r.criticalFindings} critical
                    </span>
                    <span className="text-orange-400">
                      {r.highFindings} high
                    </span>
                  </div>
                </Link>
              ))}
              {reposNeedingAttention.length === 0 && (
                <p className="text-center text-sm text-slate-500 py-4">
                  All repositories are clean ✅
                </p>
              )}
            </div>

            {/* Security score */}
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="text-xs text-slate-500 mb-3">Security score</p>
              <div className="relative flex justify-center">
                <ScoreRing score={summary.securityScore} />
              </div>
              <p className="mt-1 text-center text-xs text-slate-500">
                Score is based on open findings severity
              </p>
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
            className="text-xs text-blue-400 hover:text-blue-300"
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-slate-500">
                    <th className="pb-3 text-left font-medium">Repository</th>
                    <th className="pb-3 text-left font-medium">Branch</th>
                    <th className="pb-3 text-left font-medium">Commit</th>
                    <th className="pb-3 text-left font-medium">PR Gate Status</th>
                    <th className="pb-3 text-right font-medium">Findings</th>
                    <th className="pb-3 text-right font-medium">Security Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {recentScans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 text-slate-300">
                        {scan.repository.includes("/") ? scan.repository.split("/")[1] : scan.repository}
                      </td>
                      <td className="py-3 text-slate-400 font-mono text-xs">{scan.branch}</td>
                      <td className="py-3 text-slate-400 font-mono text-xs">{scan.commitSha}</td>
                      <td className="py-3">
                        {scan.result && <StatusBadge status={scan.result} />}
                      </td>
                      <td className="py-3 text-right text-slate-300">{scan.totalFindings}</td>
                      <td className="py-3 text-right">
                        <span
                          className={
                            (scan.score ?? 0) >= 80
                              ? "text-emerald-400"
                              : (scan.score ?? 0) >= 50
                              ? "text-yellow-400"
                              : "text-red-400"
                          }
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
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <Shield className="h-6 w-6 text-blue-400 animate-pulse" />
          <span className="text-xs">Loading command center...</span>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
