import type { PullRequest, PRCommit, PRFinding } from "@/types";

/**
 * Compare two pull requests by number (descending or ascending) with creation date tie-breaker.
 */
export function comparePullRequests(
  a: PullRequest,
  b: PullRequest,
  sortOrder: "asc" | "desc" = "desc"
): number {
  const numA = typeof a.number === "number" ? a.number : Number.parseInt(String(a.number), 10) || 0;
  const numB = typeof b.number === "number" ? b.number : Number.parseInt(String(b.number), 10) || 0;

  if (sortOrder === "desc") {
    if (numB !== numA) return numB - numA;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  } else {
    if (numA !== numB) return numA - numB;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  }
}

/**
 * Enrich refreshed commits and reconcile resolved security findings across commits.
 */
export function enrichPRWithRefreshedCommits(
  pr: PullRequest | undefined | null,
  commits: PRCommit[]
): {
  enrichedCommits: PRCommit[];
  resolvedFindings: PRFinding[];
  hasResolved: boolean;
} {
  const resolvedFindings: PRFinding[] = [];
  const seenKeys = new Set<string>();

  // 1. Retain existing historical findings
  for (const hf of pr?.historicalFindings || []) {
    const k = `${hf.filePath}:${hf.lineNumber}:${hf.ruleId}`;
    if (!seenKeys.has(k)) {
      seenKeys.add(k);
      resolvedFindings.push(hf);
    }
  }

  // 2. Discover and enrich from refreshed commits
  for (const c of commits) {
    if (c.findings && c.findings.length > 0 && (c.isResolved || (!c.isHead && c.scanResult === "failed"))) {
      for (const f of c.findings) {
        const k = `${f.filePath}:${f.lineNumber}:${f.ruleId}`;
        if (!seenKeys.has(k)) {
          seenKeys.add(k);
          resolvedFindings.push({
            ...f,
            isResolved: true,
            status: "resolved",
            detectedInCommit: f.detectedInCommit || c.sha,
            resolvedInCommit: f.resolvedInCommit || (pr?.commitSha ? pr.commitSha.slice(0, 7) : "HEAD"),
          });
        }
      }
    }
  }

  // 3. Backfill matching findings for commits marked failed/resolved with empty findings
  const enrichedCommits = commits.map((c) => {
    if ((!c.findings || c.findings.length === 0) && (c.isResolved || (!c.isHead && c.scanResult === "failed"))) {
      const matched = resolvedFindings.filter(
        (rf) =>
          rf.detectedInCommit === c.sha ||
          (c.fullSha && rf.detectedInCommit && c.fullSha.startsWith(rf.detectedInCommit)) ||
          (c.sha && rf.detectedInCommit && rf.detectedInCommit.startsWith(c.sha))
      );
      if (matched.length > 0) {
        return { ...c, findings: matched, isResolved: true };
      }
      if (resolvedFindings.length > 0 && commits.filter((x) => x.scanResult === "failed" || x.isResolved).length <= 1) {
        return { ...c, findings: resolvedFindings, isResolved: true };
      }
    }
    return c;
  });

  const hasResolved = (pr?.hasResolvedViolations) || resolvedFindings.length > 0;

  return {
    enrichedCommits,
    resolvedFindings,
    hasResolved,
  };
}
