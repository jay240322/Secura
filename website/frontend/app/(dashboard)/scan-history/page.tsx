"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { Scan } from "@/types";
import { Clock, GitCommit } from "lucide-react";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-500">—</span>;
  const color =
    score >= 80
      ? "text-emerald-400"
      : score >= 50
      ? "text-yellow-400"
      : score >= 25
      ? "text-orange-400"
      : "text-red-400";
  return <span className={color}>{score}/100</span>;
}

function ScanRow({ scan }: { scan: Scan }) {
  const repoName = scan.repository.includes("/") ? scan.repository.split("/")[1] : scan.repository;
  const repoOwner = scan.repository.includes("/") ? scan.repository.split("/")[0] : "";
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <td className="py-3.5 pr-4">
        <p className="text-sm text-slate-200">{repoName}</p>
        {repoOwner && <p className="text-xs text-slate-500 mt-0.5">{repoOwner}</p>}
      </td>
      <td className="py-3.5 pr-4">
        <span className="font-mono text-xs text-slate-400">{scan.branch}</span>
      </td>
      <td className="py-3.5 pr-4">
        <div className="flex items-center gap-1.5">
          <GitCommit className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-mono text-xs text-slate-400">
            {scan.commitSha}
          </span>
        </div>
      </td>
      <td className="py-3.5 pr-4">
        <span className="text-xs text-slate-400">
          {new Date(scan.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </td>
      <td className="py-3.5 pr-4">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="h-3 w-3" />
          {formatDuration(scan.duration)}
        </div>
      </td>
      <td className="py-3.5 pr-4">
        {scan.result && <StatusBadge status={scan.result} />}
      </td>
      <td className="py-3.5 pr-4 text-right">
        <div className="flex flex-col items-end text-xs">
          {scan.criticalFindings > 0 && (
            <span className="text-red-400">
              {scan.criticalFindings} critical
            </span>
          )}
          {scan.highFindings > 0 && (
            <span className="text-orange-400">{scan.highFindings} high</span>
          )}
          {scan.totalFindings === 0 && (
            <span className="text-emerald-400">Clean</span>
          )}
        </div>
      </td>
      <td className="py-3.5 text-right">
        <ScoreChip score={scan.score} />
      </td>
    </tr>
  );
}

export default function ScanHistoryPage() {
  const [scans, setScans] = useState<Scan[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.getScans();
        if (mounted) {
          setScans(res.scans);
        }
      } catch (e) {
        console.error("Failed to fetch scans:", e);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-screen-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-400">
          Scan executions ({scans.length})
        </h2>
      </div>

      <Card>
        <CardContent>
          {scans.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No scans recorded yet. Trigger a scan from the Repositories page to see scan history.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.08] text-xs text-slate-500">
                    <th className="pb-3 text-left font-medium">Repository</th>
                    <th className="pb-3 text-left font-medium">Branch</th>
                    <th className="pb-3 text-left font-medium">Commit</th>
                    <th className="pb-3 text-left font-medium">Date</th>
                    <th className="pb-3 text-left font-medium">Duration</th>
                    <th className="pb-3 text-left font-medium">Result</th>
                    <th className="pb-3 text-right font-medium">Findings</th>
                    <th className="pb-3 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <ScanRow key={scan.id} scan={scan} />
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
