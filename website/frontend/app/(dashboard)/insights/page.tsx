"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { FindingByRepository, FindingBySeverity, FindingOverTime } from "@/types";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { CheckCircle2, ShieldCheck } from "lucide-react";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
};

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
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95">
      <p className="mb-1.5 font-semibold text-slate-800 dark:text-zinc-100">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500 dark:text-zinc-400 capitalize">{p.name}:</span>
          <span className="text-slate-900 dark:text-zinc-100 font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const [securityScore, setSecurityScore] = useState(100);
  const [findingsOverTime, setFindingsOverTime] = useState<FindingOverTime[]>([]);
  const [findingsBySeverity, setFindingsBySeverity] = useState<FindingBySeverity[]>([]);
  const [findingsByRepository, setFindingsByRepository] = useState<FindingByRepository[]>([]);
  const [topFindingTypes, setTopFindingTypes] = useState<{ type: string; count: number }[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.getInsights();
        if (mounted) {
          setSecurityScore(res.securityScore);
          setFindingsOverTime(res.findingsOverTime);
          setFindingsBySeverity(res.findingsBySeverity);
          setFindingsByRepository(res.findingsByRepo);
          setTopFindingTypes(res.topFindingTypes);
        }
      } catch (e) {
        console.error("Failed to load insights:", e);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-screen-xl mx-auto space-y-5">
      {/* Score + top metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Security posture score</CardTitle>
            <span className="text-xs text-slate-500 dark:text-zinc-400">Real-time calculated score</span>
          </CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${securityScore >= 80 ? "text-emerald-600 dark:text-emerald-400" : securityScore >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
              {securityScore}
              <span className="text-lg text-slate-500 dark:text-zinc-400">/100</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Score = 100 − (30×critical + 20×high + 10×medium + 5×low).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Open Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100">
              {findingsBySeverity.reduce((acc, curr) => acc + curr.count, 0)}
              <span className="text-lg text-slate-500 dark:text-zinc-400"> total</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Across all monitored repositories
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top finding type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
              {topFindingTypes[0]?.type ?? "None"}
            </p>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              {topFindingTypes[0]?.count ?? 0} occurrences
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Findings by severity + findings over time */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Findings by severity</CardTitle>
          </CardHeader>
          <CardContent>
            {findingsBySeverity.length === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center text-xs text-slate-500 dark:text-zinc-400">
                <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mb-2" />
                <span>No active findings across repositories</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={findingsBySeverity}
                    dataKey="count"
                    nameKey="severity"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                  >
                    {findingsBySeverity.map((entry) => (
                      <Cell key={entry.severity} fill={SEV_COLORS[entry.severity] || "#94a3b8"} opacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={(v) => <span className="text-xs text-slate-600 dark:text-zinc-300 font-medium">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Findings by repo */}
        <Card>
          <CardHeader>
            <CardTitle>Findings by repository</CardTitle>
          </CardHeader>
          <CardContent>
            {findingsByRepository.length === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center text-xs text-slate-500 dark:text-zinc-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mb-2" />
                <span>All connected repositories are clean</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={findingsByRepository} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="repository" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="critical" stackId="a" fill="#ef4444" opacity={0.85} />
                  <Bar dataKey="high" stackId="a" fill="#f97316" opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Findings over time */}
      <Card>
        <CardHeader>
          <CardTitle>Findings over time</CardTitle>
          <span className="text-xs text-slate-500 dark:text-zinc-400">Trend & Resolution History</span>
        </CardHeader>
        <CardContent>
          {findingsOverTime.length === 0 ? (
            <div className="flex h-[200px] flex-col items-center justify-center text-xs text-slate-500 dark:text-zinc-400">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 mb-2" />
              <span>No historical finding trend available yet</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={findingsOverTime}>
                <defs>
                  {["critical", "high", "medium"].map((k) => (
                    <linearGradient key={k} id={`g${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={k === "critical" ? "#ef4444" : k === "high" ? "#f97316" : "#eab308"}
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor={k === "critical" ? "#ef4444" : k === "high" ? "#f97316" : "#eab308"}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="critical" stroke="#ef4444" fill="url(#gcritical)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="high" stroke="#f97316" fill="url(#ghigh)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="medium" stroke="#eab308" fill="url(#gmedium)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top finding types */}
      {topFindingTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most common finding types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topFindingTypes.map((item) => {
                const max = topFindingTypes[0]?.count ?? 1;
                const pct = Math.round((item.count / max) * 100);
                return (
                  <div key={item.type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-800 dark:text-zinc-200 font-medium">{item.type}</span>
                      <span className="text-slate-500 dark:text-zinc-400">{item.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
