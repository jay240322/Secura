"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { PullRequest, Repository, PRFinding } from "@/types";
import {
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  GitMerge,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Play,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Filter,
  Check,
  KeyRound,
  FileCode2,
  ArrowUpDown,
  GitCommit,
} from "lucide-react";
import Link from "next/link";

function CheckIcon({
  status,
  state,
}: {
  status: PullRequest["checkRunStatus"];
  state?: PullRequest["state"];
}) {
  if (state === "merged") {
    return <GitMerge className="h-5 w-5 text-purple-400 shrink-0" />;
  }
  if (status === "success")
    return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
  if (status === "failure")
    return <XCircle className="h-5 w-5 text-red-400 shrink-0" />;
  if (status === "in_progress")
    return <Loader2 className="h-5 w-5 text-blue-400 animate-spin shrink-0" />;
  return <div className="h-5 w-5 rounded-full border-2 border-slate-600 shrink-0" />;
}

function StateBadge({ state }: { state?: PullRequest["state"] }) {
  if (state === "merged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30">
        <GitMerge className="h-3 w-3" />
        <span>Merged</span>
      </span>
    );
  }
  if (state === "closed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30">
        <X className="h-3 w-3" />
        <span>Closed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span>Open</span>
    </span>
  );
}

function PRRow({
  pr,
  onScan,
  isScanning,
}: {
  pr: PullRequest;
  onScan: (pr: PullRequest) => Promise<void>;
  isScanning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const findings = pr.findings || [];

  return (
    <div className="border-b border-white/[0.04] py-3.5 last:border-0 hover:bg-white/[0.01] px-3 rounded-xl transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left Side Info */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="mt-1">
            <CheckIcon status={pr.checkRunStatus} state={pr.state} />
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
              <StateBadge state={pr.state} />
              <StatusBadge status={pr.checkRunStatus} />
            </div>

            <p className="text-xs text-slate-400 font-mono flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-300">{pr.repository}</span>
              <span>·</span>
              <span className="text-blue-400 font-semibold">#{pr.number}</span>
              <span>·</span>
              <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 border border-white/[0.06]">
                {pr.branch} → {pr.baseBranch}
              </span>
              <span>·</span>
              <span className="text-slate-300">@{pr.author}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-slate-300 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">
                <GitCommit className="h-3 w-3 text-blue-400" />
                <span>{pr.commits?.length || 0} commit{pr.commits?.length === 1 ? "" : "s"}</span>
              </span>
              <span>·</span>
              <span className="text-slate-500">
                {pr.state === "merged" && pr.mergedAt
                  ? `Merged on ${new Date(pr.mergedAt).toLocaleDateString()}`
                  : pr.state === "closed" && pr.closedAt
                  ? `Closed on ${new Date(pr.closedAt).toLocaleDateString()}`
                  : `Opened ${new Date(pr.createdAt).toLocaleDateString()}`}
              </span>
            </p>
          </div>
        </div>

        {/* Right Side Status & Controls */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <div className="text-right">
            {pr.criticalFindings > 0 && (
              <p className="text-xs font-semibold text-red-400 flex items-center gap-1 justify-end">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>{pr.criticalFindings} critical secret{pr.criticalFindings > 1 ? "s" : ""}</span>
              </p>
            )}
            {pr.highFindings > 0 && (
              <p className="text-xs font-semibold text-orange-400">
                {pr.highFindings} high
              </p>
            )}
            {pr.totalFindings === 0 && pr.checkRunStatus === "success" && (
              <p className="text-xs font-medium text-emerald-400 flex items-center gap-1 justify-end">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Gate Passed</span>
              </p>
            )}
            {pr.checkRunStatus === "in_progress" && (
              <p className="text-xs text-blue-400 flex items-center gap-1 justify-end">
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                <span>Scanning PR…</span>
              </p>
            )}
            {pr.checkRunStatus === "failure" && pr.totalFindings > 0 && (
              <p className="text-[11px] text-red-500 flex items-center gap-1 justify-end font-semibold">
                <span>Merge Blocked</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Scan PR Button */}
            <button
              onClick={() => void onScan(pr)}
              disabled={isScanning || pr.checkRunStatus === "in_progress"}
              title="Trigger on-demand security scan for this pull request"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-white/[0.1] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-50"
            >
              {isScanning ? (
                <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
              ) : (
                <Play className="h-3 w-3 text-emerald-400" />
              )}
              <span className="hidden sm:inline">Scan</span>
            </button>

            {/* Findings Toggle Button */}
            {findings.length > 0 ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <KeyRound className="h-3 w-3 shrink-0" />
                <span>{findings.length} Finding{findings.length > 1 ? "s" : ""}</span>
                {expanded ? (
                  <ChevronUp className="h-3 w-3 ml-0.5" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                )}
              </button>
            ) : (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200 transition-colors"
                title="View scan details"
              >
                <span>Details</span>
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Commits & Findings Drawer */}
      {expanded && (
        <div className="mt-3.5 pt-3.5 border-t border-white/[0.06] bg-slate-900/60 rounded-xl p-3.5 space-y-4">
          {/* Commits Timeline */}
          {pr.commits && pr.commits.length > 0 && (
            <div className="space-y-2 pb-2">
              <div className="flex items-center justify-between text-xs text-slate-300 pb-1.5 border-b border-white/[0.06]">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <GitCommit className="h-3.5 w-3.5 text-blue-400" />
                  <span>Commits in PR #{pr.number} ({pr.commits.length})</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  head: {pr.commitSha.slice(0, 7)}
                </span>
              </div>

              <div className="space-y-1.5">
                {pr.commits.map((commit, idx) => (
                  <div
                    key={commit.fullSha || commit.sha || idx}
                    className="flex items-start justify-between gap-3 p-2 rounded-lg border border-white/[0.04] bg-black/30 hover:border-white/[0.1] transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="font-mono text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 shrink-0 mt-0.5">
                        {commit.sha}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-200 leading-snug break-words">
                          {commit.message}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>@{commit.author}</span>
                          {commit.date && (
                            <>
                              <span>·</span>
                              <span>{new Date(commit.date).toLocaleDateString()}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {commit.htmlUrl && (
                      <a
                        href={commit.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-400 hover:underline shrink-0 flex items-center gap-1 self-center"
                        title="View commit diff on GitHub"
                      >
                        <span>Diff</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Findings Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-blue-400" />
                <span>Security & Secrets Analysis (GitHub App Engine)</span>
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href={`/findings?repo=${encodeURIComponent(pr.repository)}`}
                  className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>Explore all repository findings</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

          {findings.length === 0 ? (
            <div className="p-4 text-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400 flex items-center justify-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>No exposed secrets or SAST vulnerabilities detected in this Pull Request. Safe to merge!</span>
            </div>
          ) : (
            <div className="space-y-2">
              {findings.map((finding) => (
                <div
                  key={finding.id}
                  className="rounded-lg border border-white/[0.06] bg-black/40 p-2.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-white/[0.12] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                        {finding.ruleId || "SECRET"}
                      </span>
                      <span className="font-semibold text-slate-200">
                        {finding.findingType}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          finding.severity === "CRITICAL"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : finding.severity === "HIGH"
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        }`}
                      >
                        {finding.severity}
                      </span>
                    </div>

                    <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <FileCode2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-300 font-semibold">{finding.filePath}</span>
                      <span>:</span>
                      <span className="text-blue-400">Line {finding.lineNumber}</span>
                    </p>

                    {finding.risk && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        <strong className="text-slate-300">Risk:</strong> {finding.risk}
                      </p>
                    )}

                    {finding.recommendation && (
                      <p className="text-[11px] text-emerald-400/90 mt-0.5">
                        <strong className="text-slate-300">Remediation:</strong> {finding.recommendation}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 self-end sm:self-center">
                    <Link
                      href={`/findings?repo=${encodeURIComponent(pr.repository)}`}
                      className="px-2.5 py-1 text-[11px] rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-colors"
                    >
                      Remediate →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
}

export default function PullRequestsPage() {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<"all" | "open" | "merged" | "closed">("all");
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [scanningMap, setScanningMap] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const loadData = async (repoId?: string, state?: string) => {
    try {
      const activeRepoId = repoId !== undefined ? repoId : (selectedRepoId === "all" ? undefined : selectedRepoId);
      const activeState = state !== undefined ? state : (selectedState === "all" ? undefined : selectedState);

      const [prRes, repoRes] = await Promise.all([
        api.getPullRequests(activeRepoId, activeState),
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

    // Check URL parameters for preselected repository
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const repoParam = urlParams.get("repo");
      if (repoParam) {
        // Will be matched once repos are loaded
      }
    }

    void loadData();

    // Automatically sync pull requests from GitHub on initial load
    void api
      .syncPullRequests()
      .then((res) => {
        if (mounted && res.success && res.pullRequests.length > 0) {
          setPullRequests(res.pullRequests);
        }
      })
      .catch(() => {});

    // Live auto-polling every 5 seconds for newly scanned PRs
    const interval = setInterval(() => {
      const repoId = selectedRepoId === "all" ? undefined : selectedRepoId;
      const st = selectedState === "all" ? undefined : selectedState;
      void api
        .getPullRequests(repoId, st)
        .then((res) => {
          if (mounted && res.pullRequests) {
            setPullRequests(res.pullRequests);
          }
        })
        .catch(() => {});
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedRepoId, selectedState]);

  // Sync PRs from GitHub button
  const handleSyncPRs = async () => {
    setSyncLoading(true);
    setFeedback(null);
    try {
      const targetRepoId = selectedRepoId === "all" ? undefined : selectedRepoId;
      const res = await api.syncPullRequests(targetRepoId);
      if (res.success) {
        setPullRequests(res.pullRequests);
        setFeedback("Successfully synchronized all Pull Requests (open, merged & closed) from GitHub!");
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback("Sync request completed. Listening for live GitHub App events.");
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch {
      setFeedback("Sync request failed. Verify GitHub App configuration.");
    } finally {
      setSyncLoading(false);
    }
  };

  // Trigger on-demand PR scan
  const handleScanPR = async (pr: PullRequest) => {
    setScanningMap((prev) => ({ ...prev, [pr.id]: true }));
    setFeedback(null);
    try {
      const res = await api.scanPullRequest(pr.repositoryId, pr.number, pr.branch, pr.baseBranch);
      if (res.success) {
        setFeedback(`Scan started for ${pr.repository} PR #${pr.number}! Results will update live.`);
        setTimeout(() => setFeedback(null), 4000);
        // Instant refresh
        setTimeout(() => void loadData(), 2000);
      } else {
        setFeedback(res.message || "Failed to trigger scan.");
      }
    } catch {
      setFeedback("Error launching scan.");
    } finally {
      setScanningMap((prev) => ({ ...prev, [pr.id]: false }));
    }
  };

  // Filtered & strictly ordered PR list (#1, #2, #3, ...)
  const filteredPRs = useMemo(() => {
    return pullRequests
      .filter((pr) => {
        // 1. Repo filter
        if (selectedRepoId !== "all" && pr.repositoryId !== selectedRepoId) {
          // Also check repo full name match
          const matchingRepo = repos.find((r) => r.id === selectedRepoId);
          if (matchingRepo && pr.repository !== matchingRepo.fullName && pr.repository !== matchingRepo.name) {
            return false;
          }
        }

        // 2. State filter (open, merged, closed)
        if (selectedState !== "all") {
          if (selectedState === "open" && pr.state !== "open") return false;
          if (selectedState === "merged" && pr.state !== "merged") return false;
          if (selectedState === "closed" && pr.state !== "closed") return false;
        }

        // 3. Search query
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          pr.title.toLowerCase().includes(q) ||
          pr.repository.toLowerCase().includes(q) ||
          String(pr.number).includes(q) ||
          pr.branch.toLowerCase().includes(q) ||
          pr.baseBranch.toLowerCase().includes(q) ||
          pr.author.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        return sortOrder === "asc" ? a.number - b.number : b.number - a.number;
      });
  }, [pullRequests, selectedRepoId, selectedState, searchQuery, repos, sortOrder]);

  // Aggregate stats across currently filtered PR set
  const failed = pullRequests.filter((p) => p.checkRunStatus === "failure" || p.criticalFindings > 0);
  const passed = pullRequests.filter((p) => p.checkRunStatus === "success" && p.criticalFindings === 0);
  const mergedCount = pullRequests.filter((p) => p.state === "merged").length;
  const openCount = pullRequests.filter((p) => p.state === "open" || !p.state).length;
  const closedCount = pullRequests.filter((p) => p.state === "closed").length;

  return (
    <div className="max-w-screen-xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <GitPullRequest className="h-5 w-5 text-blue-400" />
              <span>Pull Request Security Command Center</span>
            </h1>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live GitHub Checks & Secrets Detection</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Inspect all pull requests (open, merged, and closed) across your repositories. Secura detects exposed secrets and SAST vulnerabilities in PR diffs and blocks dangerous merges.
          </p>
        </div>

        {/* Repository Selector & Sync Action */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Repository Dropdown */}
          <div className="relative flex items-center">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="appearance-none rounded-xl border border-white/[0.1] bg-slate-900 pl-8 pr-8 py-2 text-xs font-semibold text-slate-200 hover:border-blue-500 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Monitored Repositories ({repos.length})</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName || r.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Sync Button */}
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
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300 flex items-center justify-between animate-fadeIn">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-blue-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-red-500/20 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2 text-red-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{failed.length}</p>
              <p className="text-xs text-slate-400">Failing Gate (Secrets Detected)</p>
            </div>
          </div>
        </Card>

        <Card className="border-emerald-500/20 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{passed.length}</p>
              <p className="text-xs text-slate-400">Passed Gate (Safe to Merge)</p>
            </div>
          </div>
        </Card>

        <Card className="border-purple-500/20 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
              <GitMerge className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{mergedCount}</p>
              <p className="text-xs text-slate-400">Merged PRs Monitored</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs & Search Header */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.04]">
          {/* State Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/[0.06] text-xs font-semibold">
            <button
              onClick={() => setSelectedState("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedState === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({pullRequests.length})
            </button>
            <button
              onClick={() => setSelectedState("open")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedState === "open"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Open ({openCount})</span>
            </button>
            <button
              onClick={() => setSelectedState("merged")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedState === "merged"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <GitMerge className="h-3 w-3" />
              <span>Merged ({mergedCount})</span>
            </button>
            <button
              onClick={() => setSelectedState("closed")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedState === "closed"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Closed ({closedCount})
            </button>
          </div>

          {/* Controls: Order & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-black/40 text-xs font-semibold text-slate-300 hover:text-white transition-colors shrink-0"
              title="Toggle Pull Request numerical order"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-blue-400" />
              <span>Order: {sortOrder === "asc" ? "#1 → #N" : "#N → #1"}</span>
            </button>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by title, repo, branch, PR#..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <span>Fetching all repository pull requests and security scans...</span>
            </div>
          ) : filteredPRs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center text-slate-500">
              <GitPullRequest className="h-10 w-10 mb-3 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">
                {searchQuery || selectedRepoId !== "all" || selectedState !== "all"
                  ? "No pull requests match the current filters"
                  : "No pull requests found for the selected repository"}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Secura automatically detects pull requests from GitHub. Click &quot;Sync GitHub PRs&quot; to fetch open, merged, and closed PRs and scan their diffs for exposed secrets.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSyncPRs}
                  disabled={syncLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  <span>Sync All PRs from GitHub</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {filteredPRs.map((pr) => (
                <PRRow
                  key={pr.id}
                  pr={pr}
                  onScan={handleScanPR}
                  isScanning={Boolean(scanningMap[pr.id])}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
