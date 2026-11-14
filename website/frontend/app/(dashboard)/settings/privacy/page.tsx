"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  EyeOff,
  Server,
  FileText,
  CheckCircle2,
} from "lucide-react";

export default function SettingsPrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Back to Settings Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Settings</span>
        </Link>
        <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
          Last updated: November 2026
        </span>
      </div>

      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Privacy & Zero Code Retention Policy</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Strict Data Protection Guarantees</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
          At Secura, privacy is built directly into our software architecture. We guarantee that your proprietary source code is inspected ephemerally in-memory, never saved to persistent disks, and never utilized for machine learning training.
        </p>
      </div>

      {/* Policy Articles */}
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">
              1
            </span>
            <span>Zero Code Persistence Policy</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            When GitHub triggers a webhook for an open pull request, Secura fetches only the patch diff file in-memory. The diff is parsed via AST trees, inspected against entropy signatures, and immediately discarded from RAM once the GitHub Check Run status is returned.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 text-[11px] text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>No Disk Caching</span>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 text-[11px] text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>No AI Model Training</span>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 text-[11px] text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>In-Memory RAM Diffs</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">
              2
            </span>
            <span>What Metadata We Store</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            Secura stores minimal structural metadata required to render your security dashboard and enforce policies:
          </p>
          <ul className="text-xs text-slate-600 dark:text-zinc-400 space-y-1.5 list-disc pl-5">
            <li>Repository name, owner, and GitHub installation identifiers.</li>
            <li>Pull request numbers, commit SHA hashes, and author handles.</li>
            <li>Finding metadata: category type (e.g., Stripe Key), filename, line number, and severity level.</li>
            <li>Redacted secret preview masks (e.g., <code className="font-mono text-slate-800 dark:text-zinc-300">sk_live_51M0...92K8</code>). Raw plaintext credentials are never stored.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-xs font-bold text-blue-600 dark:text-blue-400">
              3
            </span>
            <span>Encryption & Transport Security</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            All API communications between GitHub, your browser, and the Secura service are encrypted with TLS 1.3 in-transit. Access tokens are generated with high-entropy HMAC-SHA256 signatures with automated session expiration.
          </p>
        </div>
      </div>
    </div>
  );
}

