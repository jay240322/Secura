"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Repository, AvailableRepository, User } from "@/types";
import {
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
import Loader from "@/components/ui/loader";

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
  onRequestDelete,
}: {
  repo: Repository;
  onRequestDelete: (repo: Repository) => void;
}) {
  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 ${
        repo.isMonitored
          ? "border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shadow-xs dark:shadow-black/50 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md hover:-translate-y-0.5"
          : "border-slate-200/60 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/40 opacity-70 hover:opacity-100 hover:border-slate-300 dark:hover:border-zinc-700"
      }`}
    >
      {/* Top Header Row with Privacy Badge, Status Badge, and Shifted Actions (GitHub & Delete) */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {/* Privacy indicator */}
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
              {repo.isPrivate ? (
                <>
                  <Lock className="h-3 w-3 text-slate-500 dark:text-zinc-400" />
                  <span>Private</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3 text-slate-500 dark:text-zinc-400" />
                  <span>Public</span>
                </>
              )}
            </span>
          </div>

          {/* Shifted to upperside: GitHub Link & Delete Button */}
          <div className="flex items-center gap-1.5">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors shadow-xs"
              title="Open repository on GitHub"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              onClick={() => onRequestDelete(repo)}
              suppressHydrationWarning
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-900/60 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shadow-xs"
              title="Delete repository"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Repository Title */}
        <div className="mb-3">
          <Link
            href={`/repositories/${repo.id}`}
            className="text-base font-bold text-slate-900 dark:text-zinc-100 group-hover:text-[#281C59] dark:group-hover:text-blue-400 transition-colors truncate block mt-0.5 tracking-tight"
            title={repo.fullName}
          >
            {repo.name}
          </Link>

          {/* Branch & Scan Metadata */}
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-zinc-400 font-mono mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-slate-700 dark:text-zinc-300 font-medium">
              <GitBranch className="h-3 w-3 text-[#281C59] dark:text-blue-400" />
              <span>{repo.defaultBranch}</span>
            </span>
            <span className="text-slate-300 dark:text-zinc-700">·</span>
            <span suppressHydrationWarning className="flex items-center gap-1 text-slate-500 dark:text-zinc-400 text-[11px]">
              <Clock className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
              <span suppressHydrationWarning>
                {repo.lastScanAt ? `PR checked ${formatRelative(repo.lastScanAt)}` : "Awaiting first PR"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Action Controls & Navigation */}
      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80">
        <Link
          href={`/repositories/${repo.id}`}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-950 dark:hover:text-zinc-50 transition-all shadow-xs"
          title="Open repository details, pull requests, and findings"
        >
          <span>View Details</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function RepositoriesContent() {
  const searchParams = useSearchParams();
  const [installedBanner, setInstalledBanner] = useState(false);
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
        installationId: repo.installationId,
      });
      if (res.success && res.repository) {
        setRepos((prev) => [res.repository!, ...prev.filter((r) => r.fullName !== repo.fullName)]);
        setAvailableRepos((prev) =>
          prev.map((r) => (r.fullName === repo.fullName ? { ...r, alreadyMonitored: true } : r))
        );
        setSyncFeedback(`Added "${repo.fullName}" to Secura and synchronized with GitHub App!`);
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
        setSyncFeedback(`Added ${res.repositories.length} repositories to Secura and synchronized with GitHub App!`);
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

  const githubConfigureUrl = useMemo(() => {
    const withAppUrl = repos.find((r) => r.githubAppUrl && r.githubAppUrl.includes("installations/"));
    if (withAppUrl) return withAppUrl.githubAppUrl;
    return "https://github.com/apps/secura-security-scanner";
  }, [repos]);

  useEffect(() => {
    let mounted = true;
    const isInstalled = searchParams.get("installed") === "true";
    const instId = searchParams.get("installation_id");
    const setupAction = searchParams.get("setup_action");

    if (isInstalled || instId || setupAction) {
      setInstalledBanner(true);
    }

    async function loadRepos(isInitial = false) {
      try {
        const user = api.getStoredUser();
        if (user) setCurrentUser(user);

        // Always sync directly from GitHub App on initial load or tab focus so newly added repos appear immediately
        if (isInitial || isInstalled || instId || setupAction) {
          const syncRes = await api.syncRepositories();
          void api.syncPullRequests();
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

    // Auto-poll every 5 seconds to keep repository status updated
    const interval = setInterval(() => {
      void loadRepos(false);
    }, 5000);

    // When returning to this browser tab (e.g. after adding repos on GitHub), auto-sync instantly!
    const onWindowFocus = () => {
      void loadRepos(true);
    };
    window.addEventListener("focus", onWindowFocus);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, []);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleRefresh = async () => {
    setSyncLoading(true);
    try {
      const syncRes = await api.syncRepositories();
      if (syncRes.success && syncRes.repositories.length > 0) {
        setRepos(syncRes.repositories);
        setIsLive(true);
      } else {
        const res = await api.getRepositories();
        setRepos(res.repositories);
        setIsLive(res.isLive);
      }
    } catch (e) {
      console.error("Failed to refresh repos:", e);
    } finally {
      setSyncLoading(false);
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

  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleConfirmDelete = async () => {
    if (!repoToDelete) return;
    setDeleteLoading(true);
    const id = repoToDelete.id;
    setRepos((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.removeRepository(id);
      setRepoToDelete(null);
      setSyncFeedback(`Repository "${repoToDelete.fullName}" was removed from Secura.`);
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (e) {
      console.error("Failed to delete repo:", e);
      void handleRefresh();
    } finally {
      setDeleteLoading(false);
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
      {/* ─── GitHub App Connection Confirmation Alert ────────────────────── */}
      {installedBanner && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-emerald-900">
                GitHub App Installation Complete!
              </p>
              <p className="text-emerald-700 mt-0.5">
                Secura is linked to your GitHub account and has synced all granted repositories. Live pull request scanning & secret protection are active.
              </p>
            </div>
          </div>
          <button
            onClick={() => setInstalledBanner(false)}
            suppressHydrationWarning
            className="text-emerald-600 hover:text-emerald-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── Official GitHub App Integration Banner ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-[#EDE9E6]/40 dark:bg-zinc-950 p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EDE9E6] dark:bg-zinc-900 border border-[#EDE9E6] dark:border-zinc-800 text-[#281C59] dark:text-zinc-200 shadow-2xs">
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
              <h2 className="text-sm font-semibold text-[#281C59] dark:text-zinc-100">
                Secura GitHub Security Scanner
              </h2>
              <span className="rounded-full bg-[#EDE9E6] dark:bg-zinc-900 border border-[#EDE9E6] dark:border-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-[#281C59] dark:text-zinc-300">
                Official GitHub App
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Install the GitHub App to automatically block secret leaks and trigger PR security checks.
              {currentUser?.githubUsername && (
                <span className="text-[#281C59] dark:text-zinc-300 font-medium ml-1">
                  Connected to @{currentUser.githubUsername}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={githubConfigureUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#281C59] text-white px-4 py-2.5 text-xs font-semibold hover:bg-[#281C59]/90 shadow-xs transition-all"
          >
            <span>Configure on GitHub</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Sync Feedback Alert */}
      {syncFeedback && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#EDE9E6]/80 dark:border-zinc-800 dark:bg-zinc-900 px-4 py-3 text-xs text-[#281C59] dark:text-zinc-200 shadow-xs animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#281C59] dark:text-zinc-300" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* ─── Toolbar: Search, Filters & Add Repo ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search repositories by name or owner..."
            suppressHydrationWarning
            className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-[#281C59] focus:outline-none shadow-xs"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 rounded-xl bg-[#EDE9E6] dark:bg-zinc-900 border border-[#EDE9E6] dark:border-zinc-800">
            <button
              onClick={() => setFilterTab("all")}
              suppressHydrationWarning
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filterTab === "all"
                  ? "bg-white text-[#281C59] shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-[#281C59] dark:hover:text-zinc-100"
              }`}
            >
              All ({repos.length})
            </button>
            <button
              onClick={() => setFilterTab("monitored")}
              suppressHydrationWarning
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filterTab === "monitored"
                  ? "bg-white text-[#281C59] shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-[#281C59] dark:hover:text-zinc-100"
              }`}
            >
              Monitored ({monitoredCount})
            </button>
            <button
              onClick={() => setFilterTab("unmonitored")}
              suppressHydrationWarning
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filterTab === "unmonitored"
                  ? "bg-white text-[#281C59] shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-[#281C59] dark:hover:text-zinc-100"
              }`}
            >
              Paused ({repos.length - monitoredCount})
            </button>
          </div>

          <button
            onClick={handleOpenAddModal}
            suppressHydrationWarning
            className="flex items-center gap-1.5 rounded-xl bg-[#281C59] hover:bg-[#281C59]/90 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Repository</span>
          </button>
        </div>
      </div>

      {/* ─── GitHub App Repository Selector Modal ────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-900 dark:text-zinc-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 p-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400">
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Select Repositories to Monitor</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Select any repository from your GitHub account. It will be added to Secura and automatically selected in the GitHub App.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Search Toolbar */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={availableSearch}
                  onChange={(e) => setAvailableSearch(e.target.value)}
                  placeholder="Filter available repositories by name..."
                  suppressHydrationWarning
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none shadow-xs"
                />
              </div>
              <button
                onClick={loadAvailableRepos}
                disabled={availableLoading}
                suppressHydrationWarning
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-xs"
                title="Refresh repositories from GitHub"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${availableLoading ? "animate-spin" : ""}`} />
                <span>Reload</span>
              </button>
            </div>

            {/* Modal Error/Feedback Banner */}
            {addFeedback && (
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{addFeedback}</span>
              </div>
            )}

            {/* Modal Repositories List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {availableLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-zinc-400 text-xs gap-3">
                  <Loader />
                  <span>Loading available repositories from GitHub...</span>
                </div>
              ) : availableRepos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-8 text-center bg-slate-50/70 dark:bg-zinc-900/40 my-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 mb-3 shadow-xs">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    GitHub App Installation Required
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                    Repositories cannot be added directly without granting access through the official Secura GitHub App. Please install the GitHub App and select the repositories you wish to protect.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                    <a
                      href={githubConfigureUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all"
                    >
                      <span>Install GitHub App & Select Repos</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={loadAvailableRepos}
                      disabled={availableLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
                    >
                      <RefreshCcw className={`h-3.5 w-3.5 ${availableLoading ? "animate-spin" : ""}`} />
                      <span>Reload Repositories</span>
                    </button>
                  </div>
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
                      <div className="py-10 text-center text-xs text-slate-500 dark:text-zinc-400">
                        No repositories matching &quot;{availableSearch}&quot;
                      </div>
                    );
                  }

                  return filtered.map((repo) => {
                    const isSelected = selectedFullNames.has(repo.fullName);
                    return (
                      <div
                        key={repo.fullName}
                        role="button"
                        tabIndex={repo.alreadyMonitored ? -1 : 0}
                        onKeyDown={(e) => {
                          if (!repo.alreadyMonitored && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            toggleSelectRepo(repo.fullName);
                          }
                        }}
                        onClick={() => {
                          if (!repo.alreadyMonitored) {
                            toggleSelectRepo(repo.fullName);
                          }
                        }}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-all shadow-xs ${
                          repo.alreadyMonitored
                            ? "border-slate-200/50 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/30 opacity-60 cursor-default"
                            : isSelected
                            ? "border-blue-300 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-950/50 cursor-pointer"
                            : "border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50/70 dark:hover:bg-zinc-800 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Checkbox */}
                          <div className="shrink-0 text-slate-400 dark:text-zinc-500">
                            {repo.alreadyMonitored ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : isSelected ? (
                              <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                            )}
                          </div>

                          {/* Repo Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              {repo.isPrivate ? (
                                <Lock className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
                              ) : (
                                <Unlock className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
                              )}
                              <span className="font-semibold text-xs text-slate-900 dark:text-zinc-100 truncate">
                                {repo.fullName}
                              </span>
                              <span className="text-[10px] text-slate-600 dark:text-zinc-300 font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700">
                                {repo.defaultBranch}
                              </span>
                              {repo.isPrivate ? (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-medium border border-slate-200/80 dark:border-zinc-700">
                                  Private
                                </span>
                              ) : (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-900/40">
                                  Public
                                </span>
                              )}
                              {repo.inGithubApp ? (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  <span>In GitHub App</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                                  <ShieldCheck className="h-2.5 w-2.5" />
                                  <span>Auto-Selects in GitHub App</span>
                                </span>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-md">
                                {repo.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action status */}
                        <div className="shrink-0">
                          {repo.alreadyMonitored ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
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
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 shadow-xs"
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
            <div className="border-t border-slate-100 dark:border-zinc-800/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 dark:bg-zinc-900/60">
              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-400">
                <span>
                  {selectedFullNames.size} {selectedFullNames.size === 1 ? "repository" : "repositories"} selected
                </span>
                <a
                  href={githubConfigureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Grant more repositories on GitHub</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkAddSelected}
                  disabled={selectedFullNames.size === 0 || bulkAddLoading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-500 transition-all disabled:opacity-50"
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
          </div>
        </div>
      )}

      {/* ─── Repositories Grid Container ─────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-[#EDE9E6] dark:bg-zinc-950/60 p-5 sm:p-6 shadow-xs min-h-[calc(100vh-15rem)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#281C59] dark:text-zinc-200">
            {filterTab === "all"
              ? `All Repositories (${filteredRepos.length})`
              : filterTab === "monitored"
              ? `Monitored Repositories (${filteredRepos.length})`
              : `Paused Repositories (${filteredRepos.length})`}
          </h2>
          <button
            onClick={() => void handleRefresh()}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-[#281C59] dark:hover:text-zinc-200 transition-colors"
          >
            <RefreshCcw className="h-3 w-3" />
            <span>Refresh</span>
          </button>
        </div>

        {filteredRepos.length === 0 ? (
          <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 p-12 text-center shadow-xs my-auto">
            <GitBranch className="h-8 w-8 text-slate-400 dark:text-zinc-600 mx-auto mb-2.5" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">No repositories connected</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Install the Secura GitHub App on your GitHub account and select your repositories to enable automated pull request scanning and secret protection.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <a
                href={githubConfigureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#281C59] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#281C59]/90 transition-all"
              >
                <span>Install GitHub App & Select Repos</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
              >
                <Plus className="h-3 w-3" />
                <span>Add Repositories</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRepos.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                onRequestDelete={(r) => setRepoToDelete(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Delete Repository Confirmation Modal ────────────────────────── */}
      {repoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl space-y-4 text-slate-900 dark:text-zinc-100">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Delete Repository
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-800 dark:text-zinc-200 font-semibold">{repoToDelete.fullName}</strong>?
                  This will remove the repository container, pull request security monitoring, and all associated findings from Secura.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => setRepoToDelete(null)}
                suppressHydrationWarning
                className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                suppressHydrationWarning
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-500 transition-all disabled:opacity-50"
              >
                {deleteLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RepositoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader />
          <span className="text-xs">Loading repositories...</span>
        </div>
      }
    >
      <RepositoriesContent />
    </Suspense>
  );
}
