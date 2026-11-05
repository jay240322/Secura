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
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Loader } from "@/components/ui/loader";
import type { PullRequest } from "@/types";

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
    // Merged icon is already displayed directly next to the PR title via CheckIcon,
    // so we omit the redundant "Merged" text badge here.
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
  const findings = pr.findings || [];
  const commits = pr.commits || [];

  const handleToggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && onRefreshCommits && commits.length === 0) {
      void onRefreshCommits(pr);
    }
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
              <StatusBadge status={pr.checkRunStatus} />
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
                title="View commits in this pull request"
              >
                <GitCommit className="h-3 w-3 text-[#281C59] dark:text-blue-400" />
                <span>{commits.length} commit{commits.length === 1 ? "" : "s"}</span>
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
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Gate Passed</span>
              </p>
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

            {/* Findings Toggle Button */}
            {findings.length > 0 ? (
              <button
                onClick={handleToggleExpand}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                <span>{findings.length} Finding{findings.length > 1 ? "s" : ""}</span>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                )}
              </button>
            ) : (
              <button
                onClick={handleToggleExpand}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                title="View scan details"
              >
                <span>Details</span>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Commits & Findings Drawer */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-black/60 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 p-4 space-y-4">
          {/* Commits Timeline */}
          <div className="space-y-2 pb-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 pb-1.5 border-b border-slate-200/80 dark:border-zinc-800">
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <GitCommit className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Commits in PR #{pr.number} ({commits.length})</span>
              </span>
              <div className="flex items-center gap-3">
                {onRefreshCommits && (
                  <button
                    onClick={() => void onRefreshCommits(pr)}
                    disabled={isCommitsLoading}
                    className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                    title="Refresh commit history from GitHub"
                  >
                    <RefreshCcw className={`h-3 w-3 ${isCommitsLoading ? "animate-spin" : ""}`} />
                    <span>Refresh Commits</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">
                  head: {pr.commitSha ? pr.commitSha.slice(0, 7) : "HEAD"}
                </span>
              </div>
            </div>

            {isCommitsLoading ? (
              <div className="py-6 text-center text-slate-500 dark:text-zinc-400 text-xs flex flex-col items-center justify-center gap-2">
                <Loader size="sm" />
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">Fetching commit history from GitHub...</span>
              </div>
            ) : commits.length === 0 ? (
              <div className="p-3 text-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-center gap-2">
                <GitCommit className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <span>No commits recorded yet.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {commits.map((commit, idx) => (
                  <div
                    key={commit.fullSha || commit.sha || idx}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-xs"
                  >
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
                        </p>
                      </div>
                    </div>

                    {commit.htmlUrl && (
                      <a
                        href={commit.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0 flex items-center gap-1 self-center"
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

          {/* Security Findings Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Security & Secrets Analysis (GitHub App Engine)</span>
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href={`/findings?repo=${encodeURIComponent(pr.repository)}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[11px] font-medium"
                >
                  <span>Explore all repository findings</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {findings.length === 0 ? (
              <div className="p-4 text-center rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>No exposed secrets or SAST vulnerabilities detected in this Pull Request. Safe to merge!</span>
              </div>
            ) : (
              <div className="space-y-2">
                {findings.map((finding) => (
                  <div
                    key={finding.id}
                    className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/40">
                          {finding.ruleId || "SECRET"}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {finding.findingType}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                            finding.severity === "CRITICAL"
                              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40"
                              : finding.severity === "HIGH"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40"
                              : "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-900/40"
                          }`}
                        >
                          {finding.severity}
                        </span>
                      </div>

                      <p className="text-[11px] font-mono text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                        <FileCode2 className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                        <span className="text-slate-800 dark:text-zinc-200 font-semibold">{finding.filePath}</span>
                        <span>:</span>
                        <span className="text-blue-600 dark:text-blue-400">Line {finding.lineNumber}</span>
                      </p>

                      {finding.risk && (
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
                          <strong className="text-slate-800 dark:text-zinc-200">Risk:</strong> {finding.risk}
                        </p>
                      )}

                      {finding.recommendation && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                          <strong className="text-slate-800 dark:text-zinc-200">Remediation:</strong> {finding.recommendation}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 self-end sm:self-center">
                      <Link
                        href={`/findings?repo=${encodeURIComponent(pr.repository)}`}
                        className="px-3 py-1 text-[11px] font-medium rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors"
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
