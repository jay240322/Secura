"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { Repository, AvailableRepository, User } from "@/types";
import {
  Database,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Loader2,
  Lock,
  Plus,
  RefreshCcw,
  Unlock,
  Search,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Power,
  X,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  Clock,
  ArrowRight,
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
  onToggleMonitoring,
  onRemove,
}: {
  repo: Repository;
  onToggleMonitoring: (id: string, currentStatus: boolean) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
}) {
  const isClean = repo.criticalFindings === 0 && repo.highFindings === 0 && repo.openFindings === 0;

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 ${
        repo.isMonitored
          ? "border-white/[0.08] bg-gradient-to-b from-[#131b26]/90 to-[#0c1017]/95 shadow-lg shadow-black/40 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5"
          : "border-white/[0.04] bg-[#0c1017]/60 opacity-75 hover:opacity-100 hover:border-white/15"
      }`}
    >
      {/* Top Header Row */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {/* Privacy indicator */}
            <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-slate-400">
              {repo.isPrivate ? (
                <>
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Private</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3 text-slate-400" />
                  <span>Public</span>
                </>
              )}
            </span>

            {/* Monitoring Gate Pill */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                repo.isMonitored
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border border-slate-700/60"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  repo.isMonitored ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
              {repo.isMonitored ? "PR Gate Active" : "Gate Paused"}
            </span>
          </div>

          <StatusBadge status={repo.lastScanStatus} />
        </div>

        {/* Repository Title & Owner */}
        <div className="mb-3">
          <span className="text-[11px] font-mono text-slate-500 block truncate">
            {repo.owner} /
          </span>
          <Link
            href={`/repositories/${repo.id}`}
            className="text-base font-bold text-slate-100 group-hover:text-blue-400 transition-colors truncate block mt-0.5"
            title={repo.fullName}
          >
            {repo.name}
          </Link>

          {/* Branch & Scan Metadata */}
          <div className="flex items-center gap-2.5 text-xs text-slate-400 font-mono mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-slate-300">
              <GitBranch className="h-3 w-3 text-blue-400" />
              <span>{repo.defaultBranch}</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-slate-500 text-[11px]">
              <Clock className="h-3 w-3 text-slate-500" />
              <span>
                {repo.lastScanAt ? `PR checked ${formatRelative(repo.lastScanAt)}` : "Awaiting first PR"}
              </span>
            </span>
          </div>
        </div>

        {/* Pull Request Security Protection Note */}
        <div className="mb-4 flex items-center justify-between rounded-xl border border-white/[0.05] bg-black/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="text-[11px] text-slate-400">Automated GitHub PR security gate</span>
          </div>
          {repo.isMonitored ? (
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
              Enforcing
            </span>
          ) : (
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              Paused
            </span>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div
            className={`text-center rounded-xl py-2.5 px-1 border transition-all ${
              repo.criticalFindings > 0
                ? "bg-red-500/10 border-red-500/25 shadow-sm shadow-red-500/10"
                : "bg-black/30 border-white/[0.04]"
            }`}
          >
            <p
              className={`text-base font-bold ${
                repo.criticalFindings > 0 ? "text-red-400" : "text-slate-400"
              }`}
            >
              {repo.criticalFindings}
            </p>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
              Critical
            </p>
          </div>

          <div
            className={`text-center rounded-xl py-2.5 px-1 border transition-all ${
              repo.highFindings > 0
                ? "bg-amber-500/10 border-amber-500/25 shadow-sm shadow-amber-500/10"
                : "bg-black/30 border-white/[0.04]"
            }`}
          >
            <p
              className={`text-base font-bold ${
                repo.highFindings > 0 ? "text-amber-400" : "text-slate-400"
              }`}
            >
              {repo.highFindings}
            </p>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
              High
            </p>
          </div>

          <div
            className={`text-center rounded-xl py-2.5 px-1 border transition-all ${
              isClean && (repo.lastScanStatus === "clean" || repo.lastScanStatus === "passed")
                ? "bg-emerald-500/10 border-emerald-500/25"
                : "bg-black/30 border-white/[0.04]"
            }`}
          >
            <p
              className={`text-base font-bold ${
                isClean && (repo.lastScanStatus === "clean" || repo.lastScanStatus === "passed")
                  ? "text-emerald-400"
                  : "text-slate-300"
              }`}
            >
              {repo.openFindings}
            </p>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
              Total Open
            </p>
          </div>
        </div>
      </div>

      {/* Action Controls & Navigation */}
      <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
        {/* Primary Row: View Details & Quick Links */}
        <div className="grid grid-cols-5 gap-1.5">
          <Link
            href={`/repositories/${repo.id}`}
            className="col-span-3 flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-600/15 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/25 hover:border-blue-500/50 hover:text-white transition-all shadow-sm shadow-blue-950/40"
            title="Open repository details, pull requests, and findings"
          >
            <span>View Details</span>
            <ArrowRight className="h-3 w-3" />
          </Link>

          <Link
            href={`/pull-requests?repo=${encodeURIComponent(repo.fullName)}`}
            className="flex items-center justify-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            title="View Pull Requests scanned by GitHub App"
          >
            <GitPullRequest className="h-3 w-3 text-blue-400" />
            <span>PRs</span>
          </Link>

          <Link
            href={`/findings?repo=${encodeURIComponent(repo.fullName)}`}
            className="flex items-center justify-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            title="View Security Findings"
          >
            <ShieldAlert className="h-3 w-3 text-red-400" />
            <span className="text-[11px]">Alerts</span>
          </Link>
        </div>

        {/* Secondary Row: Toggle Status & External Links */}
        <div className="flex items-center justify-between text-xs pt-1">
          <button
            onClick={() => void onToggleMonitoring(repo.id, repo.isMonitored)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
              repo.isMonitored
                ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
            }`}
            title={repo.isMonitored ? "Click to Pause Monitoring" : "Click to Enable Monitoring"}
          >
            <Power className="h-3 w-3" />
            <span>{repo.isMonitored ? "Monitoring On" : "Enable Gate"}</span>
          </button>

          <div className="flex items-center gap-1">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors"
              title="Open repository on GitHub"
            >
              <ExternalLink className="h-3 w-3" />
            </a>

            <button
              onClick={() => void onRemove(repo.id)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] text-slate-500 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 transition-colors"
              title="Remove repository from Secura"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "monitored" | "unmonitored">("all");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Add Repository & Available GitHub Repositories Selector
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<AvailableRepository[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedFullNames, setSelectedFullNames] = useState<Set<string>>(new Set());
  const [bulkAddLoading, setBulkAddLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  // Manual fallback input
  const [newRepoFullName, setNewRepoFullName] = useState("");
  const [newRepoBranch, setNewRepoBranch] = useState("main");
  const [newRepoIsPrivate, setNewRepoIsPrivate] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

  const loadAvailableRepos = async () => {
    setAvailableLoading(true);
    setAddFeedback(null);
    try {
      const list = await api.getAvailableRepositories();
      setAvailableRepos(list);
    } catch {
      setAvailableRepos([]);
    } finally {
      setAvailableLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setShowAddModal(true);
    setShowManualForm(false);
    setSelectedFullNames(new Set());
    void loadAvailableRepos();
  };

  const toggleSelectRepo = (fullName: string) => {
    setSelectedFullNames((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });
  };

  const handleAddSingleAvailableRepo = async (repo: AvailableRepository) => {
    setBulkAddLoading(true);
    setAddFeedback(null);
    try {
      const res = await api.addRepository({
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        isPrivate: repo.isPrivate,
        isMonitored: true,
        htmlUrl: repo.htmlUrl,
        githubRepoId: repo.githubRepoId,
      });
      if (res.success && res.repository) {
        setRepos((prev) => [res.repository!, ...prev.filter((r) => r.fullName !== repo.fullName)]);
        setAvailableRepos((prev) =>
          prev.map((r) => (r.fullName === repo.fullName ? { ...r, alreadyMonitored: true } : r))
        );
        setSyncFeedback(`Added "${repo.fullName}" to Secura! Pull Request security protection active.`);
        setTimeout(() => setSyncFeedback(null), 4000);
      } else {
        setAddFeedback(res.error || "Failed to add repository.");
      }
    } catch {
      setAddFeedback("Network error. Please try again.");
    } finally {
      setBulkAddLoading(false);
    }
  };

  const handleBulkAddSelected = async () => {
    if (selectedFullNames.size === 0) return;
    setBulkAddLoading(true);
    setAddFeedback(null);
    try {
      const toAdd = availableRepos.filter((r) => selectedFullNames.has(r.fullName));
      const res = await api.bulkAddRepositories(toAdd);
      if (res.success && res.repositories) {
        const addedNames = new Set(res.repositories.map((r) => r.fullName));
        setRepos((prev) => [...res.repositories!, ...prev.filter((r) => !addedNames.has(r.fullName))]);
        setAvailableRepos((prev) =>
          prev.map((r) => (addedNames.has(r.fullName) ? { ...r, alreadyMonitored: true } : r))
        );
        setSelectedFullNames(new Set());
        setShowAddModal(false);
        setSyncFeedback(`Added ${res.repositories.length} repositories to Secura! Pull Request security protection active.`);
        setTimeout(() => setSyncFeedback(null), 4000);
      } else {
        setAddFeedback(res.error || "Failed to add selected repositories.");
      }
    } catch {
      setAddFeedback("Network error adding repositories.");
    } finally {
      setBulkAddLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadRepos(isInitial = false) {
      try {
        const user = api.getStoredUser();
        if (user) setCurrentUser(user);

        // On initial page mount, automatically sync from GitHub App so newly allowed repositories appear right away
        if (isInitial) {
          const syncRes = await api.syncRepositories();
          if (mounted && syncRes.success && syncRes.repositories.length > 0) {
            setRepos(syncRes.repositories);
            setIsLive(true);
            return;
          }
        }

        const res = await api.getRepositories();
        if (mounted) {
          setRepos(res.repositories);
          setIsLive(res.isLive);
        }
      } catch (e) {
        console.error("Failed to load repos:", e);
      }
    }
    void loadRepos(true);

    // Auto-poll every 6 seconds to keep repository metrics live
    const interval = setInterval(() => {
      void loadRepos(false);
    }, 6000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleRefresh = async () => {
    try {
      const res = await api.getRepositories();
      setRepos(res.repositories);
      setIsLive(res.isLive);
    } catch (e) {
      console.error("Failed to refresh repos:", e);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    setSyncFeedback(null);
    try {
      const res = await api.syncRepositories();
      if (res.success) {
        setRepos(res.repositories);
        setSyncFeedback(`Synced ${res.repositories.length} repositories from GitHub App!`);
        setTimeout(() => setSyncFeedback(null), 4000);
      } else {
        setSyncFeedback(res.error || "Failed to sync repositories.");
      }
    } catch {
      setSyncFeedback("Sync failed. Check backend connection.");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleToggleMonitoring = async (repoId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    // Optimistic UI update
    setRepos((prev) =>
      prev.map((r) => (r.id === repoId ? { ...r, isMonitored: nextStatus } : r))
    );
    try {
      await api.toggleRepositoryMonitoring(repoId, nextStatus);
    } catch (e) {
      console.error("Failed to toggle monitoring:", e);
      void handleRefresh();
    }
  };

  const handleRemove = async (repoId: string) => {
    if (!confirm("Are you sure you want to remove this repository from Secura?")) return;
    setRepos((prev) => prev.filter((r) => r.id !== repoId));
    try {
      await api.removeRepository(repoId);
    } catch (e) {
      console.error("Failed to delete repo:", e);
      void handleRefresh();
    }
  };

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoFullName.trim()) return;

    setAddLoading(true);
    setAddFeedback(null);

    try {
      const res = await api.addRepository({
        fullName: newRepoFullName.trim(),
        defaultBranch: newRepoBranch.trim() || "main",
        isPrivate: newRepoIsPrivate,
        isMonitored: true,
      });

      if (res.success && res.repository) {
        setRepos((prev) => [res.repository!, ...prev]);
        setNewRepoFullName("");
        setShowAddForm(false);
      } else {
        setAddFeedback(res.error || "Failed to add repository.");
      }
    } catch {
      setAddFeedback("Network error. Please try again.");
    } finally {
      setAddLoading(false);
    }
  };

  // Filter & Search
  const filteredRepos = repos.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.fullName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterTab === "monitored") return r.isMonitored;
    if (filterTab === "unmonitored") return !r.isMonitored;
    return true;
  });

  const monitoredCount = repos.filter((r) => r.isMonitored).length;

  return (
    <div className="max-w-screen-xl mx-auto space-y-6">
      {/* ─── Official GitHub App Integration Banner ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/25 via-blue-950/30 to-[#0d1117] p-5 shadow-xl shadow-blue-950/20">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
            <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">
                Secura GitHub Security Scanner
              </h2>
              <span className="rounded-full bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                Official GitHub App
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Install the GitHub App to automatically block secret leaks and trigger PR security checks.
              {currentUser?.githubUsername && (
                <span className="text-blue-300 font-medium ml-1">
                  Connected to @{currentUser.githubUsername}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncLoading}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/15 px-3.5 py-2.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 hover:border-blue-400 transition-all disabled:opacity-50"
          >
            {syncLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            <span>Sync Repositories</span>
          </button>
          <a
            href="https://github.com/apps/secura-security-scanner"
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all"
          >
            <span>Configure on GitHub</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Sync Feedback Alert */}
      {syncFeedback && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-xs text-blue-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-400" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* ─── Toolbar: Search, Filters & Add Repo ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search repositories by name or owner..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filterTab === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              All ({repos.length})
            </button>
            <button
              onClick={() => setFilterTab("monitored")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filterTab === "monitored" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Monitored ({monitoredCount})
            </button>
            <button
              onClick={() => setFilterTab("unmonitored")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filterTab === "unmonitored" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Paused ({repos.length - monitoredCount})
            </button>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Repository</span>
          </button>
        </div>
      </div>

      {/* ─── GitHub App Repository Selector Modal ────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-[#0d1117] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] p-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Select Repositories to Monitor</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Choose repositories accessible from GitHub to add to Secura.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Search Toolbar */}
            <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={availableSearch}
                  onChange={(e) => setAvailableSearch(e.target.value)}
                  placeholder="Filter available repositories by name..."
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={loadAvailableRepos}
                disabled={availableLoading}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                title="Refresh repositories from GitHub"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${availableLoading ? "animate-spin" : ""}`} />
                <span>Reload</span>
              </button>
            </div>

            {/* Modal Error/Feedback Banner */}
            {addFeedback && (
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{addFeedback}</span>
              </div>
            )}

            {/* Modal Repositories List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {availableLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-500 mb-2" />
                  <span>Loading available repositories from GitHub...</span>
                </div>
              ) : availableRepos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.1] p-8 text-center">
                  <GitBranch className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No repositories available</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Ensure the Secura GitHub App is installed on your GitHub account with access to your repositories.
                  </p>
                  <a
                    href="https://github.com/apps/secura-security-scanner"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all mt-4"
                  >
                    <span>Grant Access on GitHub</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                (() => {
                  const filtered = availableRepos.filter(
                    (r) =>
                      r.fullName.toLowerCase().includes(availableSearch.toLowerCase()) ||
                      r.name.toLowerCase().includes(availableSearch.toLowerCase()) ||
                      r.owner.toLowerCase().includes(availableSearch.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="py-10 text-center text-xs text-slate-500">
                        No repositories matching &quot;{availableSearch}&quot;
                      </div>
                    );
                  }

                  return filtered.map((repo) => {
                    const isSelected = selectedFullNames.has(repo.fullName);
                    return (
                      <div
                        key={repo.fullName}
                        onClick={() => {
                          if (!repo.alreadyMonitored) {
                            toggleSelectRepo(repo.fullName);
                          }
                        }}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                          repo.alreadyMonitored
                            ? "border-white/[0.04] bg-white/[0.01] opacity-60 cursor-default"
                            : isSelected
                            ? "border-blue-500/50 bg-blue-600/15 cursor-pointer"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04] cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Checkbox */}
                          <div className="shrink-0 text-slate-400">
                            {repo.alreadyMonitored ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : isSelected ? (
                              <CheckSquare className="h-4 w-4 text-blue-400" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-500" />
                            )}
                          </div>

                          {/* Repo Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              {repo.isPrivate ? (
                                <Lock className="h-3 w-3 text-slate-500" />
                              ) : (
                                <Unlock className="h-3 w-3 text-slate-500" />
                              )}
                              <span className="font-semibold text-xs text-slate-200 truncate">
                                {repo.fullName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded bg-white/[0.04]">
                                {repo.defaultBranch}
                              </span>
                              {repo.isPrivate ? (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                  Private
                                </span>
                              ) : (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                                  Public
                                </span>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-[11px] text-slate-400 truncate max-w-md">
                                {repo.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action status */}
                        <div className="shrink-0">
                          {repo.alreadyMonitored ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                              <Check className="h-3 w-3" />
                              <span>Monitored</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleAddSingleAvailableRepo(repo);
                              }}
                              disabled={bulkAddLoading}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 shadow-sm"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-white/[0.08] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0a0e14]">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>
                  {selectedFullNames.size} {selectedFullNames.size === 1 ? "repository" : "repositories"} selected
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="text-xs text-blue-400 hover:underline"
                >
                  {showManualForm ? "Hide manual entry" : "Enter name manually"}
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-white/[0.08] text-xs font-medium text-slate-300 hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkAddSelected}
                  disabled={selectedFullNames.size === 0 || bulkAddLoading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all disabled:opacity-50"
                >
                  {bulkAddLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>Add Selected ({selectedFullNames.size})</span>
                </button>
              </div>
            </div>

            {/* Optional Manual Entry Drawer */}
            {showManualForm && (
              <form
                onSubmit={handleAddRepository}
                className="border-t border-white/[0.08] p-4 bg-[#0d1117] space-y-3"
              >
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Repository Full Name (owner/repo)
                    </label>
                    <input
                      type="text"
                      required
                      value={newRepoFullName}
                      onChange={(e) => setNewRepoFullName(e.target.value)}
                      placeholder="e.g. organization/repository"
                      className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Branch</label>
                    <input
                      type="text"
                      value={newRepoBranch}
                      onChange={(e) => setNewRepoBranch(e.target.value)}
                      placeholder="main"
                      className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRepoIsPrivate}
                      onChange={(e) => setNewRepoIsPrivate(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-blue-600"
                    />
                    <span>Private Repository</span>
                  </label>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                  >
                    {addLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span>Add Repository</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── Repositories Grid ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">
            {filterTab === "all"
              ? `All Repositories (${filteredRepos.length})`
              : filterTab === "monitored"
              ? `Monitored Repositories (${filteredRepos.length})`
              : `Paused Repositories (${filteredRepos.length})`}
          </h2>
          <button
            onClick={() => void handleRefresh()}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCcw className="h-3 w-3" />
            <span>Refresh</span>
          </button>
        </div>

        {filteredRepos.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <GitBranch className="h-8 w-8 text-slate-600 mx-auto mb-2.5" />
            <h3 className="text-sm font-semibold text-slate-300">No repositories found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add a repository manually above or install the Secura GitHub App to sync all your organization repos.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <button
                onClick={handleSync}
                disabled={syncLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 transition-all disabled:opacity-50"
              >
                {syncLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" />
                )}
                <span>Sync Allowed Repositories from GitHub</span>
              </button>
              <a
                href="https://github.com/apps/secura-security-scanner"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all"
              >
                <span>Configure on GitHub</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRepos.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                onToggleMonitoring={handleToggleMonitoring}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
