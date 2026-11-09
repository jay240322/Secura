"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { comparePullRequests, enrichPRWithRefreshedCommits } from "@/lib/pull-request-utils";
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
  X,
  AlertTriangle,
  ChevronDown,
  Filter,
  Check,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";
import { PullRequestRow } from "@/components/pull-requests/pull-request-row";
import Loader from "@/components/ui/loader";

export default function PullRequestsPage() {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<"all" | "open" | "merged" | "closed">("all");
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [scanningMap, setScanningMap] = useState<Record<string, boolean>>({});
  const [loadingCommits, setLoadingCommits] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleRefreshCommits = async (pr: PullRequest) => {
    setLoadingCommits((prev) => ({ ...prev, [pr.id]: true }));
    try {
      const commits = await api.getPullRequestCommits(pr.repositoryId, pr.number);
      if (commits && commits.length > 0) {
        const { enrichedCommits, resolvedFindings, hasResolved } = enrichPRWithRefreshedCommits(pr, commits);
        setPullRequests((prev) =>
          prev.map((item) =>
            item.id === pr.id
              ? {
                  ...item,
                  commits: enrichedCommits,
                  historicalFindings: resolvedFindings,
                  hasResolvedViolations: hasResolved,
                }
              : item
          )
        );
      }
    } catch (e) {
      console.error("Failed to fetch PR commits:", e);
    } finally {
      setLoadingCommits((prev) => ({ ...prev, [pr.id]: false }));
    }
  };

  const loadData = async (repoId?: string) => {
    try {
      const activeRepoId = repoId !== undefined ? repoId : (selectedRepoId === "all" ? undefined : selectedRepoId);

      const [prRes, repoRes] = await Promise.all([
        api.getPullRequests(activeRepoId),
        api.getRepositories(),
      ]);
      if (prRes.isLive || prRes.pullRequests.length > 0) {
        setPullRequests(prRes.pullRequests);
      }
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
      if (repoParam && selectedRepoId !== repoParam) {
        setSelectedRepoId(repoParam);
      }
    }

    void loadData();

    // Automatically sync pull requests from GitHub on initial load
    const syncTargetRepo = selectedRepoId === "all" ? undefined : selectedRepoId;
    void api
      .syncPullRequests(syncTargetRepo)
      .then((res) => {
        if (mounted && res.success && res.pullRequests.length > 0) {
          setPullRequests(res.pullRequests);
        }
      })
      .catch(() => { });

    // Live auto-polling every 5 seconds for newly scanned PRs
    const interval = setInterval(() => {
      const repoId = selectedRepoId === "all" ? undefined : selectedRepoId;
      void api
        .getPullRequests(repoId)
        .then((res) => {
          if (mounted && res.isLive && res.pullRequests && res.pullRequests.length > 0) {
            setPullRequests(res.pullRequests);
          }
        })
        .catch(() => { });
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedRepoId]);

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
          const prState = (pr.state || "open").toLowerCase();
          if (prState !== selectedState) return false;
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
      .sort((a, b) => comparePullRequests(a, b, sortOrder));
  }, [pullRequests, selectedRepoId, selectedState, searchQuery, repos, sortOrder]);

  // Aggregate stats across currently filtered PR set
  const failed = pullRequests.filter((p) => p.checkRunStatus === "failure" || p.criticalFindings > 0);
  const passed = pullRequests.filter((p) => p.checkRunStatus === "success" && p.criticalFindings === 0);
  const mergedCount = pullRequests.filter((p) => (p.state || "").toLowerCase() === "merged").length;
  const openCount = pullRequests.filter((p) => (p.state || "open").toLowerCase() === "open").length;
  const closedCount = pullRequests.filter((p) => (p.state || "").toLowerCase() === "closed").length;

  return (
    <div className="max-w-screen-xl mx-auto space-y-5">
      {/* Page Header */}
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-blue-600 dark:text-blue-500" />
            <span>Pull Request Security Command Center</span>
          </h1>
        </div>

        {/* Repository Selector */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Repository Dropdown */}
          <div className="relative flex items-center">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              suppressHydrationWarning
              className="appearance-none rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-8 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-xs"
            >
              <option value="all">All Monitored Repos ({repos.length})</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName || r.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex items-center justify-between shadow-xs animate-fadeIn">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-blue-600 hover:text-blue-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-3.5">
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 p-2.5 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                {loading && pullRequests.length === 0 ? "..." : failed.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Blocked Gate (Findings)</p>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-3.5">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2.5 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/50">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                {loading && pullRequests.length === 0 ? "..." : passed.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Passed Gate (Safe to Merge)</p>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-3.5">
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/50 p-2.5 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-900/50">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                {loading && pullRequests.length === 0 ? "..." : mergedCount}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Merged Pull Requests</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs & Search Header */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
          {/* State Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 text-xs font-medium">
            <button
              onClick={() => setSelectedState("all")}
              suppressHydrationWarning
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedState === "all"
                  ? "bg-white text-slate-900 dark:bg-zinc-700 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
              }`}
            >
              All ({pullRequests.length})
            </button>
            <button
              onClick={() => setSelectedState("open")}
              suppressHydrationWarning
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedState === "open"
                  ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-200 dark:ring-emerald-800 font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Open ({openCount})</span>
            </button>
            <button
              onClick={() => setSelectedState("merged")}
              suppressHydrationWarning
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedState === "merged"
                  ? "bg-white dark:bg-zinc-700 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-200 dark:ring-purple-800 font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
              }`}
            >
              <GitMerge className="h-3 w-3" />
              <span>Merged ({mergedCount})</span>
            </button>
            <button
              onClick={() => setSelectedState("closed")}
              suppressHydrationWarning
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedState === "closed"
                  ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-xs ring-1 ring-slate-200 dark:ring-zinc-600 font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
              }`}
            >
              Closed ({closedCount})
            </button>
          </div>

          {/* Controls: Order & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              suppressHydrationWarning
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs transition-colors shrink-0"
              title="Toggle Pull Request numerical order"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500" />
              <span>Order: {sortOrder === "desc" ? "Latest First (#N → #1)" : "Oldest First (#1 → #N)"}</span>
            </button>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Filter by title, repo, branch, PR#..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                suppressHydrationWarning
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none transition-colors shadow-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500 dark:text-zinc-400 flex flex-col items-center gap-3">
              <Loader />
              <span>Fetching all repository pull requests and security scans...</span>
            </div>
          ) : filteredPRs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center text-slate-500 dark:text-zinc-400">
              <GitPullRequest className="h-10 w-10 mb-3 text-slate-400 dark:text-zinc-600" />
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                {searchQuery || selectedRepoId !== "all" || selectedState !== "all"
                  ? "No pull requests match the current filters"
                  : "No pull requests found for the selected repository"}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md">
                Secura automatically detects pull requests and scans diffs for secrets and SAST vulnerabilities in real time.
              </p>
              {pullRequests.length > 0 && (selectedState !== "all" || selectedRepoId !== "all" || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedState("all");
                    setSelectedRepoId("all");
                    setSearchQuery("");
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-all shadow-xs"
                >
                  <span>View All Pull Requests ({pullRequests.length})</span>
                </button>
              )}
              {pullRequests.length === 0 && (
                <button
                  onClick={() => void handleSyncPRs()}
                  disabled={syncLoading}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-all shadow-xs disabled:opacity-50"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 ${syncLoading ? "animate-spin" : ""}`} />
                  <span>{syncLoading ? "Syncing PRs..." : "Sync Pull Requests from GitHub"}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPRs.map((pr) => (
                <PullRequestRow
                  key={pr.id}
                  pr={pr}
                  onScan={handleScanPR}
                  isScanning={Boolean(scanningMap[pr.id])}
                  onRefreshCommits={handleRefreshCommits}
                  isCommitsLoading={Boolean(loadingCommits[pr.id])}
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
