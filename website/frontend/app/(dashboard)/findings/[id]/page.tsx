"use client";

import { useEffect, useState, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import type { Finding } from "@/types";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Code,
  FileText,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function FindingDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading finding details...</div>}>
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
    return <div className="p-8 text-slate-500">Loading finding details...</div>;
  }

  if (!finding) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <p className="text-sm text-slate-400">Finding not found or has been removed.</p>
        <Link
          href="/findings"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to findings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back nav */}
      <Link
        href="/findings"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
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
              <StatusBadge status={finding.status} />
              <span className="text-xs text-slate-500 font-mono">
                {finding.ruleId}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100">{finding.type}</h1>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-slate-300">
                {finding.filePath}:{finding.lineNumber}
              </span>
              <span>·</span>
              <span>{finding.repository}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-5 lg:col-span-2">
          {/* Location & redacted code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-4 w-4 text-blue-400" />
                Detected location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-white/[0.06] bg-[#080b0f] p-4 font-mono text-xs text-slate-400">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{finding.filePath}</span>
                </div>
                <div className="flex items-center gap-4 bg-red-950/20 -mx-4 px-4 py-1.5 border-l-2 border-red-500 text-slate-200">
                  <span className="text-slate-600 select-none w-6 text-right">
                    {finding.lineNumber}
                  </span>
                  <span className="text-red-300">
                    [REDACTED SECRET DETECTED ON LINE {finding.lineNumber}]
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-600">
                🔒 Detected credential values are redacted to prevent further exposure.
              </p>
            </CardContent>
          </Card>

          {/* Risk explanation */}
          {finding.risk && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-orange-400" />
                  Security risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {finding.risk}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Remediation */}
          {finding.recommendation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Remediation guidance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {finding.recommendation}
                </p>

                {/* Safe example */}
                <div className="rounded-lg border border-white/[0.06] bg-[#080b0f] overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
                    <span className="text-xs text-emerald-400">
                      ✓ Safe example
                    </span>
                  </div>
                  <pre className="text-xs font-mono p-4 text-slate-300">
                    {getSafeExample(finding.type)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ignored reason */}
          {finding.status === "ignored" && finding.ignoreReason && (
            <Card>
              <CardHeader>
                <CardTitle>Ignore reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400">{finding.ignoreReason}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {finding.status === "open" && (
                <>
                  <button
                    onClick={() => {
                      void handleStatusChange("resolved");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600/20 border border-emerald-600/30 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as resolved
                  </button>
                  <button
                    onClick={() => {
                      void handleStatusChange("ignored");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.04] transition-colors"
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
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.04] transition-colors"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Reopen finding
                </button>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="text-slate-500 mb-0.5">First detected</dt>
                  <dd className="text-slate-300">
                    {new Date(finding.firstDetected).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">Last seen</dt>
                  <dd className="text-slate-300">
                    {new Date(finding.lastDetected).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">Repository</dt>
                  <dd className="text-slate-300">{finding.repository}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">Scan ID</dt>
                  <dd className="text-slate-300 font-mono">{finding.scanId || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">Rule ID</dt>
                  <dd className="text-slate-300 font-mono">{finding.ruleId}</dd>
                </div>
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
