"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FolderGit2,
  GitPullRequest,
  GitMerge,
  X,
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { Repository, PullRequest } from "@/types";

export type SearchScope = "all" | "repos" | "prs";

export function GlobalSearchBar() {
  const router = useRouter();
  const [scope, setScope] = useState<SearchScope>("all");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load repositories and pull requests on first focus/interaction
  const loadSearchData = async () => {
    if (dataLoaded) return;
    setLoading(true);
    try {
      const [repoRes, prRes] = await Promise.all([
        api.getRepositories(),
        api.getPullRequests(),
      ]);
      setRepos(repoRes.repositories || []);
      setPullRequests(prRes.pullRequests || []);
      setDataLoaded(true);
    } catch (e) {
      console.warn("Failed to preload search data:", e);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        void loadSearchData();
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dataLoaded]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter Repositories based on query
  const filteredRepos = useMemo(() => {
    if (scope === "prs") return [];
    if (!query.trim()) {
      return repos.slice(0, 5); // Show recent 5 if query is empty
    }
    const q = query.toLowerCase().trim();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q)
    );
  }, [repos, query, scope]);

  // Filter Pull Requests based on query
  const filteredPRs = useMemo(() => {
    if (scope === "repos") return [];
    if (!query.trim()) {
      return pullRequests.slice(0, 5); // Show recent 5 if query is empty
    }
    const q = query.toLowerCase().trim();
    const cleanNum = q.replace(/^#/, "");
    return pullRequests.filter((pr) => {
      const matchNum = String(pr.number) === cleanNum || String(pr.number).includes(cleanNum);
      const matchTitle = pr.title.toLowerCase().includes(q);
      const matchRepo = pr.repository.toLowerCase().includes(q);
      const matchBranch = pr.branch.toLowerCase().includes(q);
      const matchAuthor = (pr.author || "").toLowerCase().includes(q);
      return matchNum || matchTitle || matchRepo || matchBranch || matchAuthor;
    });
  }, [pullRequests, query, scope]);

  const allItems = useMemo(() => {
    const items: Array<{ type: "repo" | "pr"; data: Repository | PullRequest }> = [];
    filteredRepos.forEach((r) => items.push({ type: "repo", data: r }));
    filteredPRs.forEach((p) => items.push({ type: "pr", data: p }));
    return items;
  }, [filteredRepos, filteredPRs]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, scope]);

  const handleSelect = (item: { type: "repo" | "pr"; data: Repository | PullRequest }) => {
    setIsOpen(false);
    setQuery("");
    if (item.type === "repo") {
      const repo = item.data as Repository;
      router.push(`/repositories/${repo.id}`);
    } else {
      const pr = item.data as PullRequest;
      const targetUrl = pr.repositoryId
        ? `/pull-requests?repo=${encodeURIComponent(pr.repositoryId)}&pr=${pr.number}`
        : `/pull-requests?pr=${pr.number}`;
      router.push(targetUrl);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < allItems.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allItems.length > 0 && selectedIndex < allItems.length) {
        handleSelect(allItems[selectedIndex]);
      }
    }
  };

  const placeholderText =
    scope === "repos"
      ? "Search repository name or owner..."
      : scope === "prs"
      ? "Search PR title, #number, branch..."
      : "Search repositories & pull requests...";

  return (
    <div ref={containerRef} className="relative hidden sm:block w-72 lg:w-96 mr-3">
      {/* Search Input Box with Scope Dropdown */}
      <div
        className={`flex items-center rounded-xl border bg-[#EDE9E6]/70 dark:bg-zinc-900/80 transition-all ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-zinc-900 shadow-md"
            : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
        }`}
      >
        {/* Scope Dropdown */}
        <div className="relative shrink-0 border-r border-slate-200/80 dark:border-zinc-800">
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as SearchScope);
              inputRef.current?.focus();
              setIsOpen(true);
              void loadSearchData();
            }}
            suppressHydrationWarning
            aria-label="Filter search type"
            className="appearance-none bg-transparent pl-2.5 pr-6 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white focus:outline-none cursor-pointer"
          >
            <option value="all">All</option>
            <option value="repos">Repos</option>
            <option value="prs">PRs</option>
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-zinc-500 pointer-events-none" />
        </div>

        {/* Input */}
        <div className="flex items-center flex-1 min-w-0 px-2 py-1.5 gap-2">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />
          ) : (
            <Search className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
              void loadSearchData();
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholderText}
            suppressHydrationWarning
            className="w-full bg-transparent text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none min-w-0"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5 rounded shrink-0"
              title="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-zinc-400 shadow-2xs shrink-0">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown Results Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md shadow-xl z-50 p-2 space-y-2 animate-fadeIn">
          {/* Active Filter Mode Pill Indicator */}
          <div className="flex items-center justify-between px-2 pt-1 pb-1 text-[11px] text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/80">
            <span>
              Searching:{" "}
              <strong className="text-slate-700 dark:text-zinc-300 capitalize">
                {scope === "all" ? "Repositories & PRs" : scope === "repos" ? "Repositories Only" : "Pull Requests Only"}
              </strong>
            </span>
            <span className="text-[10px]">Press Esc to close</span>
          </div>

          {/* Repositories Section */}
          {scope !== "prs" && filteredRepos.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <FolderGit2 className="h-3.5 w-3.5 text-blue-500" />
                <span>Repositories ({filteredRepos.length})</span>
              </div>
              <div className="space-y-0.5">
                {filteredRepos.map((repo, i) => {
                  const itemIndex = i;
                  const isSelected = selectedIndex === itemIndex;
                  return (
                    <button
                      key={repo.id}
                      onClick={() => handleSelect({ type: "repo", data: repo })}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100"
                          : "hover:bg-slate-100 dark:hover:bg-zinc-800/60 text-slate-800 dark:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderGit2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {repo.fullName || repo.name}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                            Branch: {repo.defaultBranch || "main"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {repo.isMonitored ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                            Monitored
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                            Inactive
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pull Requests Section */}
          {scope !== "repos" && filteredPRs.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <GitPullRequest className="h-3.5 w-3.5 text-purple-500" />
                <span>Pull Requests ({filteredPRs.length})</span>
              </div>
              <div className="space-y-0.5">
                {filteredPRs.map((pr, i) => {
                  const itemIndex = (scope === "all" ? filteredRepos.length : 0) + i;
                  const isSelected = selectedIndex === itemIndex;
                  const isMerged = (pr.state || "").toLowerCase() === "merged";
                  const isOpen = (pr.state || "open").toLowerCase() === "open";
                  return (
                    <button
                      key={pr.id}
                      onClick={() => handleSelect({ type: "pr", data: pr })}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-100"
                          : "hover:bg-slate-100 dark:hover:bg-zinc-800/60 text-slate-800 dark:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isMerged ? (
                          <GitMerge className="h-4 w-4 text-purple-500 shrink-0" />
                        ) : (
                          <GitPullRequest className="h-4 w-4 text-emerald-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            <span className="text-slate-400 dark:text-zinc-500 font-mono mr-1">
                              #{pr.number}
                            </span>
                            {pr.title}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                            {pr.repository} &bull; {pr.branch} &bull; by {pr.author || "author"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOpen ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                            Open
                          </span>
                        ) : isMerged ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900">
                            Merged
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                            Closed
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {allItems.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400">
              <Search className="h-6 w-6 mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
              <p className="font-medium">
                No {scope === "repos" ? "repositories" : scope === "prs" ? "pull requests" : "results"} found
              </p>
              {query && (
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Try searching with different keywords or switch the dropdown to &ldquo;All&rdquo;.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

