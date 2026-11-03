import {
  Finding,
  Repository,
  AvailableRepository,
  Scan,
  PullRequest,
  DashboardSummary,
  FindingOverTime,
  FindingBySeverity,
  FindingByRepository,
  Severity,
  FindingStatus,
  ScanStatus,
  ScanResult,
  User,
  AuthResponse,
} from "@/types";

const rawApiBase =
  typeof window !== "undefined"
    ? "/api"
    : process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
const API_BASE = rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase.replace(/\/+$/, "")}/api`;

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

function mapBackendFinding(f: Record<string, unknown>): Finding {
  return {
    id: String(f.id ?? ""),
    ruleId: String(f.rule_id || f.ruleId || ""),
    type: String(f.finding_type || f.type || "Security Finding"),
    severity: (f.severity as Severity) || "MEDIUM",
    status: (f.status as FindingStatus) || "open",
    repository: String(f.repository_name || f.repository || "Unknown Repository"),
    repositoryId: String(f.repository_id || f.repositoryId || ""),
    filePath: String(f.file_path || f.filePath || "unknown"),
    lineNumber: Number(f.line_number || f.lineNumber || 1),
    firstDetected: String(f.first_detected || f.firstDetected || new Date().toISOString()),
    lastDetected: String(f.last_detected || f.lastDetected || new Date().toISOString()),
    scanId: String(f.scan_id || f.scanId || ""),
    risk: f.risk ? String(f.risk) : "",
    recommendation: f.recommendation ? String(f.recommendation) : "",
    ignoreReason: f.ignore_reason ? String(f.ignore_reason) : (f.ignoreReason ? String(f.ignoreReason) : undefined),
  };
}

function mapBackendRepository(r: Record<string, unknown>): Repository {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    fullName: String(r.full_name || r.fullName || r.name || ""),
    owner: String(r.owner || "Organization"),
    defaultBranch: String(r.default_branch || r.defaultBranch || "main"),
    isPrivate: Boolean(r.is_private ?? r.isPrivate ?? false),
    lastScanAt: r.last_scan_at ? String(r.last_scan_at) : (r.lastScanAt ? String(r.lastScanAt) : null),
    lastScanStatus: (r.last_scan_status as ScanStatus) || (r.lastScanStatus as ScanStatus) || "clean",
    openFindings: Number(r.open_findings ?? r.openFindings ?? 0),
    criticalFindings: Number(r.critical_findings ?? r.criticalFindings ?? 0),
    highFindings: Number(r.high_findings ?? r.highFindings ?? 0),
    isMonitored: Boolean(r.is_monitored ?? r.isMonitored ?? true),
    htmlUrl: String(r.html_url || r.htmlUrl || `https://github.com/${r.full_name || r.name}`),
  };
}

function mapBackendScan(s: Record<string, unknown>): Scan {
  return {
    id: String(s.id ?? ""),
    repositoryId: String(s.repository_id || s.repositoryId || ""),
    repository: String(s.repository_name || s.repository || "Repository"),
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

function mapBackendPullRequest(p: Record<string, unknown>): PullRequest {
  return {
    id: String(p.id ?? ""),
    number: Number(p.number || 1),
    title: String(p.title || "Pull Request"),
    repository: String(p.repository_name || p.repository || "Repository"),
    repositoryId: String(p.repository_id || p.repositoryId || ""),
    branch: String(p.branch || "main"),
    baseBranch: String(p.base_branch || p.baseBranch || "main"),
    commitSha: String(p.commit_sha || p.commitSha || "HEAD"),
    author: String(p.author || "developer"),
    scanStatus: (p.scan_status as "pending" | "running" | "completed" | "failed") || (p.scanStatus as "pending" | "running" | "completed" | "failed") || "completed",
    checkRunStatus: (p.check_run_status as "success" | "failure" | "in_progress" | "neutral") || (p.checkRunStatus as "success" | "failure" | "in_progress" | "neutral") || "success",
    totalFindings: Number(p.total_findings ?? p.totalFindings ?? 0),
    criticalFindings: Number(p.critical_findings ?? p.criticalFindings ?? 0),
    highFindings: Number(p.high_findings ?? p.highFindings ?? 0),
    createdAt: String(p.created_at || p.createdAt || new Date().toISOString()),
    htmlUrl: String(p.html_url || p.htmlUrl || "https://github.com"),
  };
}

// ─── API Client Class ────────────────────────────────────────────────────────

class ApiClient {
  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
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
      return {
        summary: {
          connectedRepositories: data.summary.connected_repositories ?? 0,
          totalOpenFindings: data.summary.total_open_findings ?? 0,
          criticalFindings: data.summary.critical_findings ?? 0,
          highFindings: data.summary.high_findings ?? 0,
          resolvedFindings: data.summary.resolved_findings ?? 0,
          securityScore: data.summary.security_score ?? 100,
        },
        findingsOverTime: data.findings_over_time || [],
        findingsBySeverity: data.findings_by_severity || [],
        findingsByRepo: data.findings_by_repository || [],
        topFindingTypes: data.top_finding_types || [],
        securityScore: data.security_score ?? 100,
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

  async getRepositoryById(repositoryId: string): Promise<Repository | null> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/repositories/${repositoryId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return mapBackendRepository(data);
    } catch {
      return null;
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
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { repository: null, success: false, error: err.detail || "Failed to add repository" };
      }
      const data = await res.json();
      return { repository: mapBackendRepository(data), success: true };
    } catch {
      const parts = payload.fullName.includes("/") ? payload.fullName.split("/") : ["user", payload.fullName];
      const fallback: Repository = {
        id: "repo-" + Date.now(),
        name: parts[1],
        fullName: payload.fullName,
        owner: parts[0],
        defaultBranch: payload.defaultBranch || "main",
        isPrivate: payload.isPrivate || false,
        lastScanAt: null,
        lastScanStatus: "clean",
        openFindings: 0,
        criticalFindings: 0,
        highFindings: 0,
        isMonitored: payload.isMonitored ?? true,
        htmlUrl: `https://github.com/${payload.fullName}`,
      };
      return { repository: fallback, success: true };
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
    severity?: string;
    status?: string;
    search?: string;
  }): Promise<{ findings: Finding[]; isLive: boolean }> {
    try {
      const query = new URLSearchParams();
      if (params?.repositoryId) query.set("repository_id", params.repositoryId);
      if (params?.severity && params.severity !== "ALL") query.set("severity", params.severity);
      if (params?.status && params.status !== "ALL") query.set("status", params.status);
      if (params?.search) query.set("search", params.search);

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
  async getPullRequests(repositoryId?: string): Promise<{ pullRequests: PullRequest[]; isLive: boolean }> {
    try {
      const url = repositoryId
        ? `${API_BASE}/pull-requests?repository_id=${encodeURIComponent(repositoryId)}`
        : `${API_BASE}/pull-requests`;
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        return { pullRequests: data.map(mapBackendPullRequest), isLive: true };
      }
      return { pullRequests: [], isLive: false };
    } catch {
      return { pullRequests: [], isLive: false };
    }
  }

  async syncPullRequests(): Promise<{ pullRequests: PullRequest[]; success: boolean }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/pull-requests/sync`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        pullRequests: Array.isArray(data) ? data.map(mapBackendPullRequest) : [],
        success: true,
      };
    } catch {
      return { pullRequests: [], success: false };
    }
  }

  async scanPullRequest(repositoryId: string, pullNumber: number): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/pull-requests/${repositoryId}/${pullNumber}/scan`, {
        method: "POST",
      });
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

  setToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("secura_auth_token", token);
  }

  getStoredUser(): User | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("secura_auth_user");
    if (!raw) return null;
    try {
      const u = JSON.parse(raw) as User;
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
      return u;
    } catch {
      return null;
    }
  }

  setStoredUser(user: User): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("secura_auth_user", JSON.stringify(user));
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

  async login(email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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

  async register(email: string, password: string, name?: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await this.fetchWithTimeout(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
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
      const enrichedUser: User = {
        ...data.user,
        githubUsername: extraGithub?.username || data.user.github_username || data.user.githubUsername,
        githubProfileUrl: extraGithub?.profileUrl,
        githubReposCount: extraGithub?.reposCount,
      };
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
      const user = await res.json();
      this.setStoredUser(user);
      return user;
    } catch {
      return this.getStoredUser();
    }
  }
}

export const api = new ApiClient();
