"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { Repository, PullRequest, Finding } from "@/types";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Loader2,
  Lock,
  Power,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  XCircle,
  Play,
  FileCode,
  X,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function RepositoryDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading repository...</div>}>
      <RepositoryDetailContent />
    </Suspense>
  );
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

    // Auto-poll every 6 seconds to keep PRs and findings live for this repository
    const interval = setInterval(() => {
      if (params?.id) {
        Promise.all([
          api.getRepositoryById(params.id),
          api.getPullRequests(params.id),
          api.getFindings({ repositoryId: params.id }),
        ]).then(([r, p, f]) => {
          if (mounted) {
            if (r) setRepo(r);
            if (p.pullRequests) setPullRequests(p.pullRequests);
            if (f.findings) setFindings(f.findings);
          }
        });
      }
    }, 6000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [params?.id]);

  const handleToggleMonitoring = async () => {
    if (!repo) return;
    const nextStatus = !repo.isMonitored;
    setRepo({ ...repo, isMonitored: nextStatus });
    try {
      await api.toggleRepositoryMonitoring(repo.id, nextStatus);
      setFeedback(`Monitoring ${nextStatus ? "enabled" : "paused"} for ${repo.name}.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      void loadData();
    }
  };

  const handleRemove = async () => {
    if (!repo) return;
    if (confirm(`Remove "${repo.fullName}" from Secura? PR monitoring will stop.`)) {
      await api.removeRepository(repo.id);
      router.push("/repositories");
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
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/repositories" className="hover:text-slate-200 transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Repositories</span>
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium">{repo.name}</span>
      </div>

      {/* Header Card */}
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
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  repo.isMonitored
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                    : "bg-slate-700/30 text-slate-400 border border-white/[0.06]"
                }`}
              >
                {repo.isMonitored ? "Active PR Protection" : "Monitoring Paused"}
              </span>
              <StatusBadge status={repo.lastScanStatus} />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 truncate">
              {repo.fullName}
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
              <span>default branch: <strong className="text-slate-300">{repo.defaultBranch}</strong></span>
              <span>·</span>
              <span>owner: <strong className="text-slate-300">{repo.owner}</strong></span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
            <button
              onClick={handleToggleMonitoring}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
                repo.isMonitored
                  ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30"
                  : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white border-white/[0.08]"
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{repo.isMonitored ? "PR Protection Active" : "Resume PR Gate"}</span>
            </button>

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
              onClick={handleRemove}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remove repository from Secura"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-300 flex items-center justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)}>
              <X className="h-3.5 w-3.5 text-blue-400 hover:text-white" />
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards for This One Repository */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-white/[0.06]">
          <p className="text-xs text-slate-500 mb-1">Monitored PRs</p>
          <p className="text-2xl font-bold text-slate-100">{pullRequests.length}</p>
        </Card>

        <Card className={criticalFindings.length > 0 ? "border-red-500/30" : "border-white/[0.06]"}>
          <p className="text-xs text-slate-500 mb-1">Critical Secrets</p>
          <p className={`text-2xl font-bold ${criticalFindings.length > 0 ? "text-red-400" : "text-slate-300"}`}>
            {criticalFindings.length}
          </p>
        </Card>

        <Card className={highFindings.length > 0 ? "border-orange-500/30" : "border-white/[0.06]"}>
          <p className="text-xs text-slate-500 mb-1">High Severity</p>
          <p className={`text-2xl font-bold ${highFindings.length > 0 ? "text-orange-400" : "text-slate-300"}`}>
            {highFindings.length}
          </p>
        </Card>

        <Card className="border-white/[0.06]">
          <p className="text-xs text-slate-500 mb-1">Total Open Findings</p>
          <p className="text-2xl font-bold text-slate-100">{openFindings.length}</p>
        </Card>
      </div>

      {/* Tabs Toolbar */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1">
        <button
          onClick={() => setActiveTab("prs")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "prs"
              ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
          }`}
        >
          <GitPullRequest className="h-3.5 w-3.5" />
          <span>Pull Requests ({pullRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("findings")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "findings"
              ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Security Findings ({openFindings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("info")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "info"
              ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
          }`}
        >
          <FileCode className="h-3.5 w-3.5" />
          <span>Integration & Config</span>
        </button>
      </div>

      {/* ─── TAB 1: Pull Requests for this Repo ──────────────────────────────── */}
      {activeTab === "prs" && (
        <Card>
          <CardHeader className="flex items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">
              Pull Requests on {repo.name}
            </CardTitle>
            <button
              onClick={() => void loadData()}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <RefreshCcw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </CardHeader>
          <CardContent>
            {pullRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                <GitPullRequest className="h-8 w-8 mb-2 text-slate-600" />
                <p className="text-sm font-medium text-slate-300">No pull requests scanned yet for {repo.name}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  When a contributor opens or updates a Pull Request on this repository, Secura automatically scans the diff and posts the gate status.
                </p>
                <button
                  onClick={() => setShowTestModal(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-md shadow-blue-600/30"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Test a Pull Request Scan</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {pullRequests.map((pr) => (
                  <div
                    key={pr.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-3.5 hover:bg-white/[0.01] px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-1">
                        {pr.checkRunStatus === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : pr.checkRunStatus === "failure" ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <a
                            href={pr.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-slate-100 hover:text-blue-400 transition-colors flex items-center gap-1"
                          >
                            <span>{pr.title}</span>
                            <ExternalLink className="h-3 w-3 opacity-50" />
                          </a>
                          <StatusBadge status={pr.checkRunStatus} />
                        </div>
                        <p className="text-xs text-slate-500 font-mono">
                          #{pr.number} · {pr.branch} → {pr.baseBranch} · by @{pr.author} · {new Date(pr.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        {pr.criticalFindings > 0 && (
                          <p className="text-xs text-red-400 font-semibold">{pr.criticalFindings} critical</p>
                        )}
                        {pr.highFindings > 0 && (
                          <p className="text-xs text-orange-400 font-semibold">{pr.highFindings} high</p>
                        )}
                        {pr.totalFindings === 0 && (
                          <p className="text-xs text-emerald-400">Safe to Merge</p>
                        )}
                      </div>
                      <a
                        href={pr.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-slate-300 hover:bg-white/[0.04] transition-colors"
                      >
                        View on GitHub
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── TAB 2: Findings for this Repo ───────────────────────────────────── */}
      {activeTab === "findings" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Security Findings in {repo.fullName} ({openFindings.length} open)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openFindings.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                <ShieldCheck className="h-10 w-10 mb-2 text-emerald-400" />
                <p className="text-sm font-semibold text-slate-200">Zero Open Vulnerabilities</p>
                <p className="text-xs text-slate-500 mt-1">
                  All scanned pull requests for {repo.name} are clean. No credentials or policy violations detected.
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

      {/* ─── TAB 3: Integration & Config Info ────────────────────────────────── */}
      {activeTab === "info" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">GitHub Security Gate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-400">
              <p>
                The <strong>Secura GitHub App</strong> intercepts every Pull Request opened against <code className="text-slate-300">{repo.fullName}</code>.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>Inspects changed diffs for secrets, API tokens, and private keys.</li>
                <li>Creates a GitHub Check Run: <code className="text-slate-300">Secura Security Gate</code>.</li>
                <li>Posts remediation comments with exact line numbers on Pull Requests.</li>
                <li>Blocks unsafe PR merges into <code className="text-slate-300">{repo.defaultBranch}</code>.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

