"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { PullRequest } from "@/types";
import {
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  Loader2,
  XCircle,
} from "lucide-react";

function CheckIcon({
  status,
}: {
  status: PullRequest["checkRunStatus"];
}) {
  if (status === "success")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "failure")
    return <XCircle className="h-4 w-4 text-red-400" />;
  if (status === "in_progress")
    return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
  return <div className="h-4 w-4 rounded-full border-2 border-slate-600" />;
}

function PRRow({ pr }: { pr: PullRequest }) {
  const repoName = pr.repository.includes("/") ? pr.repository.split("/")[1] : pr.repository;
  return (
    <div className="flex items-start gap-4 border-b border-white/[0.04] py-4 last:border-0">
      <div className="mt-0.5">
        <CheckIcon status={pr.checkRunStatus} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-200 hover:text-blue-400 transition-colors flex items-center gap-1.5"
          >
            {pr.title}
            <ExternalLink className="h-3.5 w-3.5 opacity-50" />
          </a>
          <StatusBadge status={pr.checkRunStatus} />
        </div>
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-400">{repoName}</span>
          {" · "}#{pr.number} · {pr.branch} → {pr.baseBranch} · by{" "}
          <span className="text-slate-300">@{pr.author}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        {pr.criticalFindings > 0 && (
          <p className="text-xs text-red-400">{pr.criticalFindings} critical</p>
        )}
        {pr.highFindings > 0 && (
          <p className="text-xs text-orange-400">{pr.highFindings} high</p>
        )}
        {pr.totalFindings === 0 && pr.checkRunStatus === "success" && (
          <p className="text-xs text-emerald-400">Clean</p>
        )}
        {pr.checkRunStatus === "in_progress" && (
          <p className="text-xs text-slate-500">Scanning…</p>
        )}
      </div>
    </div>
  );
}

export default function PullRequestsPage() {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.getPullRequests();
        if (mounted) {
          setPullRequests(res.pullRequests);
        }
      } catch (e) {
        console.error("Failed to fetch pull requests:", e);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const failed = pullRequests.filter((p) => p.checkRunStatus === "failure");
  const passed = pullRequests.filter((p) => p.checkRunStatus === "success");
  const running = pullRequests.filter((p) => p.checkRunStatus === "in_progress");

  return (
    <div className="max-w-screen-xl mx-auto space-y-5">
      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-400" />
            <div>
              <p className="text-xl font-semibold text-slate-100">
                {failed.length}
              </p>
              <p className="text-xs text-slate-500">Failing gate</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 text-blue-400" />
            <div>
              <p className="text-xl font-semibold text-slate-100">
                {running.length}
              </p>
              <p className="text-xs text-slate-500">Scanning now</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            <div>
              <p className="text-xl font-semibold text-slate-100">
                {passed.length}
              </p>
              <p className="text-xs text-slate-500">Passed gate</p>
            </div>
          </div>
        </Card>
      </div>

      {/* All PRs */}
      <Card>
        <CardHeader>
          <CardTitle>
            <GitPullRequest className="inline h-4 w-4 mr-1.5 text-slate-500" />
            Pull Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pullRequests.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-500">
              <GitPullRequest className="h-8 w-8 mb-2" />
              <p className="text-sm">No pull requests scanned yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Install the Secura GitHub App to automatically scan PRs upon push.
              </p>
            </div>
          ) : (
            <div>
              {pullRequests.map((pr) => (
                <PRRow key={pr.id} pr={pr} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
