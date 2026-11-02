"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_INSIGHTS } from "@/lib/mock-data";
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
    <div className="rounded-lg border border-white/[0.08] bg-[#0d1117] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-medium text-slate-300">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400 capitalize">{p.name}:</span>
          <span className="text-slate-200">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const insights = MOCK_INSIGHTS;

  return (
    <div className="max-w-screen-xl mx-auto space-y-5">
      <p className="text-xs text-yellow-400">
        📊 Showing mock insights data. Connect repositories to see real analytics.
      </p>

      {/* Score + top metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Security score</CardTitle>
            <span className="text-xs text-slate-500">Calculated score</span>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-red-400">
              {insights.securityScore}
              <span className="text-lg text-slate-500">/100</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Score = 100 − (30×critical + 20×high + 10×medium + 5×low).
              This is a Secura internal metric, not an industry standard.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg. resolution time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-100">
              {insights.averageResolutionDays}
              <span className="text-lg text-slate-500"> days</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Average time from detection to resolution
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top finding type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-slate-100">
              {insights.topFindingTypes[0]?.type ?? "—"}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {insights.topFindingTypes[0]?.count ?? 0} occurrences
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Score history + findings by severity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Score history</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={insights.scoreHistory}>
                <defs>
                  <linearGradient id="gscore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" fill="url(#gscore)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Findings by severity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={insights.findingsBySeverity}
                  dataKey="count"
                  nameKey="severity"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={50}
                >
                  {insights.findingsBySeverity.map((entry) => (
                    <Cell key={entry.severity} fill={SEV_COLORS[entry.severity]} opacity={0.85} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(v) => <span className="text-xs text-slate-400">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Findings over time */}
      <Card>
        <CardHeader>
          <CardTitle>Findings over time</CardTitle>
          <span className="text-xs text-slate-500">Last 14 days</span>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={insights.findingsOverTime}>
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
        </CardContent>
      </Card>

      {/* Findings by repo */}
      <Card>
        <CardHeader>
          <CardTitle>Findings by repository</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={insights.findingsByRepository} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="repository" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="critical" stackId="a" fill="#ef4444" opacity={0.85} />
              <Bar dataKey="high" stackId="a" fill="#f97316" opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top finding types */}
      <Card>
        <CardHeader>
          <CardTitle>Most common finding types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.topFindingTypes.map((item, i) => {
              const max = insights.topFindingTypes[0]?.count ?? 1;
              const pct = Math.round((item.count / max) * 100);
              return (
                <div key={item.type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{item.type}</span>
                    <span className="text-slate-500">{item.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-blue-500/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

