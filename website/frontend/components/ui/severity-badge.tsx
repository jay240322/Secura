import { cn } from "@/lib/utils";
import type { Severity } from "@/types";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
  showDot?: boolean;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; className: string; dotColor: string }
> = {
  CRITICAL: {
    label: "Critical",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-800/40",
    dotColor: "bg-rose-500",
  },
  HIGH: {
    label: "High",
    className: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-800/40",
    dotColor: "bg-orange-500",
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800/40",
    dotColor: "bg-amber-500",
  },
  LOW: {
    label: "Low",
    className: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-800/40",
    dotColor: "bg-sky-500",
  },
};

export function SeverityBadge({ severity, className, showDot = true }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.LOW;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        config.className,
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotColor)} />
      )}
      <span>{config.label}</span>
    </span>
  );
}
