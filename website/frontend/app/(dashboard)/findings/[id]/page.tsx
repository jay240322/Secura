"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { MOCK_FINDINGS } from "@/lib/mock-data";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Code,
  ExternalLink,
  FileText,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { Suspense } from "react";

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
  const finding = MOCK_FINDINGS.find((f) => f.id === params?.id);

  if (!finding) {
    notFound();
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
            <h2 className="text-lg font-semibold text-slate-100">
              {finding.type}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {finding.repository}
            </p>
          </div>
          <a
            href={`https://github.com/${finding.repository}/blob/main/${finding.filePath}#L${finding.lineNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 shrink-0 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on GitHub
          </a>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>
                <MapPin className="inline h-4 w-4 mr-1.5 text-slate-500" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm text-slate-300 bg-white/[0.03] rounded-lg px-4 py-3 border border-white/[0.06]">
                <span className="text-blue-400">{finding.filePath}</span>
                <span className="text-slate-500">:</span>
                <span className="text-yellow-400">{finding.lineNumber}</span>
              </div>
            </CardContent>
          </Card>

          {/* Code snippet (safe, redacted) */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Code className="inline h-4 w-4 mr-1.5 text-slate-500" />
                Code location
              </CardTitle>
              <span className="text-xs text-slate-500">
                Secret value is redacted
              </span>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-black/40 border border-white/[0.06] overflow-x-auto">
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
                  <span className="text-xs text-slate-500 font-mono">
                    {finding.filePath}
                  </span>
                </div>
                <pre className="text-xs font-mono p-4 text-slate-300">
                  <span className="text-slate-600">
                    {finding.lineNumber - 1 > 0
                      ? `${finding.lineNumber - 1}  ...\n`
                      : ""}
                  </span>
                  <span className="bg-red-500/10 -mx-4 px-4 block border-l-2 border-red-500/50">
                    {finding.lineNumber}{"  "}
                    <span className="text-slate-400">
                      {finding.type === "Database Connection String"
                        ? `DATABASE_URL = "`
                        : `${finding.type.replace(/\s+/g, "_").toUpperCase()} = "`}
                    </span>
                    <span className="bg-red-900/40 text-red-300 rounded px-1">
                      [REDACTED — secret value not stored]
                    </span>
                    <span className="text-slate-400">{`"`}</span>
                  </span>
                  <span className="text-slate-600">
                    {`${finding.lineNumber + 1}  ...`}
                  </span>
                </pre>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                ⚠ The actual secret value is never stored or displayed by Secura.
              </p>
            </CardContent>
          </Card>

          {/* Risk */}
          {finding.risk && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <ShieldAlert className="inline h-4 w-4 mr-1.5 text-red-400" />
                  Why this is dangerous
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
                <CardTitle>
                  <CheckCircle2 className="inline h-4 w-4 mr-1.5 text-emerald-400" />
                  How to fix it
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">
                  {finding.recommendation}
                </p>

                {/* Safe code example */}
                <div className="rounded-lg bg-black/40 border border-emerald-500/20 overflow-x-auto">
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
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600/20 border border-emerald-600/30 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as resolved
                  </button>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.04] transition-colors">
                    Ignore with reason
                  </button>
                </>
              )}
              {finding.status !== "open" && (
                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.04] transition-colors">
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
                  <dd className="text-slate-300 font-mono">{finding.scanId}</dd>
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

