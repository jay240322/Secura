"use client";

import { useEffect, useState, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Loader } from "@/components/ui/loader";
import { api, sanitizeFindingDisplay } from "@/lib/api-client";
import type { Finding } from "@/types";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Code,
  FileText,
  MapPin,
  ShieldAlert,
  Check,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function FindingDetailPage() {
  return (
    <Suspense fallback={<div className="py-24 flex justify-center"><Loader size="md" /></div>}>
      <FindingDetailContent />
    </Suspense>
  );
}

function FindingDetailContent() {
  const params = useParams<{ id: string }>();
  const [finding, setFinding] = useState<Finding | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!params?.id) return;

    async function loadFinding() {
      try {
        const res = await api.getFindingById(params.id);
        if (mounted) {
          setFinding(res.finding);
        }
      } catch (e) {
        console.error("Failed to load finding:", e);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadFinding();
    return () => {
      mounted = false;
    };
  }, [params?.id]);

  const handleStatusChange = async (status: "open" | "resolved" | "ignored") => {
    if (!finding) return;
    try {
      await api.updateFindingStatus(finding.id, status);
      const res = await api.getFindingById(finding.id);
      setFinding(res.finding);
    } catch (e) {
      console.error("Status update error:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader size="md" />
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <p className="text-sm text-slate-600">Finding not found or has been removed.</p>
        <Link
          href="/findings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to findings
        </Link>
      </div>
    );
  }

  const { displayType, displayRule, displayPath, lineNo, displayStatus, displayRepo: rawCleanRepo } =
    sanitizeFindingDisplay(finding);
  const displayRepo = rawCleanRepo || "Repository";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back nav */}
      <Link
        href="/findings"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to findings
      </Link>

      {/* Header card */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <SeverityBadge severity={finding.severity} />
              <StatusBadge status={displayStatus} />
              <span className="text-xs text-slate-600 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                {displayRule}
              </span>
              {(finding.status === "resolved" || finding.isResolved) && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  <span>Solved in commit {finding.resolvedInCommit || "latest commit"}</span>
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">{displayType}</h1>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-zinc-500" />
              <span className="font-mono text-slate-700 dark:text-zinc-300 font-semibold">
                {displayPath}:{lineNo}
              </span>
              <span>·</span>
              <span className="text-slate-600 dark:text-zinc-400">{displayRepo}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Solved Banner */}
      {(finding.status === "resolved" || finding.isResolved) && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-3 shadow-2xs">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-slate-900 dark:text-white text-sm">
              Secret Solved & Verified Clean!
            </p>
            <p className="text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
              This secret was detected in commit{" "}
              <code className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded font-bold text-rose-700 dark:text-rose-400">
                {finding.detectedInCommit || (finding.commitSha ? finding.commitSha.slice(0, 7) : "prior commit")}
              </code>{" "}
              and successfully removed in commit{" "}
              <code className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded font-bold text-emerald-700 dark:text-emerald-300">
                {finding.resolvedInCommit || "latest commit"}
              </code>
              . Secura scanner verified that the violation has been completely eliminated.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-5 lg:col-span-2">
          {/* Location & redacted code */}
          <Card>
            <CardHeader className="border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-zinc-100 font-semibold">
                <Code className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                Detected location
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 p-4 font-mono text-xs text-slate-700 dark:text-zinc-300 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 mb-2">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{displayPath}</span>
                </div>
                <div className="flex items-center gap-4 bg-rose-50 dark:bg-rose-950/40 -mx-4 px-4 py-1.5 border-l-2 border-rose-500 text-slate-900 dark:text-zinc-100">
                  <span className="text-slate-400 dark:text-zinc-500 select-none w-6 text-right">
                    {lineNo}
                  </span>
                  <span className="text-rose-700 dark:text-rose-400 font-semibold">
                    [REDACTED SECRET DETECTED ON LINE {lineNo}]
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                🔒 Detected credential values are redacted to prevent further exposure.
              </p>
            </CardContent>
          </Card>

          {/* Risk explanation */}
          {finding.risk && (
            <Card>
              <CardHeader className="border-b border-slate-100 dark:border-zinc-800/80 pb-3">
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-zinc-100 font-semibold">
                  <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                  Security risk
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                  {finding.risk}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Remediation */}
          {finding.recommendation && (
            <Card>
              <CardHeader className="border-b border-slate-100 dark:border-zinc-800/80 pb-3">
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-zinc-100 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                  Remediation guidance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                  {finding.recommendation}
                </p>

                {/* Safe example */}
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 overflow-hidden shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 px-4 py-2 bg-slate-100/60 dark:bg-zinc-800/60">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      ✓ Safe example
                    </span>
                  </div>
                  <pre className="text-xs font-mono p-4 text-slate-800 dark:text-zinc-200 overflow-x-auto">
                    {getSafeExample(displayType)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ignored reason */}
          {finding.status === "ignored" && finding.ignoreReason && (
            <Card>
              <CardHeader className="border-b border-slate-100 dark:border-zinc-800/80 pb-3">
                <CardTitle className="text-slate-900 dark:text-zinc-100 font-semibold">Ignore reason</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <p className="text-sm text-slate-600 dark:text-zinc-400">{finding.ignoreReason}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <Card>
            <CardHeader className="border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              <CardTitle className="text-slate-900 dark:text-zinc-100 font-semibold">Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {finding.status === "open" && (
                <>
                  <button
                    onClick={() => {
                      void handleStatusChange("resolved");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as resolved
                  </button>
                  <button
                    onClick={() => {
                      void handleStatusChange("ignored");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors shadow-xs"
                  >
                    Ignore with reason
                  </button>
                </>
              )}
              {finding.status !== "open" && (
                <button
                  onClick={() => {
                    void handleStatusChange("open");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors shadow-xs"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Reopen finding
                </button>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              <CardTitle className="text-slate-900 dark:text-zinc-100 font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">First detected</dt>
                  <dd className="text-slate-800 dark:text-zinc-200 font-medium">
                    {new Date(finding.firstDetected).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Last seen</dt>
                  <dd className="text-slate-800 dark:text-zinc-200 font-medium">
                    {new Date(finding.lastDetected).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Repository</dt>
                  <dd className="text-slate-800 dark:text-zinc-200 font-medium">{displayRepo}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Scan ID</dt>
                  <dd className="text-slate-800 dark:text-zinc-200 font-mono font-medium">{finding.scanId || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Rule ID</dt>
                  <dd className="text-slate-800 dark:text-zinc-200 font-mono font-medium">{displayRule}</dd>
                </div>
                {(finding.detectedInCommit || finding.commitSha) && (
                  <div>
                    <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Detected in commit</dt>
                    <dd className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/40 inline-block">
                      {finding.detectedInCommit || (finding.commitSha ? finding.commitSha.slice(0, 7) : "—")}
                    </dd>
                  </div>
                )}
                {(finding.status === "resolved" || finding.isResolved) && (
                  <div>
                    <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Solved in commit</dt>
                    <dd className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/40 inline-block">
                      {finding.resolvedInCommit || "latest commit"}
                    </dd>
                  </div>
                )}
                {finding.pullNumber && (
                  <div>
                    <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Pull Request</dt>
                    <dd>
                      <Link
                        href={`/pull-requests?repo=${encodeURIComponent(finding.repository)}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-mono font-bold inline-flex items-center gap-1"
                      >
                        PR #{finding.pullNumber}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </dd>
                  </div>
                )}
                {finding.branch && (
                  <div>
                    <dt className="text-slate-500 dark:text-zinc-400 mb-0.5">Branch</dt>
                    <dd className="text-slate-800 dark:text-zinc-200 font-mono font-medium">{finding.branch}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function getSafeExample(findingType: string): string {
  const examples: Record<string, string> = {
    "AWS Access Key": `# ✓ Use IAM roles or environment variables
import boto3
import os

# Option 1: IAM Role (preferred in production)
client = boto3.client("s3")

# Option 2: Environment variable
access_key = os.environ["AWS_ACCESS_KEY_ID"]`,
    "Database Connection String": `# ✓ Load from environment variable
import os

DATABASE_URL = os.environ["DATABASE_URL"]

# Or use a secrets manager
from your_secrets_manager import get_secret
DATABASE_URL = get_secret("prod/database/url")`,
    "GitHub Personal Access Token": `# ✓ Use GitHub Actions secrets
# In workflow YAML:
#   env:
#     GH_TOKEN: \${{ secrets.GH_TOKEN }}

import os
token = os.environ["GH_TOKEN"]`,
    "SQL Injection": `# ✓ Use an ORM or safe query builder
stmt = select(User).where(User.email == user_email)
user = session.scalars(stmt).first()`,
    "Command Injection": `# ✓ Use subprocess with argument list
import subprocess
result = subprocess.run(
    ["ls", "-la", safe_directory],
    check=True,
    capture_output=True,
    shell=False,  # Never execute raw shell commands with input
)`,
    "SSL Verification Disabled": `# ✓ Enable TLS certificate verification
import requests
response = requests.get(
    "https://api.example.com",
    verify=True,  # Ensure TLS certificate verification is enabled
    timeout=10,
)`,
    default: `# ✓ Store secrets in environment variables
import os

API_KEY = os.environ["API_KEY"]  # Not hardcoded`,
  };
  return examples[findingType] ?? examples["default"];
}
