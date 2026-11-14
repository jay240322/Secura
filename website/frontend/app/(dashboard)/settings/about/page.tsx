"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Zap,
  Lock,
  GitPullRequest,
  CheckCircle2,
  Cpu,
  Layers,
  HeartHandshake,
  KeyRound,
  FileCode2,
} from "lucide-react";

export default function SettingsAboutPage() {
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
          Platform Info &bull; v1.0.0
        </span>
      </div>

      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-[#00285B] dark:text-blue-400 flex items-center justify-center font-bold">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">About Secura Security</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Autonomous Code & Repository Protection Platform</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
          Secura was engineered to replace slow, noisy security scanners with an autonomous, in-memory security engine that operates directly within your pull request workflow. We analyze every diff with surgical precision, enforce GitHub merge gates, and guarantee zero source code persistence.
        </p>
      </div>

      {/* 4 Core Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
            <Zap className="h-4 w-4 text-amber-500" />
            <span>In-Memory AST Parsing</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            Diffs are parsed into Abstract Syntax Trees in memory with sub-50ms latency. Comments, test fixtures, and mock files are automatically recognized to eliminate false alarms.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
            <Lock className="h-4 w-4 text-emerald-500" />
            <span>Zero Code Retention</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            Your proprietary source code is inspected ephemerally in-memory and immediately discarded. No code is ever written to disk or used for machine learning models.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
            <KeyRound className="h-4 w-4 text-blue-500" />
            <span>100+ Secret Signatures</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            Covers cloud providers (AWS, GCP, Azure), payment gateways (Stripe, PayPal, Square), AI providers (OpenAI, Anthropic), VCS tokens, and private RSA/SSH keys.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
            <GitPullRequest className="h-4 w-4 text-purple-500" />
            <span>Automated Merge Gates</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            Native GitHub Check Runs block PR merge buttons the millisecond a critical secret is introduced, and auto-unblock once the leak is rotated or removed.
          </p>
        </div>
      </div>

      {/* Compliance & Standards */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
          Security Governance & Standards
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs font-mono">
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
            <p className="font-bold text-slate-900 dark:text-white">OWASP A02</p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500">Cryptographic Failures</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
            <p className="font-bold text-slate-900 dark:text-white">CWE-798</p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500">Hard-coded Credentials</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
            <p className="font-bold text-slate-900 dark:text-white">SOC 2 Ready</p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500">Zero Disk Retention</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
            <p className="font-bold text-slate-900 dark:text-white">TLS 1.3</p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500">Encrypted In-Transit</p>
          </div>
        </div>
      </div>
    </div>
  );
}
