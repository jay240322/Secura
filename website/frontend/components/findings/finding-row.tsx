import Link from "next/link";
import { Check } from "lucide-react";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Finding } from "@/types";

export function FindingRow({
  finding,
  showRepo = false,
  showDate = false,
}: {
  finding: Finding;
  showRepo?: boolean;
  showDate?: boolean;
}) {
  const isResolved = finding.status === "resolved" || finding.status === "solved" || Boolean(finding.isResolved);
  const detectedSha = finding.detectedInCommit || (finding.commitSha ? finding.commitSha.slice(0, 7) : null);
  const resolvedSha = finding.resolvedInCommit;

  // Clean values to guarantee "Unknown" or "UNKNOWN" is never rendered
  let displayType = (finding.type || "").trim();
  let displayRule = (finding.ruleId || "").trim();
  const rawPath = (finding.filePath || (finding as any).file || "").trim();
  const rawStatus = (finding.status || "").toLowerCase().trim();
  const rawRepo = (finding.repository || "").trim();

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

  const displayPath = (!rawPath || rawPath.toLowerCase() === "unknown" || rawPath === "`unknown`")
    ? "source_file"
    : rawPath;
  const lineNo = finding.lineNumber || (finding as any).line || 1;
  const displayStatus = (!rawStatus || rawStatus === "unknown") ? "open" : finding.status;
  const displayRepo = (!rawRepo || rawRepo.toLowerCase() === "unknown") ? "" : rawRepo;

  return (
    <Link
      href={`/findings/${finding.id}`}
      className="group flex items-start gap-3.5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-zinc-900/60 -mx-2 px-3 rounded-xl transition-colors"
    >
      <SeverityBadge severity={finding.severity} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {displayType}
          </span>
          <StatusBadge status={isResolved ? "resolved" : displayStatus} />
          <span className="text-[10px] text-slate-600 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
            {displayRule}
          </span>
          {isResolved ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" />
              <span>Solved in commit {resolvedSha || "latest commit"}</span>
            </span>
          ) : detectedSha ? (
            <span className="text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/40">
              Commit {detectedSha}
            </span>
          ) : null}
          {finding.pullNumber && (
            <span className="text-[10px] font-mono font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900/40">
              PR #{finding.pullNumber}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
          {showRepo && displayRepo ? `${displayRepo} · ` : null}
          <span className="font-mono text-slate-700 dark:text-zinc-300">
            {displayPath}:{lineNo}
          </span>
        </p>
        {isResolved ? (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-mono mt-1">
            <Check className="h-3 w-3 shrink-0" />
            <span>
              Detected in commit <code className="font-bold text-rose-600 dark:text-rose-400">{detectedSha || "prior commit"}</code> → Solved in commit <code className="font-bold text-emerald-600 dark:text-emerald-400">{resolvedSha || "latest commit"}</code>
            </span>
          </p>
        ) : finding.recommendation ? (
          <p className="text-xs text-slate-600 dark:text-zinc-400 truncate mt-0.5">
            {finding.recommendation}
          </p>
        ) : null}
      </div>
      {showDate && finding.firstDetected && (
        <span className="text-xs text-slate-400 dark:text-zinc-500 self-center" suppressHydrationWarning>
          {new Date(finding.firstDetected).toLocaleDateString()}
        </span>
      )}
    </Link>
  );
}
