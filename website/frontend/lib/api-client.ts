import {
  Finding,
  Repository,
  AvailableRepository,
  Scan,
  PullRequest,
  PRCommit,
  PRFinding,
  DashboardSummary,
  FindingOverTime,
  FindingBySeverity,
  FindingByRepository,
  Severity,
  FindingStatus,
  ScanStatus,
  ScanResult,
  User,
} from "@/types";

declare const process: any;

const rawApiBase =
  typeof window !== "undefined"
    ? "/api"
    : process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
const cleanBase = rawApiBase.endsWith("/") ? rawApiBase.slice(0, -1) : rawApiBase;
const API_BASE = cleanBase.endsWith("/api") ? cleanBase : `${cleanBase}/api`;

// ─── Clean Default Empty States ──────────────────────────────────────────────

export const DEFAULT_SUMMARY: DashboardSummary = {
  connectedRepositories: 0,
  totalOpenFindings: 0,
  criticalFindings: 0,
  highFindings: 0,
  resolvedFindings: 0,
  securityScore: 100,
};

// ─── Data Mappers (snake_case Backend -> camelCase Frontend) ─────────────────

const repoCache = new Map<string, Repository>();

function initRepoCache() {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("secura_cached_repos");
      if (stored) {
        const list: Repository[] = JSON.parse(stored);
        list.forEach((r) => {
          if (r.id) repoCache.set(r.id.toLowerCase(), r);
          if (r.name) repoCache.set(r.name.toLowerCase(), r);
          if (r.fullName) repoCache.set(r.fullName.toLowerCase(), r);
        });
      }
    } catch {}
  }
}
initRepoCache();

function registerRepoInCache(r: Repository) {
  if (!r) return;
  if (r.id) repoCache.set(r.id.toLowerCase(), r);
  if (r.name) repoCache.set(r.name.toLowerCase(), r);
  if (r.fullName) repoCache.set(r.fullName.toLowerCase(), r);
  if (typeof window !== "undefined") {
    try {
      const uniqueList = Array.from(new Set(Array.from(repoCache.values())));
      localStorage.setItem("secura_cached_repos", JSON.stringify(uniqueList));
    } catch {}
  }
}

export function cleanRepoDisplay(nameOrId?: unknown, fallbackRepoId?: unknown): string {
  const str = String(nameOrId || "").trim();
  const fId = String(fallbackRepoId || "").trim();

  if (!str || str.toLowerCase() === "unknown" || str.toLowerCase() === "undefined") {
    if (fId && repoCache.has(fId.toLowerCase())) {
      return repoCache.get(fId.toLowerCase())!.name;
    }
    return "Repository";
  }

  if (fId && repoCache.has(fId.toLowerCase())) {
    return repoCache.get(fId.toLowerCase())!.name;
  }
  if (str && repoCache.has(str.toLowerCase())) {
    return repoCache.get(str.toLowerCase())!.name;
  }

  const isIdLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ||
    str.startsWith("repo-") ||
    str.length >= 32;

  if (isIdLike) {
    if (str.startsWith("repo-")) {
      const parts = str.split("-");
      if (parts.length > 2) {
        return parts.slice(2).join("-");
      }
    }
    return "Repository";
  }

  if (str.includes("/")) {
    const parts = str.split("/");
    const lastPart = parts[parts.length - 1];
    if (lastPart) return lastPart;
  }

  return str || "Repository";
}

export interface SanitizedFindingDisplay {
  displayType: string;
  displayRule: string;
  displayPath: string;
  lineNo: number;
  displayStatus: FindingStatus;
  displayRepo: string;
}

export function sanitizeFindingDisplay(finding: {
  type?: unknown;
  ruleId?: unknown;
  filePath?: unknown;
  file?: unknown;
  status?: unknown;
  repository?: unknown;
  lineNumber?: unknown;
  line?: unknown;
}): SanitizedFindingDisplay {
  let displayType = String(finding.type || "").trim();
  let displayRule = String(finding.ruleId || "").trim();
  const rawPath = String(finding.filePath || finding.file || "").trim();
  const rawStatus = String(finding.status || "").toLowerCase().trim();
  const rawRepo = String(finding.repository || "").trim();

  if (!displayType || displayType.toLowerCase() === "unknown") {
    if (displayRule && displayRule.toLowerCase() !== "unknown") {
      displayType = displayRule
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    } else {
      displayType = "Hardcoded Secret";
    }
  }

  if (!displayRule || displayRule.toLowerCase() === "unknown") {
    displayRule = displayType.toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_");
  }

  const displayPath =
    !rawPath || rawPath.toLowerCase() === "unknown" || rawPath === "`unknown`"
      ? "source_file"
      : rawPath;
  const lineNo = Number(finding.lineNumber || finding.line || 1);
  const displayStatus: FindingStatus =
    rawStatus === "resolved" || rawStatus === "solved" || rawStatus === "ignored"
      ? (rawStatus as FindingStatus)
      : "open";
  const displayRepo = !rawRepo || rawRepo.toLowerCase() === "unknown" ? "" : rawRepo;

  return {
    displayType,
    displayRule,
    displayPath,
    lineNo,
    displayStatus,
    displayRepo,
  };
}

function mapBackendFinding(f: Record<string, unknown>): Finding {
  const repId = String(f.repository_id || f.repositoryId || "");
  const repName = cleanRepoDisplay(f.repository_name || f.repository, repId);

  const sanitized = sanitizeFindingDisplay({
    type: f.finding_type || f.type,
    ruleId: f.rule_id || f.ruleId,
    filePath: f.file_path || f.filePath,
    status: f.status,
    repository: repName,
    lineNumber: f.line_number || f.lineNumber,
  });

  return {
    id: String(f.id ?? ""),
    ruleId: sanitized.displayRule,
    type: sanitized.displayType,
    severity: (f.severity as Severity) || "MEDIUM",
    status: sanitized.displayStatus,
    repository: repName,
    repositoryId: repId,
    filePath: sanitized.displayPath,
    lineNumber: sanitized.lineNo,
    firstDetected: String(f.first_detected || f.firstDetected || new Date().toISOString()),
    lastDetected: String(f.last_detected || f.lastDetected || new Date().toISOString()),
    scanId: String(f.scan_id || f.scanId || ""),
    risk: f.risk ? String(f.risk) : "",
    recommendation: f.recommendation ? String(f.recommendation) : "",
    ignoreReason: f.ignore_reason ? String(f.ignore_reason) : (f.ignoreReason ? String(f.ignoreReason) : undefined),
    commitSha: f.commit_sha ? String(f.commit_sha) : (f.commitSha ? String(f.commitSha) : undefined),
    detectedInCommit: f.detected_in_commit ? String(f.detected_in_commit) : (f.detectedInCommit ? String(f.detectedInCommit) : (f.commit_sha ? String(f.commit_sha) : undefined)),
    resolvedInCommit: f.resolved_in_commit ? String(f.resolved_in_commit) : (f.resolvedInCommit ? String(f.resolvedInCommit) : undefined),
    isResolved: Boolean(f.is_resolved ?? f.isResolved ?? (sanitized.displayStatus === "resolved" || sanitized.displayStatus === "solved")),
    pullNumber: f.pull_number !== undefined && f.pull_number !== null ? Number(f.pull_number) : (f.pullNumber !== undefined && f.pullNumber !== null ? Number(f.pullNumber) : undefined),
    branch: f.branch ? String(f.branch) : undefined,
  };
}

function mapBackendRepository(r: Record<string, unknown>): Repository {
  const crit = Number(r.critical_findings_count ?? r.critical_findings ?? r.criticalFindings ?? 0);
  const high = Number(r.high_findings_count ?? r.high_findings ?? r.highFindings ?? 0);
  const openCount = Number(r.open_findings_count ?? r.open_findings ?? r.openFindings ?? (crit + high));
  const calculatedScore = r.score !== undefined
    ? Number(r.score)
    : Math.max(0, 100 - (crit * 30 + high * 20));

  const repoObj: Repository = {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    fullName: String(r.full_name || r.fullName || r.name || ""),
    owner: String(r.owner || "Organization"),
    defaultBranch: String(r.default_branch || r.defaultBranch || "main"),
    isPrivate: Boolean(r.is_private ?? r.isPrivate ?? false),
    lastScanAt: r.last_scan_at ? String(r.last_scan_at) : (r.lastScanAt ? String(r.lastScanAt) : null),
    lastScanStatus: (r.last_scan_status as ScanStatus) || (r.lastScanStatus as ScanStatus) || (crit > 0 || high > 0 ? "failed" : "clean"),
    openFindings: openCount,
    criticalFindings: crit,
    highFindings: high,
    score: calculatedScore,
    isMonitored: Boolean(r.is_monitored ?? r.isMonitored ?? true),
    htmlUrl: String(r.html_url || r.htmlUrl || `https://github.com/${r.full_name || r.name}`),
    githubInstallationId: r.github_installation_id ? Number(r.github_installation_id) : undefined,
    githubAppUrl: r.github_app_url ? String(r.github_app_url) : "https://github.com/apps/secura-security-scanner",
  };
  registerRepoInCache(repoObj);
  return repoObj;
}

function mapBackendScan(s: Record<string, unknown>): Scan {
  const repId = String(s.repository_id || s.repositoryId || "");
  const repName = cleanRepoDisplay(s.repository_name || s.repository, repId);

  return {
    id: String(s.id ?? ""),
    repositoryId: repId,
    repository: repName,
    branch: String(s.branch || "main"),
    commitSha: String(s.commit_sha || s.commitSha || "HEAD"),
    status: (s.scan_status as "running" | "completed" | "failed") || (s.status as "running" | "completed" | "failed") || "completed",
    result: (s.scan_result as ScanResult) || (s.result as ScanResult) || "passed",
    totalFindings: Number(s.total_findings ?? s.totalFindings ?? 0),
    criticalFindings: Number(s.critical_findings ?? s.criticalFindings ?? 0),
    highFindings: Number(s.high_findings ?? s.highFindings ?? 0),
    mediumFindings: Number(s.medium_findings ?? s.mediumFindings ?? 0),
    lowFindings: Number(s.low_findings ?? s.lowFindings ?? 0),
    duration: s.duration !== undefined && s.duration !== null ? Number(s.duration) : null,
    score: s.score !== undefined && s.score !== null ? Number(s.score) : 100,
    createdAt: String(s.created_at || s.createdAt || new Date().toISOString()),
    completedAt: s.completed_at ? String(s.completed_at) : (s.completedAt ? String(s.completedAt) : null),
  };
}

export function mapBackendUser(u: any): User {
  if (!u) return {} as User;
  let githubUser = u.github_username || u.githubUsername || undefined;
  const rawEmail = String(u.email || "");

  if (!githubUser && rawEmail.includes("@users.noreply.github.com")) {
    githubUser = rawEmail.split("@")[0].replace(/^@/, "");
  }
  if (githubUser) {
    githubUser = String(githubUser).replace(/^@/, "").split("@")[0].trim();
  }

  let rawName = u.name ? String(u.name).trim() : undefined;
  // If rawName contains @users.noreply.github.com or is identical to email, clean it up!
  if (rawName) {
    if (rawName.includes("@users.noreply.github.com")) {
      rawName = rawName.split("@")[0].replace(/^@/, "");
    } else if (rawName.includes("@") && (u.provider === "github" || githubUser)) {
      rawName = githubUser || rawName.split("@")[0];
    }
  }

  const cleanName = rawName || githubUser || (rawEmail.includes("@") ? rawEmail.split("@")[0] : undefined);

  const avatar =
    u.avatarUrl ||
    u.avatar_url ||
    u.photoURL ||
    (githubUser ? `https://github.com/${githubUser}.png` : undefined);

  const provider = u.provider
    ? String(u.provider).toLowerCase()
    : (githubUser || rawEmail.includes("github") ? "github" : rawEmail.includes("gmail") ? "google" : "local");

  return {
    id: String(u.id || ""),
    email: rawEmail,
    name: cleanName,
    avatarUrl: avatar,
    githubUsername: githubUser,
    githubProfileUrl:
      u.github_profile_url ||
      u.githubProfileUrl ||
      (githubUser ? `https://github.com/${githubUser}` : undefined),
    githubReposCount: u.github_repos_count ?? u.githubReposCount,
    provider,
    isActive: Boolean(u.is_active ?? u.isActive ?? true),
    createdAt: String(u.created_at || u.createdAt || new Date().toISOString()),
  };
}

function mapBackendFindingItem(f: any): PRFinding {
  const rule = String(f.rule_id || f.ruleId || "SECRET");
  const path = String(f.file_path || f.filePath || "");
  const line = Number(f.line_number || f.lineNumber || 1);
  const fid = f.id ? String(f.id) : `${rule}-${path}-${line}`;

  return {
    id: fid,
    ruleId: rule,
    findingType: String(f.finding_type || f.findingType || "Secret"),
    severity: (String(f.severity || "MEDIUM").toUpperCase()) as any,
    filePath: path,
    lineNumber: line,
    status: f.status ? String(f.status) : "open",
    risk: f.risk ? String(f.risk) : undefined,
    recommendation: f.recommendation ? String(f.recommendation) : undefined,
    commitSha: f.commit_sha ? String(f.commit_sha) : undefined,
    scanId: f.scan_id ? String(f.scan_id) : undefined,
    isResolved: Boolean(f.is_resolved || f.isResolved || f.status === "resolved"),
    detectedInCommit: f.detected_in_commit
      ? String(f.detected_in_commit)
      : f.detectedInCommit
      ? String(f.detectedInCommit)
      : f.commit_sha
      ? String(f.commit_sha).slice(0, 7)
      : undefined,
    resolvedInCommit: f.resolved_in_commit
      ? String(f.resolved_in_commit)
      : f.resolvedInCommit
      ? String(f.resolvedInCommit)
      : undefined,
  };
}

function mapBackendPRCommit(c: any): PRCommit {
  return {
    sha: String(c.sha || "HEAD"),
    fullSha: c.full_sha ? String(c.full_sha) : (c.sha ? String(c.sha) : undefined),
    message: String(c.message || "Commit update"),
    author: String(c.author || "developer"),
    authorAvatar: c.author_avatar ? String(c.author_avatar) : null,
    date: c.date ? String(c.date) : null,
    htmlUrl: c.html_url ? String(c.html_url) : undefined,
    scanResult: (c.scan_result as any) ?? null,
    scanStatus: c.scan_status ? String(c.scan_status) : undefined,
    checkRunStatus: (c.check_run_status as any) || (c.scan_result === "passed" ? "success" : (c.scan_result ? "failure" : "neutral")),
    totalFindings: Number(c.total_findings ?? 0),
    criticalFindings: Number(c.critical_findings ?? 0),
    highFindings: Number(c.high_findings ?? 0),
    score: c.score !== undefined ? Number(c.score) : undefined,
    scanId: c.scan_id ? String(c.scan_id) : undefined,
    findings: Array.isArray(c.findings) ? c.findings.map(mapBackendFindingItem) : [],
    isHistorical: Boolean(c.is_historical),
    isHead: Boolean(c.is_head ?? c.isHead),
    isResolved: Boolean(c.is_resolved ?? c.isResolved),
    resolvesPriorViolations: Boolean(c.resolves_prior_violations ?? c.resolvesPriorViolations),
    resolvedInCommit: c.resolved_in_commit ? String(c.resolved_in_commit) : (c.resolvedInCommit ? String(c.resolvedInCommit) : undefined),
  };
}

function mapBackendPullRequest(p: Record<string, unknown>): PullRequest {
  const findingsRaw = Array.isArray(p.findings) ? p.findings : [];
  const commitsRaw = Array.isArray(p.commits) ? p.commits : [];
  const scanRunsRaw = Array.isArray(p.scan_runs) ? p.scan_runs : [];
  const histFindingsRaw = Array.isArray(p.historical_findings) ? p.historical_findings : [];

  const repId = String(p.repository_id || p.repositoryId || "");
  const repName = cleanRepoDisplay(p.repository_name || p.repository, repId);

  const rawState = String(p.state || p.pr_state || (p.merged_at || p.mergedAt ? "merged" : (p.closed_at || p.closedAt ? "closed" : "open"))).toLowerCase();
  const prState: "open" | "merged" | "closed" = rawState === "merged" ? "merged" : (rawState === "closed" ? "closed" : "open");

  const totFind = Number(p.total_findings ?? p.totalFindings ?? 0);
  let resolvedScanStatus: "pending" | "running" | "completed" | "failed" =
    (p.scan_status as "pending" | "running" | "completed" | "failed") || (p.scanStatus as "pending" | "running" | "completed" | "failed") || "completed";
  let resolvedCheckRunStatus: "success" | "failure" | "in_progress" | "neutral" =
    (p.check_run_status as "success" | "failure" | "in_progress" | "neutral") ||
    (p.checkRunStatus as "success" | "failure" | "in_progress" | "neutral") ||
    (p.scan_result === "failed" || totFind > 0 ? "failure" : "success");

  if (prState === "merged" || prState === "closed") {
    if (resolvedScanStatus === "running" || resolvedScanStatus === "pending") {
      resolvedScanStatus = "completed";
    }
    if (resolvedCheckRunStatus === "in_progress") {
      resolvedCheckRunStatus = (p.scan_result === "failed" || totFind > 0) ? "failure" : "success";
    }
  }

  return {
    id: String(p.id ?? ""),
    number: Number(p.number || 1),
    title: String(p.title || "Pull Request"),
    repository: repName,
    repositoryId: repId,
    branch: String(p.branch || "main"),
    baseBranch: String(p.base_branch || p.baseBranch || "main"),
    commitSha: String(p.commit_sha || p.commitSha || "HEAD"),
    author: String(p.author || "developer"),
    state: prState,
    mergedAt: p.merged_at ? String(p.merged_at) : (p.mergedAt ? String(p.mergedAt) : null),
    closedAt: p.closed_at ? String(p.closed_at) : (p.closedAt ? String(p.closedAt) : null),
    scanStatus: resolvedScanStatus,
    checkRunStatus: resolvedCheckRunStatus,
    totalFindings: totFind,
    criticalFindings: Number(p.critical_findings ?? p.criticalFindings ?? 0),
    highFindings: Number(p.high_findings ?? p.highFindings ?? 0),
    score: (resolvedCheckRunStatus === "failure" || p.scan_result === "failed" || totFind > 0)
      ? (p.score !== undefined && p.score !== null && Number(p.score) < 100 ? Number(p.score) : 0)
      : (p.score !== undefined && p.score !== null ? Number(p.score) : 100),
    createdAt: String(p.created_at || p.createdAt || new Date().toISOString()),
    htmlUrl: String(p.html_url || p.htmlUrl || "https://github.com"),
    findings: findingsRaw.map(mapBackendFindingItem),
    commits: commitsRaw.map(mapBackendPRCommit),
    scanRuns: scanRunsRaw.map((r: any) => ({
      id: String(r.id || ""),
      commitSha: String(r.commit_sha || "HEAD"),
      fullCommitSha: r.full_commit_sha ? String(r.full_commit_sha) : undefined,
      branch: r.branch ? String(r.branch) : undefined,
      scanStatus: String(r.scan_status || "completed"),
      scanResult: (r.scan_result as any) ?? null,
      checkRunStatus: (r.check_run_status as any) || (r.scan_result === "passed" ? "success" : (r.scan_result ? "failure" : "neutral")),
      totalFindings: Number(r.total_findings ?? 0),
      criticalFindings: Number(r.critical_findings ?? 0),
      highFindings: Number(r.high_findings ?? 0),
      mediumFindings: Number(r.medium_findings ?? 0),
      lowFindings: Number(r.low_findings ?? 0),
      score: r.score !== undefined ? Number(r.score) : undefined,
      createdAt: r.created_at ? String(r.created_at) : null,
      findings: Array.isArray(r.findings) ? r.findings.map(mapBackendFindingItem) : [],
    })),
    historicalFindings: histFindingsRaw.map(mapBackendFindingItem),
    hasResolvedViolations: Boolean(p.has_resolved_violations),
  };
}

// ─── API Client Class ────────────────────────────────────────────────────────

class ApiClient {
  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers(options.headers || {});
    const token = this.getToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // ─── Insights & Overview ──────────────────────────────────────────────────
  async getInsights(): Promise<{
    summary: DashboardSummary;
    findingsOverTime: FindingOverTime[];
    findingsBySeverity: FindingBySeverity[];
    findingsByRepo: FindingByRepository[];
    topFindingTypes: { type: string; count: number }[];
    securityScore: number;
    isLive: boolean;
  }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/insights`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const summaryData = data?.summary || {};
      const secScore = typeof summaryData.security_score === "number"
        ? summaryData.security_score
        : (typeof data?.security_score === "number" ? data.security_score : 100);

      return {
        summary: {
          connectedRepositories: Number(summaryData.connected_repositories ?? summaryData.connectedRepositories ?? 0),
          totalOpenFindings: Number(summaryData.total_open_findings ?? summaryData.totalOpenFindings ?? 0),
          criticalFindings: Number(summaryData.critical_findings ?? summaryData.criticalFindings ?? 0),
          highFindings: Number(summaryData.high_findings ?? summaryData.highFindings ?? 0),
          resolvedFindings: Number(summaryData.resolved_findings ?? summaryData.resolvedFindings ?? 0),
          securityScore: secScore,
        },
        findingsOverTime: data.findings_over_time || [],
        findingsBySeverity: data.findings_by_severity || [],
        findingsByRepo: data.findings_by_repository || [],
        topFindingTypes: data.top_finding_types || [],
        securityScore: secScore,
        isLive: true,
      };
    } catch {
      return {
        summary: DEFAULT_SUMMARY,
        findingsOverTime: [],
        findingsBySeverity: [],
        findingsByRepo: [],
        topFindingTypes: [],
        securityScore: 100,
        isLive: false,
      };
    }
  }

  async getRepositories(): Promise<{ repositories: Repository[]; isLive: boolean }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        return { repositories: data.map(mapBackendRepository), isLive: true };
      }
      return { repositories: [], isLive: false };
    } catch {
      return { repositories: [], isLive: false };
    }
  }

  async syncRepositories(): Promise<{ success: boolean; repositories: Repository[]; error?: string }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories/sync`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, repositories: [], error: err.detail || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return {
        success: true,
        repositories: Array.isArray(data) ? data.map(mapBackendRepository) : [],
      };
    } catch {
      return { success: false, repositories: [], error: "Network error syncing repositories." };
    }
  }

  getCachedRepository(idOrName: string): Repository | null {
    if (!idOrName) return null;
    return repoCache.get(idOrName.toLowerCase()) || null;
  }

  async getRepositoryOverview(repositoryId: string): Promise<{
    repository: Repository | null;
    pullRequests: PullRequest[];
    findings: Finding[];
  } | null> {
    if (!repositoryId) return null;
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories/${encodeURIComponent(repositoryId)}/overview`, {}, 25000);
      if (!res.ok) return null;
      const data = await res.json();
      const repo = data.repository ? mapBackendRepository(data.repository) : null;
      if (repo) registerRepoInCache(repo);
      return {
        repository: repo,
        pullRequests: Array.isArray(data.pull_requests) ? data.pull_requests.map(mapBackendPullRequest) : [],
        findings: Array.isArray(data.findings) ? data.findings.map(mapBackendFinding) : [],
      };
    } catch {
      return null;
    }
  }

  async getRepositoryById(repositoryId: string): Promise<Repository | null> {
    if (!repositoryId) return null;
    const cached = this.getCachedRepository(repositoryId);
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories/${repositoryId}`);
      if (!res.ok) return cached;
      const data = await res.json();
      const mapped = mapBackendRepository(data);
      registerRepoInCache(mapped);
      return mapped;
    } catch {
      return cached;
    }
  }

  async getAvailableRepositories(): Promise<AvailableRepository[]> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories/available`);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map((r: any) => ({
        githubRepoId: r.github_repo_id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner,
        defaultBranch: r.default_branch || "main",
        isPrivate: Boolean(r.is_private),
        htmlUrl: r.html_url || `https://github.com/${r.full_name}`,
        description: r.description || undefined,
        installationId: r.installation_id,
        alreadyMonitored: Boolean(r.already_monitored),
        inGithubApp: Boolean(r.in_github_app),
      }));
    } catch {
      return [];
    }
  }

  async bulkAddRepositories(
    repos: {
      fullName: string;
      defaultBranch?: string;
      isPrivate?: boolean;
      githubRepoId?: number;
      htmlUrl?: string;
      installationId?: number | string | null;
    }[]
  ): Promise<{ success: boolean; repositories?: Repository[]; error?: string }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories/bulk-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositories: repos.map((r) => ({
            full_name: r.fullName,
            default_branch: r.defaultBranch || "main",
            is_private: Boolean(r.isPrivate),
            github_repo_id: r.githubRepoId,
            html_url: r.htmlUrl,
            installation_id: r.installationId,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.detail || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return {
        success: true,
        repositories: Array.isArray(data) ? data.map(mapBackendRepository) : [],
      };
    } catch {
      return { success: false, error: "Network error adding repositories." };
    }
  }

  async triggerScan(repositoryId: string): Promise<Scan | null> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories/${repositoryId}/scan`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return mapBackendScan(data);
    } catch (e) {
      console.error("Trigger scan failed:", e);
      return null;
    }
  }

  async toggleRepositoryMonitoring(repositoryId: string, isMonitored: boolean): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories/${repositoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_monitored: isMonitored }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async addRepository(payload: {
    fullName: string;
    defaultBranch?: string;
    isPrivate?: boolean;
    isMonitored?: boolean;
    htmlUrl?: string;
    githubRepoId?: number;
    installationId?: number | string | null;
  }): Promise<{ repository: Repository | null; success: boolean; error?: string }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: payload.fullName,
          default_branch: payload.defaultBranch || "main",
          is_private: payload.isPrivate || false,
          is_monitored: payload.isMonitored ?? true,
          html_url: payload.htmlUrl,
          github_repo_id: payload.githubRepoId,
          installation_id: payload.installationId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { repository: null, success: false, error: err.detail || "Failed to add repository" };
      }
      const data = await res.json();
      return { repository: mapBackendRepository(data), success: true };
    } catch {
      return { repository: null, success: false, error: "Network error adding repository." };
    }
  }

  async removeRepository(repositoryId: string): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories/${repositoryId}`, {
        method: "DELETE",
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── Findings ─────────────────────────────────────────────────────────────
  async getFindings(params?: {
    repositoryId?: string;
    repoName?: string;
    pullNumber?: number;
    severity?: string;
    status?: string;
    search?: string;
  }): Promise<{ findings: Finding[]; isLive: boolean }> {
    try {
      const query = new URLSearchParams();
      if (params?.repositoryId) query.set("repository_id", params.repositoryId);
      if (params?.repoName) query.set("repo_name", params.repoName);
      if (params?.pullNumber !== undefined && params?.pullNumber !== null) {
        query.set("pull_number", String(params.pullNumber));
      }
      if (params?.severity && params.severity !== "ALL") query.set("severity", params.severity);
      if (params?.status && params.status !== "ALL") query.set("status", params.status);
      if (params?.search) query.set("search", params.search);
      query.set("limit", "200");

      const res = await this.fetchWithTimeout(`${API_BASE}/findings?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        return { findings: data.map(mapBackendFinding), isLive: true };
      }
      return { findings: [], isLive: false };
    } catch {
      return { findings: [], isLive: false };
    }
  }

  async getFindingById(id: string): Promise<{ finding: Finding | null; isLive: boolean }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/findings/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { finding: mapBackendFinding(data), isLive: true };
    } catch {
      return { finding: null, isLive: false };
    }
  }

  async updateFindingStatus(
    id: string,
    status: "open" | "resolved" | "ignored",
    ignoreReason?: string
  ): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ignore_reason: ignoreReason }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── Scans ────────────────────────────────────────────────────────────────
  async getScans(): Promise<{ scans: Scan[]; isLive: boolean }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/scans`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        return { scans: data.map(mapBackendScan), isLive: true };
      }
      return { scans: [], isLive: false };
    } catch {
      return { scans: [], isLive: false };
    }
  }

  // ─── Pull Requests ────────────────────────────────────────────────────────
  async getPullRequests(repositoryId?: string, state?: string): Promise<{ pullRequests: PullRequest[]; isLive: boolean }> {
    try {
      const params = new URLSearchParams();
      if (repositoryId) params.set("repository_id", repositoryId);
      if (state && state !== "all") params.set("state", state);
      const qs = params.toString();
      const url = `${API_BASE}/pull-requests${qs ? `?${qs}` : ""}`;
      const res = await this.fetchWithTimeout(url, {}, 25000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        return { pullRequests: data.map(mapBackendPullRequest), isLive: true };
      }
      return { pullRequests: [], isLive: false };
    } catch (err) {
      console.warn("getPullRequests fetch error:", err);
      return { pullRequests: [], isLive: false };
    }
  }

  async syncPullRequests(repositoryId?: string): Promise<{ pullRequests: PullRequest[]; success: boolean }> {
    try {
      const url = repositoryId
        ? `${API_BASE}/pull-requests/sync?repository_id=${encodeURIComponent(repositoryId)}`
        : `${API_BASE}/pull-requests/sync`;
      const res = await this.fetchWithTimeout(url, { method: "POST" }, 30000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        pullRequests: Array.isArray(data) ? data.map(mapBackendPullRequest) : [],
        success: true,
      };
    } catch (err) {
      console.warn("syncPullRequests error:", err);
      return { pullRequests: [], success: false };
    }
  }

  async getPullRequestCommits(repositoryId: string, pullNumber: number): Promise<PRCommit[]> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/pull-requests/${repositoryId}/${pullNumber}/commits`);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map(mapBackendPRCommit);
    } catch {
      return [];
    }
  }

  async scanPullRequest(
    repositoryId: string,
    pullNumber: number,
    branch?: string,
    baseBranch?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const params = new URLSearchParams();
      if (branch) params.set("branch", branch);
      if (baseBranch) params.set("base_branch", baseBranch);
      const qs = params.toString();
      const res = await this.fetchWithTimeout(
        `${API_BASE}/pull-requests/${repositoryId}/${pullNumber}/scan${qs ? `?${qs}` : ""}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, message: data.message };
    } catch {
      return { success: false, message: "Network error triggering PR scan." };
    }
  }

  async updateProfile(name: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.detail || "Failed to update profile." };
      }
      const data = await res.json();
      const prev = this.getStoredUser() || ({} as User);
      const updated: User = {
        ...prev,
        name: data.name,
        id: data.id,
        email: data.email,
        avatarUrl: data.avatar_url || prev.avatarUrl,
        githubUsername: data.github_username || prev.githubUsername,
        provider: data.provider || prev.provider,
      };
      this.setStoredUser(updated);
      return { success: true, user: updated };
    } catch {
      return { success: false, error: "Network error updating profile." };
    }
  }

  // ─── Remediation Catalog ──────────────────────────────────────────────────
  async getRemediationCatalog(): Promise<Record<string, { risk: string; recommendation: string; example: string }>> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/findings/catalog/remediation`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {};
    }
  }

  // ─── Authentication & User Session ─────────────────────────────────────────
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("secura_auth_token");
  }

  setToken(val: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("secura_auth_token", val);
  }

  getStoredUser(): User | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("secura_auth_user");
    if (!raw) return null;
    try {
      const u = JSON.parse(raw);
      // Purge any stale mock accounts from previous sessions
      if (
        u.email === "developer@github.com" ||
        u.email === "developer@gmail.com" ||
        u.email === "developer@secura.security" ||
        u.email === "admin@secura.security" ||
        u.id?.startsWith("oauth-user-") ||
        u.id?.startsWith("firebase-")
      ) {
        this.clearAuth();
        return null;
      }
      return mapBackendUser(u);
    } catch {
      return null;
    }
  }

  setStoredUser(user: any): void {
    if (typeof window === "undefined") return;
    const mapped = mapBackendUser(user);
    localStorage.setItem("secura_auth_user", JSON.stringify(mapped));
  }

  clearAuth(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("secura_auth_token");
    localStorage.removeItem("secura_auth_user");
  }

  async getGitHubOAuthUrl(redirectUri?: string): Promise<string | null> {
    try {
      const redirect =
        redirectUri ||
        (typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : "http://localhost:3000/login");
      const res = await this.fetchWithTimeout(
        `${API_BASE}/auth/github/url?redirect_uri=${encodeURIComponent(redirect)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.url || null;
    } catch {
      return null;
    }
  }

  async completeGitHubOAuth(code: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/auth/github/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.detail || "GitHub authentication failed." };
      }
      this.setToken(data.access_token);
      this.setStoredUser(data.user);
      return { success: true, user: data.user };
    } catch {
      return { success: false, error: "Network error during GitHub authentication." };
    }
  }

  async login(email: string, userCred: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ["password"]: userCred }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.detail || "Authentication failed." };
      }
      this.setToken(data.access_token);
      this.setStoredUser(data.user);
      return { success: true, user: data.user };
    } catch {
      return { success: false, error: "Network error. Please verify the backend is running." };
    }
  }

  async register(email: string, userCred: string, name?: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ["password"]: userCred, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.detail || "Registration failed." };
      }
      this.setToken(data.access_token);
      this.setStoredUser(data.user);
      return { success: true, user: data.user };
    } catch {
      return { success: false, error: "Network error. Please verify the backend is running." };
    }
  }

  async oauthSignIn(
    provider: "github" | "google",
    email: string,
    name?: string,
    avatarUrl?: string,
    extraGithub?: { username?: string; profileUrl?: string; reposCount?: number }
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/auth/oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          email,
          name,
          avatar_url: avatarUrl,
          provider_id: extraGithub?.username,
        }),
      }, 15000);
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { detail: `Backend returned unexpected response (status ${res.status})` };
      }
      if (!res.ok) {
        return { success: false, error: data.detail || `OAuth login failed (${res.status}).` };
      }
      const rawUser = data.user || {};
      const enrichedUser: User = mapBackendUser({
        ...rawUser,
        name: name || rawUser.name,
        avatar_url: avatarUrl || rawUser.avatar_url,
        github_username: extraGithub?.username || rawUser.github_username || rawUser.githubUsername,
        github_profile_url: extraGithub?.profileUrl || rawUser.github_profile_url,
        github_repos_count: extraGithub?.reposCount ?? rawUser.github_repos_count,
        provider,
      });
      this.setToken(data.access_token);
      this.setStoredUser(enrichedUser);
      return { success: true, user: enrichedUser };
    } catch (e: any) {
      console.error("oauthSignIn fetch error:", e);
      if (e?.name === "AbortError") {
        return {
          success: false,
          error: "Backend request timed out. Please ensure the backend on port 8000 is active.",
        };
      }
      return {
        success: false,
        error:
          "Unable to sync with Secura backend at http://localhost:8000. Please ensure the backend server is running.",
      };
    }
  }

  async getMe(): Promise<User | null> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/auth/me`);
      if (!res.ok) {
        if (res.status === 401) {
          this.clearAuth();
          return null;
        }
        return this.getStoredUser();
      }
      const rawUser = await res.json();
      const mapped = mapBackendUser(rawUser);
      this.setStoredUser(mapped);
      return mapped;
    } catch {
      return this.getStoredUser();
    }
  }
}

export const api = new ApiClient();
