// ─── Severity ──────────────────────────────────────────────────────────────
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

// ─── Finding ───────────────────────────────────────────────────────────────
export type FindingStatus = "open" | "resolved" | "ignored" | "solved";

export interface Finding {
  id: string;
  ruleId: string;
  type: string;
  severity: Severity;
  status: FindingStatus;
  repository: string;
  repositoryId: string;
  filePath: string;
  lineNumber: number;
  firstDetected: string;
  lastDetected: string;
  scanId: string;
  risk?: string;
  recommendation?: string;
  ignoreReason?: string;
  commitSha?: string;
  detectedInCommit?: string;
  resolvedInCommit?: string;
  isResolved?: boolean;
  pullNumber?: number;
  branch?: string;
}

// ─── Repository ────────────────────────────────────────────────────────────
export type ScanStatus = "clean" | "failed" | "scanning" | "pending" | "never";

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  isPrivate: boolean;
  lastScanAt: string | null;
  lastScanStatus: ScanStatus;
  openFindings: number;
  criticalFindings: number;
  highFindings: number;
  score?: number;
  isMonitored: boolean;
  htmlUrl: string;
  githubRepoId?: number;
  githubInstallationId?: number;
  githubAppUrl?: string;
}

export interface AvailableRepository {
  githubRepoId?: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  description?: string;
  installationId?: number | string | null;
  alreadyMonitored: boolean;
  inGithubApp?: boolean;
}

// ─── Scan ──────────────────────────────────────────────────────────────────
export type ScanResult = "passed" | "failed" | "error";

export interface Scan {
  id: string;
  repositoryId: string;
  repository: string;
  branch: string;
  commitSha: string;
  status: "running" | "completed" | "failed";
  result: ScanResult | null;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  duration: number | null; // seconds
  score: number | null;
  createdAt: string;
  completedAt: string | null;
}

// ─── Pull Request ──────────────────────────────────────────────────────────
export interface PRCommit {
  sha: string;
  fullSha?: string;
  message: string;
  author: string;
  authorAvatar?: string | null;
  date?: string | null;
  htmlUrl?: string;
  scanResult?: "passed" | "failed" | "error" | null;
  scanStatus?: string;
  checkRunStatus?: "success" | "failure" | "in_progress" | "neutral";
  totalFindings?: number;
  criticalFindings?: number;
  highFindings?: number;
  score?: number;
  scanId?: string;
  findings?: PRFinding[];
  isHistorical?: boolean;
  isHead?: boolean;
  isResolved?: boolean;
  resolvesPriorViolations?: boolean;
  resolvedInCommit?: string;
}

export interface PRFinding {
  id: string;
  ruleId: string;
  findingType: string;
  severity: Severity;
  filePath: string;
  lineNumber: number;
  status?: string;
  risk?: string;
  recommendation?: string;
  commitSha?: string;
  scanId?: string;
  isResolved?: boolean;
  detectedInCommit?: string;
  resolvedInCommit?: string;
}

export interface PRScanRun {
  id: string;
  commitSha: string;
  fullCommitSha?: string;
  branch?: string;
  scanStatus: string;
  scanResult: "passed" | "failed" | "error" | null;
  checkRunStatus: "success" | "failure" | "in_progress" | "neutral";
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings?: number;
  lowFindings?: number;
  score?: number;
  createdAt?: string | null;
  findings: PRFinding[];
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  repository: string;
  repositoryId: string;
  branch: string;
  baseBranch: string;
  commitSha: string;
  author: string;
  state: "open" | "merged" | "closed";
  mergedAt?: string | null;
  closedAt?: string | null;
  scanStatus: "pending" | "running" | "completed" | "failed";
  checkRunStatus: "success" | "failure" | "in_progress" | "neutral";
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  score?: number;
  createdAt: string;
  htmlUrl: string;
  findings?: PRFinding[];
  commits?: PRCommit[];
  scanRuns?: PRScanRun[];
  historicalFindings?: PRFinding[];
  hasResolvedViolations?: boolean;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export interface DashboardSummary {
  connectedRepositories: number;
  totalOpenFindings: number;
  criticalFindings: number;
  highFindings: number;
  resolvedFindings: number;
  securityScore: number;
}

export interface FindingOverTime {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
}

export interface FindingBySeverity {
  severity: Severity;
  count: number;
}

export interface FindingByRepository {
  repository: string;
  total: number;
  critical: number;
  high: number;
}

// ─── Insight ───────────────────────────────────────────────────────────────
export interface InsightData {
  findingsOverTime: FindingOverTime[];
  findingsBySeverity: FindingBySeverity[];
  findingsByRepository: FindingByRepository[];
  topFindingTypes: { type: string; count: number }[];
  averageResolutionDays: number;
  securityScore: number;
  scoreHistory: { date: string; score: number }[];
}

// ─── User & Authentication ──────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  githubUsername?: string;
  githubProfileUrl?: string;
  githubReposCount?: number;
  provider?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: User;
}

