"use client";

import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import Link from "next/link";
import {
  ShieldCheck,
  Check,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

export default function SignupPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 overflow-hidden selection:bg-[#EDE9E6] selection:text-[#281C59]">
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(40,28,89,0.06),transparent_70%)] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-5 border-b border-slate-200/60 dark:border-zinc-850">
        <Link href="/" className="flex items-center gap-2.5 group">
          <img
            src="/logo.png"
            alt="Secura"
            className="h-8 w-8 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
          />
          <span className="text-base font-bold tracking-tight text-[#281C59] dark:text-white">
            Secura
          </span>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-[#281C59] dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Content: Split CodeRabbit-Style Layout */}
      <main className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex-1 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          {/* Left Column: Product Showcase & Benefits */}
          <div className="hidden lg:flex lg:col-span-6 flex-col space-y-6 pr-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#281C59] shadow-2xs w-fit">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Get Started in Under 2 Minutes</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Create your account & secure every pull request.
            </h1>

            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Install the Secura GitHub App to automate secret detection, enforce branch protection, and prevent credentials from reaching production.
            </p>

            {/* Feature List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 text-xs text-slate-700 dark:text-zinc-300">
                <div className="h-5 w-5 rounded-full bg-[#EDE9E6] text-[#281C59] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <span>
                  <strong>Instant GitHub App Integration:</strong> One click to install across personal or enterprise repos.
                </span>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-700 dark:text-zinc-300">
                <div className="h-5 w-5 rounded-full bg-[#EDE9E6] text-[#281C59] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <span>
                  <strong>Automated PR Reviews & Gate Checks:</strong> High-risk secrets fail merge checks automatically with remediation instructions.
                </span>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-700 dark:text-zinc-300">
                <div className="h-5 w-5 rounded-full bg-[#EDE9E6] text-[#281C59] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <span>
                  <strong>Zero-Retention Memory Engine:</strong> Your private code is never stored or trained on.
                </span>
              </div>
            </div>

            {/* Mini Bot Preview Card */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950 p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="Secura" className="h-6 w-6 rounded-lg object-cover" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">secura-bot</span>
                  <span className="text-[10px] font-mono bg-[#281C59] text-white px-1.5 rounded">READY</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Free Tier Available</span>
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                Supports unlimited public repositories and developer-friendly onboarding.
              </p>
            </div>
          </div>

          {/* Right Column: AuthCard */}
          <div className="lg:col-span-6 w-full flex justify-center">
            <Suspense fallback={<div className="text-xs text-slate-500 font-mono">Loading registration...</div>}>
              <AuthCard initialMode="signup" />
            </Suspense>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-slate-400 dark:text-zinc-500 border-t border-slate-200/60 dark:border-zinc-800">
        Secura Inc. © 2026 · Zero Code Retention · End-to-end Encrypted
      </footer>
    </div>
  );
}
