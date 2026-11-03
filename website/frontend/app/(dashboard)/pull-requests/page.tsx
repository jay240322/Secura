"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { PullRequest, Repository } from "@/types";
import {
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Play,
  X,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

function CheckIcon({
  status,
}: {
  status: PullRequest["checkRunStatus"];
}) {
  if (status === "success")
    return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
  if (status === "failure")
    return <XCircle className="h-5 w-5 text-red-400 shrink-0" />;
  if (status === "in_progress")
    return <Loader2 className="h-5 w-5 text-blue-400 animate-spin shrink-0" />;
  return <div className="h-5 w-5 rounded-full border-2 border-slate-600 shrink-0" />;
}

function PRRow({
  pr,
}: {
  pr: PullRequest;
}) {
  const repoName = pr.repository.includes("/") ? pr.repository.split("/")[1] : pr.repository;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.04] py-4 last:border-0 hover:bg-white/[0.01] px-2 rounded-lg transition-colors">
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <div className="mt-1">
          <CheckIcon status={pr.checkRunStatus} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <a
              href={pr.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-slate-100 hover:text-blue-400 transition-colors flex items-center gap-1.5"
            >
              <span>{pr.title}</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-50 shrink-0" />
            </a>
            <StatusBadge status={pr.checkRunStatus} />
          </div>
          <p className="text-xs text-slate-400 font-mono flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-300">{pr.repository}</span>
            <span>·</span>
            <span className="text-blue-400">#{pr.number}</span>
            <span>·</span>
            <span>{pr.branch} → {pr.baseBranch}</span>
            <span>·</span>
            <span className="text-slate-300">@{pr.author}</span>
            <span>·</span>
            <span className="text-slate-500">{new Date(pr.createdAt).toLocaleDateString()}</span>
          </p>
        </div>
      </div>

      {/* Right Metrics & Actions */}
      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
        <div className="text-right">
          {pr.criticalFindings > 0 && (
            <p className="text-xs font-semibold text-red-400">
              {pr.criticalFindings} critical secret{pr.criticalFindings > 1 ? "s" : ""}
            </p>
          )}
          {pr.highFindings > 0 && (
            <p className="text-xs font-semibold text-orange-400">
              {pr.highFindings} high
            </p>
          )}
          {pr.totalFindings === 0 && pr.checkRunStatus === "success" && (
            <p className="text-xs font-medium text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Gate Passed</span>
            </p>
          )}
          {pr.checkRunStatus === "in_progress" && (
            <p className="text-xs text-slate-500">Checking pull request…</p>
          )}
          {pr.checkRunStatus === "failure" && pr.totalFindings > 0 && (
            <p className="text-[11px] text-red-500 flex items-center gap-1 justify-end">
              <ShieldAlert className="h-3 w-3" />
              <span>Merge Blocked</span>
            </p>
          )}
        </div>

        {pr.totalFindings > 0 && (
          <div className="flex items-center gap-2">
            <Link
              href={`/findings?repo=${encodeURIComponent(pr.repository)}`}
              className="px-2.5 py-1 text-xs rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              View Findings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PullRequestsPage() {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    try {
      const [prRes, repoRes] = await Promise.all([
        api.getPullRequests(),
        api.getRepositories(),
      ]);
      setPullRequests(prRes.pullRequests);
      setRepos(repoRes.repositories);
    } catch (e) {
      console.error("Failed to fetch pull requests:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    void loadData();

    // Automatically sync open PRs from GitHub on initial load
    api.syncPullRequests().then((res) => {
      if (mounted && res.success && res.pullRequests.length > 0) {
        setPullRequests(res.pullRequests);
      }
    });

    // Auto-poll every 5 seconds for live PR data and background scan completions
    const interval = setInterval(() => {
      api.getPullRequests().then((res) => {
        if (mounted && res.pullRequests) {
          setPullRequests(res.pullRequests);
        }
      });
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSyncPRs = async () => {
    setSyncLoading(true);
    setFeedback(null);
    try {
      const res = await api.syncPullRequests();
      if (res.success) {
        setPullRequests(res.pullRequests);
        setFeedback("Synced latest Pull Requests from GitHub!");
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback("Sync complete. Listening for GitHub App pull request events.");
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch {
      setFeedback("Sync request failed.");
    } finally {
      setSyncLoading(false);
    }
  };

  const filteredPRs = pullRequests.filter((pr) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      pr.title.toLowerCase().includes(q) ||
      pr.repository.toLowerCase().includes(q) ||
      String(pr.number).includes(q) ||
      pr.author.toLowerCase().includes(q)
    );
  });

  const failed = pullRequests.filter((p) => p.checkRunStatus === "failure");
  const passed = pullRequests.filter((p) => p.checkRunStatus === "success");
  const running = pullRequests.filter((p) => p.checkRunStatus === "in_progress");

  return (
    <div className="max-w-screen-xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <GitPullRequest className="h-5 w-5 text-blue-400" />
              <span>Pull Request Protection</span>
            </h1>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live GitHub Sync</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Secura automatically intercepts GitHub Pull Requests, inspects changed diffs for secrets, and posts results to GitHub.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncPRs}
            disabled={syncLoading}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-md shadow-blue-600/30 disabled:opacity-50"
          >
            {syncLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            <span>Sync GitHub PRs</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-blue-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2 text-red-400">
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{failed.length}</p>
              <p className="text-xs text-slate-400">Failing Gate (Secrets Detected)</p>
            </div>
          </div>
        </Card>

        <Card className="border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <Loader2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{running.length}</p>
              <p className="text-xs text-slate-400">Scanning in Progress</p>
            </div>
          </div>
        </Card>

        <Card className="border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{passed.length}</p>
              <p className="text-xs text-slate-400">Passed Gate (Safe to Merge)</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pull Requests List */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-slate-400" />
            <span>Monitored Pull Requests ({filteredPRs.length})</span>
          </CardTitle>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by title, repo, PR#..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              <span>Loading pull requests...</span>
            </div>
          ) : filteredPRs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-slate-500">
              <GitPullRequest className="h-10 w-10 mb-3 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No pull requests scanned yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Secura automatically scans pull requests when opened or updated on GitHub. You can also sync open PRs from GitHub or trigger a test scan below.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSyncPRs}
                  disabled={syncLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  <span>Sync Open PRs from GitHub</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filteredPRs.map((pr) => (
                <PRRow
                  key={pr.id}
                  pr={pr}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
