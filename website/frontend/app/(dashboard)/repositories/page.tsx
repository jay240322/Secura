"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { Repository } from "@/types";
import {
  Database,
  ExternalLink,
  GitBranch,
  Loader2,
  Lock,
  Play,
  Plus,
  RefreshCcw,
  Unlock,
} from "lucide-react";
import Link from "next/link";

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function RepoCard({
  repo,
  onScan,
  isScanning,
}: {
  repo: Repository;
  onScan: (id: string) => Promise<void> | void;
  isScanning: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 hover:border-white/[0.1] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {repo.isPrivate ? (
              <Lock className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <Unlock className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span className="text-xs text-slate-500">{repo.owner}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-100 truncate">
            {repo.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {repo.defaultBranch}
          </p>
        </div>
        <StatusBadge status={isScanning ? "scanning" : repo.lastScanStatus} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center rounded-lg bg-black/30 py-2">
          <p
            className={`text-lg font-semibold ${
              repo.criticalFindings > 0 ? "text-red-400" : "text-slate-400"
            }`}
          >
            {repo.criticalFindings}
          </p>
          <p className="text-[10px] text-slate-600">critical</p>
        </div>
        <div className="text-center rounded-lg bg-black/30 py-2">
          <p
            className={`text-lg font-semibold ${
              repo.highFindings > 0 ? "text-orange-400" : "text-slate-400"
            }`}
          >
            {repo.highFindings}
          </p>
          <p className="text-[10px] text-slate-600">high</p>
        </div>
        <div className="text-center rounded-lg bg-black/30 py-2">
          <p className="text-lg font-semibold text-slate-300">
            {repo.openFindings}
          </p>
          <p className="text-[10px] text-slate-600">total</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Last scan: {formatRelative(repo.lastScanAt)}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              void onScan(repo.id);
            }}
            disabled={isScanning}
            className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Trigger manual scan"
          >
            {isScanning ? (
              <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {isScanning ? "Scanning..." : "Scan"}
          </button>
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
          <Link
            href={`/findings?repo=${encodeURIComponent(repo.fullName)}`}
            className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-colors"
          >
            Findings
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [scanningRepoId, setScanningRepoId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadRepos() {
      try {
        const res = await api.getRepositories();
        if (mounted) {
          setRepos(res.repositories);
          setIsLive(res.isLive);
        }
      } catch (e) {
        console.error("Failed to load repos:", e);
      }
    }
    void loadRepos();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    try {
      const res = await api.getRepositories();
      setRepos(res.repositories);
      setIsLive(res.isLive);
    } catch (e) {
      console.error("Failed to refresh repos:", e);
    }
  };

  const handleScan = async (repoId: string) => {
    setScanningRepoId(repoId);
    try {
      await api.triggerScan(repoId);
      setTimeout(() => {
        void handleRefresh();
        setScanningRepoId(null);
      }, 1500);
    } catch {
      setScanningRepoId(null);
    }
  };

  const monitored = repos.filter((r) => r.isMonitored);
  const unmonitored = repos.filter((r) => !r.isMonitored);

  return (
    <div className="max-w-screen-xl mx-auto space-y-6">
      {/* Live indicator */}
      {isLive && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5 text-xs text-emerald-400">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 animate-pulse" />
            <span>
              <strong>Neon Database:</strong> Repositories synced with PostgreSQL.
            </span>
          </div>
          <button
            onClick={() => {
              void handleRefresh();
            }}
            className="flex items-center gap-1 text-[11px] hover:underline"
          >
            <RefreshCcw className="h-3 w-3" /> Refresh
          </button>
        </div>
      )}

      {/* Connect CTA */}
      <div className="flex items-center gap-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 border border-blue-600/30">
          <GitBranch className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-200">
            Connect more repositories
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Install the Secura GitHub App to monitor additional repositories
            automatically.
          </p>
        </div>
        <Link
          href="/settings"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Connect GitHub
        </Link>
      </div>

      {/* Monitored repos */}
      <div>
        <h2 className="text-sm font-medium text-slate-300 mb-4">
          Monitored repositories ({monitored.length})
        </h2>
        {monitored.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-slate-500">
            No repositories monitored yet. Connect your GitHub account to import repositories.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monitored.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                onScan={handleScan}
                isScanning={scanningRepoId === repo.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Available (unmonitored) repos */}
      {unmonitored.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-300 mb-4">
            Available repositories ({unmonitored.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unmonitored.map((repo) => (
              <div
                key={repo.id}
                className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5 opacity-60"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-slate-500">{repo.owner}</p>
                    <h3 className="text-sm font-medium text-slate-300">
                      {repo.name}
                    </h3>
                  </div>
                  <StatusBadge status="never" />
                </div>
                <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.04] hover:opacity-100 transition-all">
                  <Plus className="h-3.5 w-3.5" />
                  Add to monitoring
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
