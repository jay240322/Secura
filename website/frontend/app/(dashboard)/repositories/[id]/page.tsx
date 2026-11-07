"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Repository, PullRequest, Finding } from "@/types";
import { PullRequestRow } from "@/components/pull-requests/pull-request-row";
import Loader from "@/components/ui/loader";
import { DeleteRepoModal } from "@/components/repositories/delete-repo-modal";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  GitMerge,
  GitCommit,
  Loader2,
  Lock,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  XCircle,
  Play,
  FileCode,
  FileCode2,
  X,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Shield,
  ArrowUpDown,
  Check,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function RepositoryDetailPage() {
  return (
    <Suspense fallback={<div className="py-24 flex justify-center"><Loader size="md" /></div>}>
      <RepositoryDetailContent />
    </Suspense>
  );
}

function RepositoryDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  // Consistent initial state between SSR and client hydration
  const [repo, setRepo] = useState<Repository | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"prs" | "findings" | "info">("prs");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scanningMap, setScanningMap] = useState<Record<string, boolean>>({});
  const [expandedPRs, setExpandedPRs] = useState<Record<string, boolean>>({});
  const [syncLoading, setSyncLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [loadingCommits, setLoadingCommits] = useState<Record<string, boolean>>({});

  // Keep PRs strictly ordered by numerical PR number (#1, #2, #3, ...)
  const orderedPullRequests = useMemo(() => {
    return [...pullRequests].sort((a, b) => {
      return sortOrder === "asc" ? a.number - b.number : b.number - a.number;
    });
  }, [pullRequests, sortOrder]);

  const loadData = async () => {
    if (!params?.id) return;
    try {
      // 1. Ultra-fast consolidated overview (1 single network round-trip instead of 3)
      const overview = await api.getRepositoryOverview(params.id);
      if (overview && overview.repository) {
        setRepo(overview.repository);
        if (overview.pullRequests) setPullRequests(overview.pullRequests);
        if (overview.findings) setFindings(overview.findings);
        setLoading(false);
        return;
      }

      // 2. Fallback to parallel requests if overview is unavailable
      const [repoData, prsData, findingsData] = await Promise.all([
        api.getRepositoryById(params.id),
        api.getPullRequests(params.id),
        api.getFindings({ repositoryId: params.id }),
      ]);
      if (repoData) setRepo(repoData);
      if (prsData.isLive || prsData.pullRequests.length > 0) {
        setPullRequests(prsData.pullRequests);
      }
      setFindings(findingsData.findings);
    } catch (e) {
      console.error("Failed to load repository details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check cached repository on client mount without premature loading dismiss
    if (params?.id) {
      const cached = api.getCachedRepository(params.id);
      if (cached && mounted) {
        setRepo(cached);
      }
    }

    void loadData();

    // Auto-poll every 5 seconds to keep PRs and findings live for this repository
    const interval = setInterval(() => {
      if (params?.id) {
        void Promise.all([
          api.getRepositoryById(params.id),
          api.getPullRequests(params.id),
          api.getFindings({ repositoryId: params.id }),
        ])
          .then(([r, p, f]) => {
            if (mounted) {
              if (r) setRepo(r);
              if (p.isLive && p.pullRequests && p.pullRequests.length > 0) setPullRequests(p.pullRequests);
              if (f.findings) setFindings(f.findings);
            }
          })
          .catch(() => { });
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [params?.id]);

  const loadCommitsForPR = async (repoId: string, pullNumber: number, prId: string) => {
    setLoadingCommits((prev) => ({ ...prev, [prId]: true }));
    try {
      const commits = await api.getPullRequestCommits(repoId, pullNumber);
      if (commits && commits.length > 0) {
        setPullRequests((prev) =>
          prev.map((item) => (item.id === prId ? { ...item, commits } : item))
        );
      }
    } catch (e) {
      console.error("Failed to fetch PR commits:", e);
    } finally {
      setLoadingCommits((prev) => ({ ...prev, [prId]: false }));
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmRemove = async () => {
    if (!repo) return;
    setDeleting(true);
    try {
      await api.removeRepository(repo.id);
      router.push("/repositories");
    } catch {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSyncPRs = async () => {
    if (!repo) return;
    setSyncLoading(true);
    setFeedback(null);
    try {
      const res = await api.syncPullRequests(repo.id);
      if (res.success) {
        setPullRequests(res.pullRequests);
        setFeedback("Successfully synced all Pull Requests and commits from GitHub!");
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback("Sync request sent. Listening for GitHub App events.");
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      setFeedback("Sync request failed.");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleScanPR = async (pr: PullRequest) => {
    setScanningMap((prev) => ({ ...prev, [pr.id]: true }));
    setFeedback(null);
    try {
      const res = await api.scanPullRequest(pr.repositoryId, pr.number, pr.branch, pr.baseBranch);
      if (res.success) {
        setFeedback(`Scan started for PR #${pr.number}! Live findings will appear below.`);
        setTimeout(() => setFeedback(null), 4000);
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

  const toggleExpand = (pr: PullRequest) => {
    const nextState = !expandedPRs[pr.id];
    setExpandedPRs((prev) => ({ ...prev, [pr.id]: nextState }));
    // Auto-fetch full commit list from GitHub if empty or only 1 placeholder commit
    if (nextState && (!pr.commits || pr.commits.length <= 1)) {
      void loadCommitsForPR(pr.repositoryId, pr.number, pr.id);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
        <Loader />
        <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Loading repository posture...</span>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <GitBranch className="h-10 w-10 text-slate-400 mx-auto" />
        <h2 className="text-base font-semibold text-slate-800">Repository Not Found</h2>
        <p className="text-xs text-slate-500">
          This repository may have been removed or you do not have permission to view it.
        </p>
        <Link
          href="/repositories"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Repositories
        </Link>
      </div>
    );
  }

  const openFindings = findings.filter((f) => f.status === "open");
  const criticalFindings = openFindings.filter((f) => f.severity === "CRITICAL");
  const highFindings = openFindings.filter((f) => f.severity === "HIGH");
  const solvedFindings = findings.filter((f) => f.status === "resolved" || f.status === "solved");

  return (
    <div className="relative">
      <div className="-mx-5 sm:-mx-8 -my-6 flex flex-col lg:flex-row lg:h-[calc(100vh-4rem)] lg:overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* ─── SECOND LEFT SIDEBAR (STICKY REPOSITORY VIEW BAR) ────────── */}
        <aside className="w-full lg:w-56 shrink-0 border-r border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 p-3 lg:h-full lg:overflow-y-auto flex flex-col justify-between select-none shrink-0 z-10">
          {/* Top Section */}
          <div className="space-y-3">
            {/* Back to Repos Button */}
            <Link
              href="/repositories"
              className="group flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-[#EDE9E6] dark:hover:bg-zinc-800 hover:text-[#281C59] dark:hover:text-zinc-100 transition-all shadow-2xs"
              title="Back to all repositories"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-[#281C59] dark:group-hover:text-zinc-300 transition-colors shrink-0" />
              <span>Back to Repos</span>
            </Link>

            {/* Nav Items */}
            <nav className="space-y-1 pt-1">
              {/* Section 1: Pull Requests */}
              <button
                onClick={() => setActiveTab("prs")}
                suppressHydrationWarning
                className={cn(
                  "group relative flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-all duration-150",
                  activeTab === "prs"
                    ? "bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-zinc-100 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-[#EDE9E6]/60 dark:hover:bg-zinc-900/80 hover:text-[#281C59] dark:hover:text-zinc-100 font-medium"
                )}
              >
                {activeTab === "prs" && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#281C59] dark:bg-zinc-300" />
                )}
                <div className="flex items-center gap-2 min-w-0">
                  <GitPullRequest
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      activeTab === "prs"
                        ? "text-[#281C59] dark:text-zinc-100"
                        : "text-slate-400 dark:text-zinc-500 group-hover:text-[#281C59] dark:group-hover:text-zinc-300"
                    )}
                  />
                  <span className="truncate">Pull Requests</span>
                </div>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors",
                    activeTab === "prs"
                      ? "bg-[#281C59] text-white dark:bg-zinc-800 dark:text-zinc-100"
                      : "bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-800 dark:text-zinc-400"
                  )}
                >
                  {pullRequests.length}
                </span>
              </button>

              {/* Section 2: Security Findings */}
              <button
                onClick={() => setActiveTab("findings")}
                suppressHydrationWarning
                className={cn(
                  "group relative flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-all duration-150",
                  activeTab === "findings"
                    ? "bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-zinc-100 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-[#EDE9E6]/60 dark:hover:bg-zinc-900/80 hover:text-[#281C59] dark:hover:text-zinc-100 font-medium"
                )}
              >
                {activeTab === "findings" && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#281C59] dark:bg-zinc-300" />
                )}
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      activeTab === "findings"
                        ? "text-[#281C59] dark:text-zinc-100"
                        : "text-slate-400 dark:text-zinc-500 group-hover:text-[#281C59] dark:group-hover:text-zinc-300"
                    )}
                  />
                  <span className="truncate">Findings</span>
                </div>
                {criticalFindings.length > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                    {criticalFindings.length} crit
                  </span>
                ) : (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors",
                      activeTab === "findings"
                        ? "bg-[#281C59] text-white dark:bg-zinc-800 dark:text-zinc-100"
                        : "bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-800 dark:text-zinc-400"
                    )}
                  >
                    {openFindings.length}
                  </span>
                )}
              </button>

              {/* Section 3: Integration & Config */}
              <button
                onClick={() => setActiveTab("info")}
                suppressHydrationWarning
                className={cn(
                  "group relative flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-all duration-150",
                  activeTab === "info"
                    ? "bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-zinc-100 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-[#EDE9E6]/60 dark:hover:bg-zinc-900/80 hover:text-[#281C59] dark:hover:text-zinc-100 font-medium"
                )}
              >
                {activeTab === "info" && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#281C59] dark:bg-zinc-300" />
                )}
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      activeTab === "info"
                        ? "text-[#281C59] dark:text-zinc-100"
                        : "text-slate-400 dark:text-zinc-500 group-hover:text-[#281C59] dark:group-hover:text-zinc-300"
                    )}
                  />
                  <span className="truncate">Config</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Bottom Section (Matching primary sidebar footer) */}
          <div className="pt-3 pb-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-2 shrink-0">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all"
              title="Open on GitHub"
            >
              <div className="flex items-center gap-2 truncate">
                <svg className="h-4 w-4 shrink-0 fill-current text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span className="truncate">GitHub Repo</span>
              </div>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
            </a>

            <div className="px-1 py-0.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500 font-mono">
              <span>Security Gate</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            </div>
          </div>
        </aside>

        {/* ─── RIGHT MAIN CONTENT AREA ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 w-full p-5 sm:p-8 space-y-6 lg:h-full lg:overflow-y-auto">
          {/* ─── TOP HEADER CARD (CONTAINER) ─────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950 backdrop-blur-md p-5 sm:p-6 shadow-sm shadow-slate-950/[0.03] dark:shadow-black/50">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                  {repo.isPrivate ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 font-medium">
                      <Lock className="h-3 w-3" />
                      <span>Private</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 font-medium">
                      <Unlock className="h-3 w-3" />
                      <span>Public</span>
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-[#281C59] dark:text-zinc-100 truncate">
                  {repo.name}
                </h1>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-1 flex items-center gap-2">
                  <span className="text-[#281C59] dark:text-zinc-300 font-semibold">@{repo.owner}</span>
                  <span>·</span>
                  <span>default branch: <strong className="text-slate-800 dark:text-zinc-200">{repo.defaultBranch}</strong></span>
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
                <a
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl bg-[#281C59] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#281C59]/90 transition-all"
                >
                  <span>GitHub</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <button
                  onClick={() => void loadData()}
                  title="Refresh repository data"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs transition-all"
                >
                  <RefreshCcw className="h-4 w-4 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200" />
                </button>

                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-zinc-900 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 shadow-xs transition-colors"
                  title="Remove repository from Secura"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Feedback message banner */}
            {feedback && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800 flex items-center justify-between shadow-xs">
                <span>{feedback}</span>
                <button onClick={() => setFeedback(null)}>
                  <X className="h-3.5 w-3.5 text-blue-600 hover:text-blue-800" />
                </button>
              </div>
            )}
          </div>
          {/* ─── SECTION 1: Pull Requests for this Repo ─────────────────────── */}
          {activeTab === "prs" && (
            <Card className="border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl shadow-xs">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-zinc-100">
                    <GitPullRequest className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                    <span>Pull Requests for {repo.name} ({pullRequests.length})</span>
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Live secret detection, commit history & Check Run results across all branches.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all shadow-xs"
                    title="Toggle PR numerical order"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500" />
                    <span>Order: {sortOrder === "asc" ? "#1 → #N" : "#N → #1"}</span>
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-3">
                {pullRequests.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center">
                    <GitPullRequest className="h-8 w-8 mb-2 text-slate-400 dark:text-zinc-600" />
                    <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">No pull requests on {repo.name}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md">
                      When a contributor opens or updates a Pull Request on this repository, Secura automatically scans the changed files for exposed secrets.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderedPullRequests.map((pr) => (
                      <PullRequestRow
                        key={pr.id}
                        pr={pr}
                        onScan={handleScanPR}
                        isScanning={Boolean(scanningMap[pr.id])}
                        onRefreshCommits={(p) => loadCommitsForPR(p.repositoryId, p.number, p.id)}
                        isCommitsLoading={Boolean(loadingCommits[pr.id])}
                        showRepoName={false}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── SECTION 2: Findings for this Repo ──────────────────────────── */}
          {activeTab === "findings" && (
            <Card className="border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-zinc-100">
                    <ShieldAlert className="h-4 w-4 text-orange-500" />
                    <span>
                      Security Findings in {repo.fullName} ({openFindings.length} open
                      {solvedFindings.length > 0 ? ` · ${solvedFindings.length} solved` : ""})
                    </span>
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Catalog of detected vulnerabilities across all scans for this repository.
                  </p>
                </div>
                <Link
                  href={`/findings?repo=${encodeURIComponent(repo.fullName)}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Open Full Findings Table</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="pt-2">
                {findings.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center">
                    <ShieldCheck className="h-10 w-10 mb-2 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Zero Security Vulnerabilities</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                      All scanned code and pull requests for {repo.name} are clean. No exposed credentials detected.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {findings.map((finding) => {
                      const isResolved = finding.status === "resolved" || finding.status === "solved" || Boolean(finding.isResolved);
                      const detectedSha = finding.detectedInCommit || (finding.commitSha ? finding.commitSha.slice(0, 7) : null);
                      const resolvedSha = finding.resolvedInCommit;

                      return (
                        <Link
                          key={finding.id}
                          href={`/findings/${finding.id}`}
                          className="flex items-start gap-3 py-3.5 hover:bg-slate-50/70 dark:hover:bg-zinc-900/60 px-2 rounded-lg transition-colors group"
                        >
                          <SeverityBadge severity={finding.severity} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {finding.type}
                              </span>
                              <StatusBadge status={isResolved ? "resolved" : finding.status} />
                              <span className="text-[10px] text-slate-600 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                                {finding.ruleId}
                              </span>
                              {isResolved ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                                  <Check className="h-2.5 w-2.5" />
                                  <span>Solved in commit {resolvedSha || "latest commit"}</span>
                                </span>
                              ) : detectedSha ? (
                                <span className="text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/40">
                                  Commit {detectedSha}
                                </span>
                              ) : null}
                              {finding.pullNumber && (
                                <span className="text-[10px] font-mono font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900/40">
                                  PR #{finding.pullNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                              {finding.filePath}:{finding.lineNumber}
                            </p>
                            {isResolved && (
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-mono mt-1">
                                <Check className="h-3 w-3 shrink-0" />
                                <span>
                                  Detected in commit <code className="font-bold text-rose-600 dark:text-rose-400">{detectedSha || "prior commit"}</code> → Solved in commit <code className="font-bold text-emerald-600 dark:text-emerald-400">{resolvedSha || "latest commit"}</code>
                                </span>
                              </p>
                            )}
                            {finding.recommendation && !isResolved && (
                              <p className="text-xs text-slate-600 dark:text-zinc-400 truncate mt-0.5">
                                {finding.recommendation}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 dark:text-zinc-500 self-center" suppressHydrationWarning>
                            {new Date(finding.firstDetected).toLocaleDateString()}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── SECTION 3: Integration & Config Info ───────────────────────── */}
          {activeTab === "info" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800/80">
                  <CardTitle className="text-sm text-slate-900 dark:text-zinc-100">Repository Metadata</CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <dl className="space-y-3 text-xs">
                    <div>
                      <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Full Name</dt>
                      <dd className="text-slate-900 dark:text-zinc-100 font-mono font-medium">{repo.fullName}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">GitHub Repo ID</dt>
                      <dd className="text-slate-900 dark:text-zinc-100 font-mono font-medium">{repo.githubRepoId || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Default Branch</dt>
                      <dd className="text-slate-900 dark:text-zinc-100 font-mono font-medium">{repo.defaultBranch}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Visibility</dt>
                      <dd className="text-slate-900 dark:text-zinc-100 font-medium">{repo.isPrivate ? "Private" : "Public"}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800/80">
                  <CardTitle className="text-sm text-slate-900 dark:text-zinc-100">GitHub Security Gate</CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-3 text-xs text-slate-600 dark:text-zinc-400">
                  <p>
                    The <strong className="text-slate-800 dark:text-zinc-200">Secura GitHub App</strong> intercepts every Pull Request opened against <code className="text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 px-1 py-0.5 rounded font-mono border border-slate-200/80 dark:border-zinc-800">{repo.fullName}</code>.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-zinc-400">
                    <li>Inspects changed diffs for secrets, API tokens, and private keys.</li>
                    <li>Tracks all commit updates on pull requests.</li>
                    <li>Creates a GitHub Check Run: <code className="text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 px-1 py-0.5 rounded font-mono border border-slate-200/80 dark:border-zinc-800">Secura Security Gate</code>.</li>
                    <li>Posts remediation comments with exact line numbers on Pull Requests.</li>
                    <li>Blocks unsafe PR merges into <code className="text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 px-1 py-0.5 rounded font-mono border border-slate-200/80 dark:border-zinc-800">{repo.defaultBranch}</code>.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ─── Delete Repository Confirmation Modal ────────────────────────── */}
      <DeleteRepoModal
        isOpen={Boolean(showDeleteModal && repo)}
        repoFullName={repo?.fullName || ""}
        loading={deleting}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
