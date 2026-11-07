"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  GitMerge,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  KeyRound,
  FileCode2,
  GitCommit,
  History,
  Sparkles,
  Check,
  AlertTriangle,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Loader } from "@/components/ui/loader";
import type { PullRequest, PRCommit, PRFinding, PRScanRun } from "@/types";

function shasMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (cleanA === cleanB) return true;
  if (cleanA.length >= 7 && cleanB.length >= 7) {
    return cleanA.startsWith(cleanB) || cleanB.startsWith(cleanA);
  }
  return false;
}

export function CheckIcon({
  status,
  state,
}: {
  status: PullRequest["checkRunStatus"];
  state?: PullRequest["state"];
}) {
  if (state === "merged") {
    return <GitMerge className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0" />;
  }
  if (status === "success")
    return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  if (status === "failure")
    return <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />;
  if (status === "in_progress")
    return <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />;
  return <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-zinc-700 shrink-0" />;
}

export function StateBadge({ state }: { state?: PullRequest["state"] }) {
  if (state === "merged") {
    return null;
  }
  if (state === "closed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800">
        <X className="h-3 w-3" />
        <span>Closed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/40">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span>Open</span>
    </span>
  );
}

export function PRFindingItem({
  finding,
  isResolved = false,
  resolvedInCommit,
  detectedInCommit,
  remediateUrl,
}: {
  finding: PRFinding;
  isResolved?: boolean;
  resolvedInCommit?: string | null;
  detectedInCommit?: string | null;
  remediateUrl?: string | null;
}) {
  const sev = (finding.severity || "HIGH").toUpperCase();
  const sevClass =
    sev === "CRITICAL"
      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/40"
      : sev === "HIGH"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/40"
      : "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/40";

  return (
    <div
      className={`rounded-xl border p-3 text-xs shadow-2xs space-y-2 transition-colors ${
        isResolved
          ? "border-emerald-200/80 dark:border-emerald-950/60 bg-white dark:bg-zinc-950"
          : "border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] font-bold text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-800">
            {finding.ruleId || "SECRET"}
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {finding.findingType || "Secret"}
          </span>
          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${sevClass}`}>
            {sev}
          </span>
          {isResolved ? (
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" />
              <span>Solved</span>
            </span>
          ) : (
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              Blocked
            </span>
          )}
        </div>

        {detectedInCommit && resolvedInCommit && (
          <span className="text-[11px] font-mono text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-800">
            Detected in <code className="font-bold text-rose-600 dark:text-rose-400">{detectedInCommit}</code>
            {" → "}
            Solved in <code className="font-bold text-emerald-600 dark:text-emerald-400">{resolvedInCommit}</code>
          </span>
        )}
      </div>

      <p className="text-[11px] font-mono text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
        <FileCode2 className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
        <span className="text-slate-800 dark:text-zinc-200 font-semibold">{finding.filePath}</span>
        <span>:</span>
        <span className="text-blue-600 dark:text-blue-400">Line {finding.lineNumber}</span>
      </p>

      {finding.risk && (
        <p className="text-[11px] text-slate-600 dark:text-zinc-400">
          <strong className="text-slate-800 dark:text-zinc-200">Risk:</strong> {finding.risk}
        </p>
      )}

      {isResolved ? (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-900/40">
          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>
            Secret removed in commit <code className="font-bold">{resolvedInCommit || "latest"}</code> and verified safe by Secura scanner.
          </span>
        </p>
      ) : finding.recommendation ? (
        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
          <p className="text-[11px] text-rose-700 dark:text-rose-400 flex items-center gap-1 font-medium bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded border border-rose-200 dark:border-rose-900/40">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
            <span>Remediation: {finding.recommendation}</span>
          </p>
          {remediateUrl && (
            <Link
              href={remediateUrl}
              className="px-3 py-1 text-[11px] font-medium rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Remediate →
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

export interface PullRequestRowProps {
  pr: PullRequest;
  onScan: (pr: PullRequest) => Promise<void>;
  isScanning: boolean;
  onRefreshCommits?: (pr: PullRequest) => Promise<void>;
  isCommitsLoading?: boolean;
  showRepoName?: boolean;
}

export function PullRequestRow({
  pr,
  onScan,
  isScanning,
  onRefreshCommits,
  isCommitsLoading = false,
  showRepoName = false,
}: PullRequestRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"commits" | "scan-runs" | "findings">("commits");
  const [expandedCommitSha, setExpandedCommitSha] = useState<string | null>(null);
  const [expandedScanRunId, setExpandedScanRunId] = useState<string | null>(null);

  const findings = pr.findings || [];
  const commits = pr.commits || [];
  const scanRuns = pr.scanRuns || [];
  const historicalFindings = pr.historicalFindings || [];

  // Check if any commit or previous scan run failed
  const failedCommitsCount = commits.filter(
    (c) => c.scanResult === "failed" || (c.criticalFindings || 0) > 0 || (c.totalFindings || 0) > 0
  ).length;

  const hasPreviousFailedRun = scanRuns.some(
    (r) => r.scanResult === "failed" || r.criticalFindings > 0 || r.totalFindings > 0
  );

  const isResolvedInHead =
    (pr.hasResolvedViolations || failedCommitsCount > 0 || hasPreviousFailedRun || historicalFindings.length > 0) &&
    pr.checkRunStatus === "success";

  const handleToggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    const hasMissingFindings = commits.some(
      (c) => (c.scanResult === "failed" || c.isResolved) && (!c.findings || c.findings.length === 0)
    );
    if (next && onRefreshCommits && (commits.length <= 1 || hasMissingFindings)) {
      void onRefreshCommits(pr);
    }
  };

  const toggleCommitFindings = (sha: string) => {
    setExpandedCommitSha((prev) => (prev === sha ? null : sha));
  };

  const toggleScanRunFindings = (id: string) => {
    setExpandedScanRunId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-md p-4 sm:p-5 shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:backdrop-blur-md dark:hover:border-zinc-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left Side Info */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="mt-0.5">
            <CheckIcon status={pr.checkRunStatus} state={pr.state} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <a
                href={pr.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-slate-900 dark:text-white hover:text-[#281C59] dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
              >
                <span>{pr.title}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-50 shrink-0" />
              </a>
              <StateBadge state={pr.state} />
              {pr.checkRunStatus && pr.checkRunStatus !== "success" && (
                <StatusBadge status={pr.checkRunStatus} />
              )}

              {/* Resolved Violations Indicator */}
              {isResolvedInHead && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/40">
                  <Sparkles className="h-3 w-3" />
                  <span>
                    {historicalFindings.length > 0
                      ? `${historicalFindings.length} Secret${historicalFindings.length > 1 ? "s" : ""} Solved in Latest Commit`
                      : "Previous Violation Resolved in Latest Commit"}
                  </span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-2 flex-wrap">
              {showRepoName && pr.repository && (
                <>
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">{pr.repository}</span>
                  <span>·</span>
                </>
              )}
              <span className="text-blue-600 dark:text-blue-400 font-semibold">#{pr.number}</span>
              <span>·</span>
              <span className="bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800">
                {pr.branch} → {pr.baseBranch}
              </span>
              <span>·</span>
              <span className="text-slate-600 dark:text-zinc-400">@{pr.author}</span>
              <span>·</span>
              <button
                type="button"
                onClick={handleToggleExpand}
                className="inline-flex items-center gap-1 text-slate-700 dark:text-zinc-400 hover:text-[#281C59] dark:hover:text-blue-400 transition-colors font-mono bg-[#EDE9E6] dark:bg-zinc-900 hover:bg-[#EDE9E6]/80 dark:hover:bg-zinc-800 px-2 py-0.5 rounded border border-[#EDE9E6] dark:border-zinc-800"
                title="View commits & scans in this pull request"
              >
                <GitCommit className="h-3 w-3 text-[#281C59] dark:text-blue-400" />
                <span>{commits.length} commit{commits.length === 1 ? "" : "s"}</span>
                {scanRuns.length > 1 && (
                  <span className="text-[10px] bg-white dark:bg-zinc-800 px-1 rounded ml-1 text-slate-600 dark:text-zinc-400">
                    {scanRuns.length} scans
                  </span>
                )}
              </button>
              <span>·</span>
              <span className="text-slate-500 dark:text-zinc-500">
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
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 justify-end">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>{pr.criticalFindings} critical secret{pr.criticalFindings > 1 ? "s" : ""}</span>
              </p>
            )}
            {pr.highFindings > 0 && (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {pr.highFindings} high
              </p>
            )}
            {pr.totalFindings === 0 && pr.checkRunStatus === "success" && (
              <div className="flex flex-col items-end">
                {isResolvedInHead ? (
                  <>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>Secrets Solved</span>
                    </p>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                      Resolved in latest commit
                    </span>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      <span>Clean</span>
                    </p>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                      0 secrets detected
                    </span>
                  </>
                )}
              </div>
            )}
            {pr.checkRunStatus === "in_progress" && (
              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 justify-end">
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                <span>Scanning PR…</span>
              </p>
            )}
            {pr.checkRunStatus === "failure" && pr.totalFindings > 0 && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 justify-end font-semibold">
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
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white shadow-xs transition-all disabled:opacity-50"
            >
              {isScanning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
              ) : (
                <Play className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span className="hidden sm:inline">Scan</span>
            </button>

            {/* Details / Findings Toggle Button */}
            <button
              onClick={handleToggleExpand}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                findings.length > 0
                  ? "border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                  : historicalFindings.length > 0
                  ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                  : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              {findings.length > 0 ? (
                <>
                  <KeyRound className="h-3.5 w-3.5 shrink-0" />
                  <span>{findings.length} Finding{findings.length > 1 ? "s" : ""}</span>
                </>
              ) : historicalFindings.length > 0 ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{historicalFindings.length} Solved</span>
                </>
              ) : (
                <span>Details</span>
              )}
              {expanded ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Commits, Scan Runs & Findings Drawer */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-black/60 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 p-4 space-y-4">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
            <button
              onClick={() => setActiveTab("commits")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "commits"
                  ? "bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-800 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <GitCommit className="h-3.5 w-3.5" />
              <span>Commits ({commits.length})</span>
              {failedCommitsCount > 0 && (
                <span className="text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-1.5 rounded-full font-bold">
                  {failedCommitsCount} failed
                </span>
              )}
            </button>

            {scanRuns.length > 0 && (
              <button
                onClick={() => setActiveTab("scan-runs")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "scan-runs"
                    ? "bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-800 dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>Scan History ({scanRuns.length} run{scanRuns.length === 1 ? "" : "s"})</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("findings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "findings"
                  ? "bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-800 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Findings ({findings.length + historicalFindings.length})</span>
              {historicalFindings.length > 0 && (
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 rounded-full font-bold">
                  {historicalFindings.length} solved
                </span>
              )}
            </button>

            <div className="ml-auto flex items-center gap-3">
              {onRefreshCommits && (
                <button
                  onClick={() => void onRefreshCommits(pr)}
                  disabled={isCommitsLoading}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                  title="Refresh commit history from GitHub"
                >
                  <RefreshCcw className={`h-3 w-3 ${isCommitsLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              )}
              <span className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono hidden sm:inline">
                head: {pr.commitSha ? pr.commitSha.slice(0, 7) : "HEAD"}
              </span>
            </div>
          </div>

          {/* TAB 1: COMMITS LIST WITH PER-COMMIT SCAN RESULTS */}
          {activeTab === "commits" && (
            <div className="space-y-3">
              {isCommitsLoading ? (
                <div className="py-6 text-center text-slate-500 dark:text-zinc-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Loader size="sm" />
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">Fetching commit history and scan results...</span>
                </div>
              ) : commits.length === 0 ? (
                <div className="p-3 text-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-center gap-2">
                  <GitCommit className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                  <span>No commits recorded yet.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {commits.map((commit, idx) => {
                    const isFailed =
                      commit.scanResult === "failed" ||
                      (commit.criticalFindings || 0) > 0 ||
                      (commit.totalFindings || 0) > 0;
                    const isPassed = commit.scanResult === "passed";
                    const isExpandedCommit = expandedCommitSha === commit.sha;

                    let commitFindings = commit.findings && commit.findings.length > 0 ? [...commit.findings] : [];
                    if (commitFindings.length === 0) {
                      commitFindings = historicalFindings.filter(
                        (hf) =>
                          shasMatch(hf.detectedInCommit, commit.sha) ||
                          shasMatch(hf.detectedInCommit, commit.fullSha) ||
                          shasMatch(hf.commitSha, commit.sha) ||
                          shasMatch(hf.commitSha, commit.fullSha)
                      );
                    }
                    if (commitFindings.length === 0 && (isFailed || commit.isResolved) && historicalFindings.length > 0) {
                      const otherFailedOrResolved = commits.filter(
                        (c) => c.sha !== commit.sha && (c.scanResult === "failed" || c.isResolved)
                      );
                      if (otherFailedOrResolved.length === 0) {
                        commitFindings = [...historicalFindings];
                      }
                    }

                    const findingsCount = commitFindings.length || commit.totalFindings || (isFailed ? 1 : 0);
                    const canToggle = isFailed || commit.isResolved || commitFindings.length > 0;

                    return (
                      <div
                        key={commit.fullSha || commit.sha || idx}
                        className={`rounded-xl border transition-colors shadow-xs ${
                          isFailed
                            ? "border-rose-200 dark:border-rose-900/60 bg-white dark:bg-zinc-950"
                            : isPassed
                            ? "border-emerald-200/80 dark:border-emerald-950/60 bg-white dark:bg-zinc-950"
                            : "border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
                        }`}
                      >
                        <div className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          {canToggle ? (
                            <button
                              type="button"
                              onClick={() => toggleCommitFindings(commit.sha)}
                              aria-expanded={isExpandedCommit}
                              className="flex items-start gap-2.5 min-w-0 flex-1 text-left bg-transparent border-0 p-0 cursor-pointer focus:outline-hidden group"
                            >
                              <span className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900/40 shrink-0 mt-0.5">
                                {commit.sha}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-900 dark:text-white leading-snug break-words group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {commit.message}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>@{commit.author}</span>
                                  {commit.date && (
                                    <>
                                      <span>·</span>
                                      <span>{new Date(commit.date).toLocaleDateString()}</span>
                                    </>
                                  )}
                                  {commit.isHistorical && (
                                    <span className="bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 px-1.5 py-0.2 rounded text-[10px]">
                                      Scanned Commit
                                    </span>
                                  )}
                                </p>
                              </div>
                            </button>
                          ) : (
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900/40 shrink-0 mt-0.5">
                                {commit.sha}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-900 dark:text-white leading-snug break-words">
                                  {commit.message}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>@{commit.author}</span>
                                  {commit.date && (
                                    <>
                                      <span>·</span>
                                      <span>{new Date(commit.date).toLocaleDateString()}</span>
                                    </>
                                  )}
                                  {commit.isHistorical && (
                                    <span className="bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 px-1.5 py-0.2 rounded text-[10px]">
                                      Scanned Commit
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Per-Commit Status & Actions */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {/* Secura Scan Status Badge for this Commit */}
                            {isFailed ? (
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/50">
                                  <XCircle className="h-3 w-3" />
                                  <span>
                                    Failed ({findingsCount} secret{findingsCount === 1 ? "" : "s"})
                                  </span>
                                </span>
                                {(commit.isResolved || (isResolvedInHead && !commit.isHead)) && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                                    <Sparkles className="h-3 w-3" />
                                    <span>Solved in latest commit</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleCommitFindings(commit.sha)}
                                  aria-expanded={isExpandedCommit}
                                  className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                                >
                                  <span>{isExpandedCommit ? "Hide" : "View"} Secrets ({findingsCount})</span>
                                  {isExpandedCommit ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </button>
                              </div>
                            ) : (commit.resolvesPriorViolations || (commit.isHead && isResolvedInHead)) ? (
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                                  <Sparkles className="h-3 w-3" />
                                  <span>Clean Fix Applied</span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                                Clean
                              </span>
                            )}

                            {commit.htmlUrl && (
                              <a
                                href={commit.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 pl-1"
                                title="View commit diff on GitHub"
                              >
                                <span>Diff</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Expandable Per-Commit Findings */}
                        {isExpandedCommit && (
                          <div className="border-t border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 p-3 space-y-2.5">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap text-xs font-semibold text-rose-900 dark:text-rose-200">
                              <span className="flex items-center gap-1.5 font-bold">
                                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                                <span>Secrets detected in commit <code className="font-mono bg-rose-100 dark:bg-rose-950 px-1 py-0.5 rounded font-bold">{commit.sha}</code> (Blocked merge):</span>
                              </span>
                              {(commit.isResolved || (isResolvedInHead && !commit.isHead)) && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700 shadow-2xs">
                                  <Check className="h-3 w-3" />
                                  <span>Solved: Removed in commit <code className="font-mono">{commit.resolvedInCommit || pr.commitSha?.slice(0, 7)}</code></span>
                                </span>
                              )}
                            </div>

                            {commitFindings.length > 0 ? (
                              commitFindings.map((finding) => (
                                <PRFindingItem
                                  key={finding.id}
                                  finding={finding}
                                  isResolved={commit.isResolved || (isResolvedInHead && !commit.isHead) || finding.isResolved}
                                  resolvedInCommit={finding.resolvedInCommit || commit.resolvedInCommit || pr.commitSha?.slice(0, 7)}
                                />
                              ))
                            ) : (
                              <div className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-zinc-950 p-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                <p className="font-medium text-rose-700 dark:text-rose-300">
                                  Security scanner detected violations in this commit.
                                </p>
                                <p className="mt-0.5 text-[11px]">
                                  Pushing a clean commit removes the secrets and unblocks pull request merging.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCAN RUNS HISTORY */}
          {activeTab === "scan-runs" && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Timeline of all security scan executions for PR #{pr.number}. Shows both previous blocked attempts and current passing checks.
              </p>

              <div className="space-y-2">
                {scanRuns.map((run, index) => {
                  const isRunFailed = run.scanResult === "failed" || run.criticalFindings > 0 || run.totalFindings > 0;
                  const isExpandedRun = expandedScanRunId === run.id;
                  const runNumber = scanRuns.length - index;

                  return (
                    <div
                      key={run.id || index}
                      className={`rounded-xl border transition-colors shadow-xs ${
                        isRunFailed
                          ? "border-rose-200 dark:border-rose-900/60 bg-white dark:bg-zinc-950"
                          : "border-emerald-200/80 dark:border-emerald-950/60 bg-white dark:bg-zinc-950"
                      }`}
                    >
                      <div className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 font-mono">
                              Run #{runNumber}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/40">
                              {run.commitSha}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
                            {isRunFailed ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                <XCircle className="h-3.5 w-3.5" />
                                <span>Failed — Merge Blocked ({run.totalFindings} secret{run.totalFindings === 1 ? "" : "s"})</span>
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Gate Passed (0 secrets)</span>
                              </span>
                            )}
                            {run.createdAt && (
                              <span className="text-slate-400 dark:text-zinc-500 text-[11px]">
                                · {new Date(run.createdAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {run.findings.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleScanRunFindings(run.id)}
                            aria-expanded={isExpandedRun}
                            className="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline flex items-center gap-1 shrink-0"
                          >
                            <span>{isExpandedRun ? "Hide" : "View"} {run.findings.length} findings</span>
                            {isExpandedRun ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>

                      {isExpandedRun && run.findings.length > 0 && (
                        <div className="border-t border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 p-3 space-y-2">
                          {run.findings.map((f) => (
                            <PRFindingItem
                              key={f.id}
                              finding={f}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: FINDINGS (CURRENT & HISTORICAL RESOLVED) */}
          {activeTab === "findings" && (
            <div className="space-y-4">
              {/* If all secrets are solved in latest commit */}
              {findings.length === 0 && historicalFindings.length > 0 && (
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5 shadow-2xs">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white text-xs">
                      All Detected Secrets Solved & Verified Clean!
                    </p>
                    <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                      The {historicalFindings.length} secret{historicalFindings.length > 1 ? "s" : ""} detected in prior commits were successfully removed in commit{" "}
                      <code className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded font-bold">
                        {pr.commitSha ? pr.commitSha.slice(0, 7) : "HEAD"}
                      </code>
                      . All security gates have passed and this pull request is safe to merge.
                    </p>
                  </div>
                </div>
              )}

              {/* Current Active Head Findings (if any) */}
              {findings.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      <span>Active Violations on Head Commit ({findings.length})</span>
                    </span>
                    <Link
                      href={`/findings?repo=${encodeURIComponent(pr.repository)}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[11px] font-medium"
                    >
                      <span>Repository Findings</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {findings.map((finding) => (
                      <PRFindingItem
                        key={finding.id}
                        finding={finding}
                        remediateUrl={`/findings?repo=${encodeURIComponent(pr.repository)}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Historical Resolved Findings from Prior Commits */}
              {historicalFindings.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-1.5 text-xs text-slate-700 dark:text-zinc-300 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-slate-900 dark:text-white font-bold">
                        Solved / Remediated Secrets from Prior Commits ({historicalFindings.length})
                      </span>
                    </span>
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                      Clean in commit {pr.commitSha ? pr.commitSha.slice(0, 7) : "HEAD"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {historicalFindings.map((hf) => (
                      <PRFindingItem
                        key={hf.id}
                        finding={hf}
                        isResolved
                        detectedInCommit={hf.detectedInCommit || (hf.commitSha ? hf.commitSha.slice(0, 7) : "earlier commit")}
                        resolvedInCommit={hf.resolvedInCommit || pr.commitSha?.slice(0, 7)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* If both active findings and historical findings are 0 */}
              {findings.length === 0 && historicalFindings.length === 0 && (
                <div className="p-3 text-center rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>No exposed secrets or SAST vulnerabilities detected on this pull request. Safe to merge!</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
