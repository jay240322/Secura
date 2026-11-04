"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import type { PullRequest, Repository } from "@/types";
import {
  ExternalLink,
  GitPullRequest,
  GitMerge,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Filter,
  Check,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";
import { PullRequestRow } from "@/components/pull-requests/pull-request-row";

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
                <PullRequestRow
                  key={pr.id}
                  pr={pr}
                  onScan={handleScanPR}
                  isScanning={Boolean(scanningMap[pr.id])}
                  showRepoName={true}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
