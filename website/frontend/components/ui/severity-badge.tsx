import { cn } from "@/lib/utils";
import type { Severity } from "@/types";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; className: string }
> = {
  CRITICAL: {
    label: "Critical",
    className:
      "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  },
  HIGH: {
    label: "High",
    className:
      "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30",
  },
  MEDIUM: {
    label: "Medium",
    className:
      "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30",
  },
  LOW: {
    label: "Low",
    className:
      "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
  },
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
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

