"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { Repository, PullRequest, Finding, PRCommit, PRFinding } from "@/types";
import {
  ArrowLeft,
  CheckCircle2,
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
  Layers,
  ArrowUpDown,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function RepositoryDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading repository...</div>}>
      <RepositoryDetailContent />
    </Suspense>
  );
}

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

function RepositoryDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

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
      const [repoData, prsData, findingsData] = await Promise.all([
        api.getRepositoryById(params.id),
        api.getPullRequests(params.id),
        api.getFindings({ repositoryId: params.id }),
      ]);
      setRepo(repoData);
      setPullRequests(prsData.pullRequests);
      setFindings(findingsData.findings);
    } catch (e) {
      console.error("Failed to load repository details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
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
              if (p.pullRequests) setPullRequests(p.pullRequests);
              if (f.findings) setFindings(f.findings);
            }
          })
          .catch(() => {});
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

  const handleRemove = async () => {
    if (!repo) return;
    if (confirm(`Remove "${repo.fullName}" from Secura? PR monitoring will stop.`)) {
      await api.removeRepository(repo.id);
      router.push("/repositories");
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
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        <span className="text-xs">Loading repository posture...</span>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <GitBranch className="h-10 w-10 text-slate-600 mx-auto" />
        <h2 className="text-base font-semibold text-slate-200">Repository Not Found</h2>
        <p className="text-xs text-slate-500">
          This repository may have been removed or you do not have permission to view it.
        </p>
        <Link
          href="/repositories"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Repositories
        </Link>
      </div>
    );
  }

  const openFindings = findings.filter((f) => f.status === "open");
  const criticalFindings = openFindings.filter((f) => f.severity === "CRITICAL");
  const highFindings = openFindings.filter((f) => f.severity === "HIGH");

  return (
    <div className="max-w-screen-xl mx-auto space-y-6">
      {/* ─── TOP BREADCRUMB ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/repositories" className="hover:text-slate-200 transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Repositories</span>
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium">{repo.name}</span>
      </div>

      {/* ─── TOP HEADER CARD (CONTAINER) ─────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              {repo.isPrivate ? (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/[0.06]">
                  <Lock className="h-3 w-3" />
                  <span>Private</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Unlock className="h-3 w-3" />
                  <span>Public</span>
                </span>
              )}
              <StatusBadge status={repo.lastScanStatus} />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 truncate">
              {repo.name}
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
              <span className="text-slate-300 font-semibold">@{repo.owner}</span>
              <span>·</span>
              <span>default branch: <strong className="text-slate-300">{repo.defaultBranch}</strong></span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              onClick={() => void loadData()}
              title="Refresh repository data"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <RefreshCcw className="h-4 w-4 text-slate-400 hover:text-white" />
            </button>

            <button
              onClick={handleRemove}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remove repository from Secura"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-300 flex items-center justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)}>
              <X className="h-3.5 w-3.5 text-blue-400 hover:text-white" />
            </button>
          </div>
        )}
      </div>

      {/* ─── TWO-COLUMN WORKSPACE: SECOND LEFT BAR + RIGHT CONTENT ──────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ─── SECOND LEFT SIDEBAR (SHOW ONLY REPOSITORY VIEW BAR) ────────── */}
        <aside className="w-full lg:w-64 shrink-0 rounded-2xl border border-white/[0.08] bg-[#0d1117] p-3 shadow-lg lg:sticky lg:top-4 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              <span>Repository View</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">3 sections</span>
          </div>

          {/* Section 1: Pull Requests */}
          <button
            onClick={() => setActiveTab("prs")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "prs"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <GitPullRequest className="h-4 w-4 shrink-0" />
              <span className="truncate">Pull Requests</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "prs" ? "bg-white/20 text-white" : "bg-white/[0.06] text-slate-400"
              }`}
            >
              {pullRequests.length}
            </span>
          </button>

          {/* Section 2: Security Findings */}
          <button
            onClick={() => setActiveTab("findings")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "findings"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span className="truncate">Security Findings</span>
            </div>
            {criticalFindings.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                {criticalFindings.length} crit
              </span>
            ) : (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "findings" ? "bg-white/20 text-white" : "bg-white/[0.06] text-slate-400"
                }`}
              >
                {openFindings.length}
              </span>
            )}
          </button>

          {/* Section 3: Integration & Config */}
          <button
            onClick={() => setActiveTab("info")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "info"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCode className="h-4 w-4 shrink-0" />
              <span className="truncate">Integration & Config</span>
            </div>
          </button>
        </aside>

        {/* ─── RIGHT MAIN CONTENT AREA ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* ─── SECTION 1: Pull Requests for this Repo ─────────────────────── */}
          {activeTab === "prs" && (
            <Card className="border-white/[0.08] bg-[#0d1117]">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.04]">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <GitPullRequest className="h-4 w-4 text-blue-400" />
                    <span>Pull Requests for {repo.name} ({pullRequests.length})</span>
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live secret detection, commit history & Check Run results across all branches.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[0.08] transition-all"
                    title="Toggle PR numerical order"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 text-blue-400" />
                    <span>Order: {sortOrder === "asc" ? "#1 → #N" : "#N → #1"}</span>
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-2">
                {pullRequests.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                    <GitPullRequest className="h-8 w-8 mb-2 text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">No pull requests on {repo.name}</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">
                      When a contributor opens or updates a Pull Request on this repository, Secura automatically scans the changed files for exposed secrets.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {orderedPullRequests.map((pr) => {
                      const isExpanded = Boolean(expandedPRs[pr.id]);
                      const prFindings = pr.findings || [];
                      const prCommits = pr.commits || [];
                      const isScanning = Boolean(scanningMap[pr.id]);
                      const isCommitsLoading = Boolean(loadingCommits[pr.id]);

                      return (
                        <div
                          key={pr.id}
                          className="py-3.5 hover:bg-white/[0.01] px-2 rounded-xl transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            {/* Left Side: Status icon, title, branches, commits count */}
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="mt-1">
                                <CheckIcon status={pr.checkRunStatus} state={pr.state} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <a
                                    href={pr.htmlUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-semibold text-slate-100 hover:text-blue-400 transition-colors flex items-center gap-1"
                                  >
                                    <span>{pr.title}</span>
                                    <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                                  </a>
                                  {pr.state === "merged" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30">
                                      <GitMerge className="h-3 w-3" />
                                      <span>Merged</span>
                                    </span>
                                  ) : pr.state === "closed" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30">
                                      Closed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      <span>Open</span>
                                    </span>
                                  )}
                                  <StatusBadge status={pr.checkRunStatus} />
                                </div>

                                <p className="text-xs text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                                  <span className="text-blue-400 font-semibold">#{pr.number}</span>
                                  <span>·</span>
                                  <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 border border-white/[0.06]">
                                    {pr.branch} → {pr.baseBranch}
                                  </span>
                                  <span>·</span>
                                  <span className="text-slate-300">@{pr.author}</span>
                                  <span>·</span>
                                  {/* Commits count indicator */}
                                  <button
                                    onClick={() => toggleExpand(pr)}
                                    className="inline-flex items-center gap-1 text-slate-300 hover:text-blue-400 transition-colors bg-white/[0.04] px-1.5 py-0.5 rounded"
                                    title="View commits in this pull request"
                                  >
                                    <GitCommit className="h-3 w-3 text-blue-400" />
                                    <span>{prCommits.length} commit{prCommits.length === 1 ? "" : "s"}</span>
                                  </button>
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

                            {/* Right Side: Finding count & action buttons */}
                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                              <div className="text-right">
                                {pr.criticalFindings > 0 && (
                                  <p className="text-xs text-red-400 font-semibold flex items-center gap-1 justify-end">
                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                    <span>{pr.criticalFindings} critical secret{pr.criticalFindings > 1 ? "s" : ""}</span>
                                  </p>
                                )}
                                {pr.highFindings > 0 && (
                                  <p className="text-xs text-orange-400 font-semibold">
                                    {pr.highFindings} high
                                  </p>
                                )}
                                {pr.totalFindings === 0 && pr.checkRunStatus === "success" && (
                                  <p className="text-xs text-emerald-400 flex items-center gap-1 justify-end font-medium">
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
                                  <p className="text-[11px] text-red-500 font-semibold justify-end flex items-center">
                                    <span>Merge Blocked</span>
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {/* Scan Button */}
                                <button
                                  onClick={() => void handleScanPR(pr)}
                                  disabled={isScanning || pr.checkRunStatus === "in_progress"}
                                  title="Scan this pull request with GitHub App engine"
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-white/[0.1] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-50"
                                >
                                  {isScanning ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                                  ) : (
                                    <Play className="h-3 w-3 text-emerald-400" />
                                  )}
                                  <span className="hidden sm:inline">Scan</span>
                                </button>

                                {/* Findings / Details Drawer Toggle */}
                                {prFindings.length > 0 ? (
                                  <button
                                    onClick={() => toggleExpand(pr)}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                  >
                                    <KeyRound className="h-3 w-3 shrink-0" />
                                    <span>{prFindings.length} Finding{prFindings.length > 1 ? "s" : ""}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="h-3 w-3 ml-0.5" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3 ml-0.5" />
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => toggleExpand(pr)}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white transition-colors"
                                  >
                                    <GitCommit className="h-3 w-3 text-blue-400" />
                                    <span>Details</span>
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                )}

                                <a
                                  href={pr.htmlUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                                  title="View PR on GitHub"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>

                          {/* ─── Expandable Commits & Findings Breakdown for this PR ──────────── */}
                          {isExpanded && (
                            <div className="mt-3.5 pt-3.5 border-t border-white/[0.06] bg-slate-900/60 rounded-xl p-3.5 space-y-4">
                              {/* ── Commits Timeline ── */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-white/[0.06]">
                                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                                    <GitCommit className="h-3.5 w-3.5 text-blue-400" />
                                    <span>Commits in PR #{pr.number} ({prCommits.length})</span>
                                  </span>
                                  <button
                                    onClick={() => void loadCommitsForPR(pr.repositoryId, pr.number, pr.id)}
                                    disabled={isCommitsLoading}
                                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                                    title="Refresh commit history from GitHub"
                                  >
                                    <RefreshCcw className={`h-3 w-3 ${isCommitsLoading ? "animate-spin" : ""}`} />
                                    <span>Refresh Commits</span>
                                  </button>
                                </div>

                                {isCommitsLoading ? (
                                  <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                                    <span>Fetching commit history from GitHub...</span>
                                  </div>
                                ) : prCommits.length === 0 ? (
                                  <div className="p-3 text-center rounded-lg border border-white/[0.06] bg-black/20 text-xs text-slate-400 flex items-center justify-center gap-2">
                                    <GitCommit className="h-4 w-4 text-slate-500" />
                                    <span>No commits recorded yet. Click Refresh Commits to sync directly from GitHub.</span>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {prCommits.map((commit, idx) => (
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
                                )}
                              </div>

                              {/* ── Security & Secrets Analysis ── */}
                              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                                <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                                    <KeyRound className="h-3.5 w-3.5 text-blue-400" />
                                    <span>Security & Secrets Analysis (GitHub App Engine)</span>
                                  </span>
                                  <Link
                                    href={`/findings?repo=${encodeURIComponent(repo.fullName)}`}
                                    className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                                  >
                                    <span>View in Findings catalog</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </div>

                                {prFindings.length === 0 ? (
                                  <div className="p-3.5 text-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400 flex items-center justify-center gap-2">
                                    <ShieldCheck className="h-4 w-4 shrink-0" />
                                    <span>No secrets or policy violations detected in this PR. Safe to merge!</span>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {prFindings.map((finding) => (
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
                                            href={`/findings?repo=${encodeURIComponent(repo.fullName)}`}
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
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── SECTION 2: Findings for this Repo ──────────────────────────── */}
          {activeTab === "findings" && (
            <Card className="border-white/[0.08] bg-[#0d1117]">
              <CardHeader className="pb-3 border-b border-white/[0.04] flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-orange-400" />
                    <span>Security Findings in {repo.fullName} ({openFindings.length} open)</span>
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Catalog of detected vulnerabilities across all scans for this repository.
                  </p>
                </div>
                <Link
                  href={`/findings?repo=${encodeURIComponent(repo.fullName)}`}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Full Findings Table</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="pt-2">
                {openFindings.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                    <ShieldCheck className="h-10 w-10 mb-2 text-emerald-400" />
                    <p className="text-sm font-semibold text-slate-200">Zero Open Vulnerabilities</p>
                    <p className="text-xs text-slate-500 mt-1">
                      All scanned code and pull requests for {repo.name} are clean. No exposed credentials detected.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {openFindings.map((finding) => (
                      <Link
                        key={finding.id}
                        href={`/findings/${finding.id}`}
                        className="flex items-start gap-3 py-3.5 hover:bg-white/[0.02] px-2 rounded-lg transition-colors group"
                      >
                        <SeverityBadge severity={finding.severity} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                              {finding.type}
                            </span>
                            <StatusBadge status={finding.status} />
                          </div>
                          <p className="text-xs text-slate-400 font-mono">
                            {finding.filePath}:{finding.lineNumber}
                          </p>
                          {finding.recommendation && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {finding.recommendation}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 self-center">
                          {new Date(finding.firstDetected).toLocaleDateString()}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── SECTION 3: Integration & Config Info ───────────────────────── */}
          {activeTab === "info" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-white/[0.08] bg-[#0d1117]">
                <CardHeader>
                  <CardTitle className="text-sm">Repository Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3 text-xs">
                    <div>
                      <dt className="text-slate-500 mb-0.5">Full Name</dt>
                      <dd className="text-slate-300 font-mono">{repo.fullName}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 mb-0.5">GitHub Repo ID</dt>
                      <dd className="text-slate-300 font-mono">{repo.githubRepoId || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 mb-0.5">Default Branch</dt>
                      <dd className="text-slate-300 font-mono">{repo.defaultBranch}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 mb-0.5">Visibility</dt>
                      <dd className="text-slate-300">{repo.isPrivate ? "Private" : "Public"}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card className="border-white/[0.08] bg-[#0d1117]">
                <CardHeader>
                  <CardTitle className="text-sm">GitHub Security Gate</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-400">
                  <p>
                    The <strong>Secura GitHub App</strong> intercepts every Pull Request opened against <code className="text-slate-300">{repo.fullName}</code>.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    <li>Inspects changed diffs for secrets, API tokens, and private keys.</li>
                    <li>Tracks all commit updates on pull requests.</li>
                    <li>Creates a GitHub Check Run: <code className="text-slate-300">Secura Security Gate</code>.</li>
                    <li>Posts remediation comments with exact line numbers on Pull Requests.</li>
                    <li>Blocks unsafe PR merges into <code className="text-slate-300">{repo.defaultBranch}</code>.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
