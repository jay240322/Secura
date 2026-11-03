import { cn } from "@/lib/utils";
import type { FindingStatus, ScanStatus } from "@/types";

// ─── Status Badge ──────────────────────────────────────────────────────────
interface StatusBadgeProps {
  status: FindingStatus | ScanStatus | string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Finding statuses
  open: {
    label: "Open",
    className: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  },
  ignored: {
    label: "Ignored",
    className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
  },
  // Scan / repo statuses
  clean: {
    label: "PRs Clean",
    className: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  },
  failed: {
    label: "Blocked",
    className: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  },
  scanning: {
    label: "Checking PR",
    className: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
  },
  pending: {
    label: "Pending",
    className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
  },
  never: {
    label: "Awaiting PR",
    className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
  },
  passed: {
    label: "PR Passed",
    className: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  },
  error: {
    label: "Error",
    className: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30",
  },
  // Check run
  success: {
    label: "Passed",
    className: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  },
  failure: {
    label: "Failed",
    className: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  },
  in_progress: {
    label: "In progress",
    className: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
  },
  neutral: {
    label: "Neutral",
    className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
  },
  running: {
    label: "Running",
    className: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
  },
  completed: {
    label: "Completed",
    className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

