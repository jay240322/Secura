import { cn } from "@/lib/utils";
import type { FindingStatus, ScanStatus } from "@/types";

interface StatusBadgeProps {
  status: FindingStatus | ScanStatus | string;
  className?: string;
  showDot?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; dotColor?: string }> = {
  // Finding statuses
  open: {
    label: "Open",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/40",
    dotColor: "bg-emerald-500",
  },
  merged: {
    label: "Merged",
    className: "bg-violet-50 text-violet-700 ring-1 ring-violet-600/20 dark:bg-violet-950/40 dark:text-violet-400 dark:ring-violet-800/40",
    dotColor: "bg-violet-500",
  },
  closed: {
    label: "Closed",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
    dotColor: "bg-slate-400",
  },
  resolved: {
    label: "Solved",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/40",
    dotColor: "bg-emerald-500",
  },
  solved: {
    label: "Solved",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/40",
    dotColor: "bg-emerald-500",
  },
  ignored: {
    label: "Ignored",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
    dotColor: "bg-slate-400",
  },
  // Scan / repo statuses
  clean: {
    label: "PRs Clean",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/40",
    dotColor: "bg-emerald-500",
  },
  failed: {
    label: "Blocked",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-800/40",
    dotColor: "bg-rose-500",
  },
  scanning: {
    label: "Checking PR",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-800/40",
    dotColor: "bg-blue-500 animate-pulse",
  },
  pending: {
    label: "Pending",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
    dotColor: "bg-slate-400",
  },
  never: {
    label: "Awaiting PR",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
    dotColor: "bg-slate-400",
  },
  passed: {
    label: "PR Passed",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/40",
    dotColor: "bg-emerald-500",
  },
  error: {
    label: "Error",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800/40",
    dotColor: "bg-amber-500",
  },
  // Check run statuses
  success: {
    label: "Passed",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/40",
    dotColor: "bg-emerald-500",
  },
  failure: {
    label: "Failed",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-800/40",
    dotColor: "bg-rose-500",
  },
  in_progress: {
    label: "In progress",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-800/40",
    dotColor: "bg-blue-500 animate-pulse",
  },
  neutral: {
    label: "Neutral",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
    dotColor: "bg-slate-400",
  },
  running: {
    label: "Running",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-800/40",
    dotColor: "bg-blue-500 animate-pulse",
  },
  completed: {
    label: "Completed",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
    dotColor: "bg-slate-400",
  },
  queued: {
    label: "Queued",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
    dotColor: "bg-slate-400",
  },
  action_required: {
    label: "Action Required",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800/40",
    dotColor: "bg-amber-500",
  },
};

export function StatusBadge({
  status,
  className,
  showDot = true,
}: StatusBadgeProps) {
  const normalized = (status || "never").toLowerCase();
  const config = STATUS_CONFIG[normalized] || {
    label: status || "Unknown",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
    dotColor: "bg-slate-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        config.className,
        className
      )}
    >
      {showDot && config.dotColor && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotColor)} />
      )}
      <span>{config.label}</span>
    </span>
  );
}
