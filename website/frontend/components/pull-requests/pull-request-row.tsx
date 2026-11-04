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
import type { PullRequest } from "@/types";

export function CheckIcon({
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

export function StateBadge({ state }: { state?: PullRequest["state"] }) {
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
              {showRepoName && pr.repository && (
                <>
                  <span className="font-semibold text-slate-300">{pr.repository}</span>
                  <span>·</span>
                </>
              )}
              <span className="text-blue-400 font-semibold">#{pr.number}</span>
              <span>·</span>
              <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 border border-white/[0.06]">
                {pr.branch} → {pr.baseBranch}
              </span>
              <span>·</span>
              <span className="text-slate-300">@{pr.author}</span>
              <span>·</span>
              <button
                type="button"
                onClick={handleToggleExpand}
                className="inline-flex items-center gap-1 text-slate-300 hover:text-blue-400 transition-colors font-mono bg-white/[0.04] px-1.5 py-0.5 rounded"
                title="View commits in this pull request"
              >
                <GitCommit className="h-3 w-3 text-blue-400" />
                <span>{commits.length} commit{commits.length === 1 ? "" : "s"}</span>
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
                onClick={handleToggleExpand}
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
                onClick={handleToggleExpand}
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
          <div className="space-y-2 pb-2">
            <div className="flex items-center justify-between text-xs text-slate-300 pb-1.5 border-b border-white/[0.06]">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <GitCommit className="h-3.5 w-3.5 text-blue-400" />
                <span>Commits in PR #{pr.number} ({commits.length})</span>
              </span>
              <div className="flex items-center gap-3">
                {onRefreshCommits && (
                  <button
                    onClick={() => void onRefreshCommits(pr)}
                    disabled={isCommitsLoading}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                    title="Refresh commit history from GitHub"
                  >
                    <RefreshCcw className={`h-3 w-3 ${isCommitsLoading ? "animate-spin" : ""}`} />
                    <span>Refresh Commits</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-500 font-mono">
                  head: {pr.commitSha ? pr.commitSha.slice(0, 7) : "HEAD"}
                </span>
              </div>
            </div>

            {isCommitsLoading ? (
              <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                <span>Fetching commit history from GitHub...</span>
              </div>
            ) : commits.length === 0 ? (
              <div className="p-3 text-center rounded-lg border border-white/[0.06] bg-black/20 text-xs text-slate-400 flex items-center justify-center gap-2">
                <GitCommit className="h-4 w-4 text-slate-500" />
                <span>No commits recorded yet.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {commits.map((commit, idx) => (
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

