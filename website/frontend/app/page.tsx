"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useTheme } from "@/components/theme-provider";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Lock,
  Zap,
  GitBranch,
  GitPullRequest,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Terminal,
  EyeOff,
  Cpu,
  Layers,
  Code2,
  FileCode,
  AlertTriangle,
} from "lucide-react";

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function LandingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const token = api.getToken();
    const user = api.getStoredUser();
    setIsAuthenticated(Boolean(token && user));

    // Handle GitHub App redirect directly
    const installationId = searchParams.get("installation_id");
    const setupAction = searchParams.get("setup_action");

    if (installationId || setupAction) {
      if (token && user) {
        void api.syncRepositories().then(() => {
          router.push(
            `/repositories?installed=true${
              installationId ? `&installation_id=${installationId}` : ""
            }`
          );
        });
      } else {
        if (installationId) {
          try {
            sessionStorage.setItem("secura_pending_installation_id", installationId);
          } catch {}
        }
        router.push("/login?app_installed=true");
      }
    }
  }, [router, searchParams]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const FAQS = [
    {
      q: "Does Secura store or retain our source code?",
      a: "No. Secura operates under a strict Zero Code Retention policy. Pull request diffs are inspected in-memory through the GitHub Checks API and immediately discarded. Your source code is never cached, persistently stored on disks, or used to train machine learning models.",
    },
    {
      q: "How does the Security Gate prevent unsafe pull request merges?",
      a: "Secura registers as an official GitHub Check Run on your repositories. When a PR is opened or updated, Secura scans every modified line in milliseconds. If critical secrets (e.g. AWS access keys, Stripe private tokens, database credentials) violate your policy, the Secura Check reports a failure status, automatically locking GitHub's merge button.",
    },
    {
      q: "How long does setup take?",
      a: "Under 30 seconds. Click 'Configure on GitHub' or 'Install Secura App', choose the repositories you want monitored, and you are done. There is zero CI/CD YAML configuration, no Docker daemon setup, and no custom runner required.",
    },
    {
      q: "Can I customize the security gate threshold per repository?",
      a: "Yes. From your Secura Settings and Repository Config tabs, you can set the maximum allowable critical and high severity findings, define allowed test mocks or staging fixtures, and adjust repository health scores.",
    },
    {
      q: "What types of secrets and credentials does Secura detect?",
      a: "Secura detects over 100+ categories of secrets including AWS Access Keys, Google Cloud Service Account JSONs, Stripe Secret Keys, OpenAI API Keys, GitHub Personal Access Tokens, Slack Webhooks, Database connection strings (PostgreSQL, MySQL, MongoDB), Private RSA/SSH keys, and high-entropy API tokens.",
    },
    {
      q: "Is Secura free for individual developers and open-source?",
      a: "Yes! Secura provides a generous free tier for developers, open-source projects, and small engineering teams with unlimited PR scans across public and private GitHub repositories.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 selection:bg-[#EDE9E6] selection:text-[#281C59] transition-colors duration-200">
      {/* ─── 1. NAVBAR ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="Secura Owl Logo"
              className="h-8 w-8 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
            />
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-[#281C59] dark:text-white">
                Secura
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-800 dark:text-zinc-400 font-semibold">
                AI Gate
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-600 dark:text-zinc-400">
            <a href="#features" className="hover:text-[#281C59] dark:hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#281C59] dark:hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#security" className="hover:text-[#281C59] dark:hover:text-white transition-colors">
              Zero Retention
            </a>
            <a href="#demo" className="hover:text-[#281C59] dark:hover:text-white transition-colors">
              Interactive Demo
            </a>
            <a href="#faq" className="hover:text-[#281C59] dark:hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              suppressHydrationWarning
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-[#EDE9E6] dark:hover:bg-zinc-800 transition-colors shadow-2xs"
              title={theme === "dark" ? "Switch to Minimal Light" : "Switch to Pure Darkness"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-[#281C59]" />
              )}
            </button>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-xl bg-[#281C59] hover:bg-[#281C59]/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all"
              >
                <span>Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="flex items-center gap-1.5 rounded-xl bg-[#281C59] hover:bg-[#281C59]/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all"
                >
                  <GithubIcon className="h-3.5 w-3.5" />
                  <span>Get Started</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── 2. HERO SECTION ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Ambient Radial Gradient Mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(40,28,89,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(59,130,246,0.1),transparent_70%)] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center relative z-10">
          {/* Announcement Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 px-3.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-300 shadow-2xs mb-6 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-[#281C59] dark:text-zinc-100">Secura 2.0</span>
            <span className="text-slate-400 dark:text-zinc-600">·</span>
            <span>Autonomous Pull Request Security & Merge Gates</span>
            <ArrowRight className="h-3 w-3 text-slate-400" />
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-6">
            Cut Code Review Time.{" "}
            <span className="block text-[#281C59] dark:text-blue-400 mt-1">
              Stop Secret Leaks Before Merge.
            </span>
          </h1>

          {/* Subheading */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-zinc-400 leading-relaxed mb-8">
            Secura connects to your GitHub repositories in seconds to inspect pull requests for exposed credentials, API keys, private certificates, and insecure dependencies — blocking leaks with zero false alarms.
          </p>

          {/* Primary Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10">
            <Link
              href="/signup"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl bg-[#281C59] hover:bg-[#281C59]/90 text-white px-6 py-3.5 text-sm font-semibold shadow-md shadow-[#281C59]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <GithubIcon className="h-4 w-4" />
              <span>Start Free with GitHub</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href="#demo"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-[#EDE9E6] dark:hover:bg-zinc-800 hover:text-[#281C59] dark:hover:text-white transition-all shadow-2xs"
            >
              <Terminal className="h-4 w-4 text-[#281C59] dark:text-zinc-400" />
              <span>See Live PR Review</span>
            </a>
          </div>

          {/* Trust bullet reassurance */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Free for public & private repos
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Zero code retention
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              30-second 1-click install
            </span>
          </div>
        </div>

        {/* ─── 3. INTERACTIVE CODERABBIT-STYLE PR REVIEW MOCK ────────────── */}
        <div id="demo" className="max-w-5xl mx-auto px-4 sm:px-8 mt-14 sm:mt-18">
          <div className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-[#EDE9E6] dark:bg-zinc-950 p-3 sm:p-5 shadow-2xl shadow-slate-900/10 dark:shadow-black/70">
            {/* GitHub Pull Request Mock Frame */}
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs">
              {/* Window Title Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 px-4 py-3 bg-slate-50/70 dark:bg-zinc-900/60">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                    <GithubIcon className="h-3.5 w-3.5" />
                    <span>secura-demo / pull / 148</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 text-[11px] font-semibold">
                    <ShieldAlert className="h-3 w-3" />
                    <span>Merge Blocked</span>
                  </span>
                </div>
              </div>

              {/* PR Header Info */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                      <GitPullRequest className="h-3 w-3" />
                      <span>Open</span>
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      feat(auth): integrate Stripe Live API & production database
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">#148</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    target: <code className="text-[#281C59] dark:text-blue-400 font-semibold">main</code> ← branch: <code>feature/stripe-billing</code>
                  </span>
                </div>
              </div>

              {/* Secura Bot Review Comment Box */}
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <img
                    src="/logo.png"
                    alt="Secura Bot"
                    className="h-10 w-10 rounded-xl object-cover ring-2 ring-[#281C59]/20 shrink-0"
                  />
                  <div className="flex-1 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          secura-bot
                        </span>
                        <span className="text-[10px] font-mono rounded bg-[#281C59] text-white px-1.5 py-0.2">
                          BOT
                        </span>
                        <span className="text-[11px] text-slate-500">reviewed 2 minutes ago</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Security Gate Failure (1 Critical Secret)</span>
                      </span>
                    </div>

                    {/* Diff Preview with Caught Secret */}
                    <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto p-3.5 space-y-1">
                      <div className="text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                        @@ src/config/stripe.ts:14,7 @@
                      </div>
                      <div className="text-slate-400">  export const stripeConfig = &#123;</div>
                      <div className="bg-rose-950/80 text-rose-300 px-1.5 py-0.5 rounded -mx-1 flex items-center justify-between">
                        <span>-   secretKey: &quot;sk_live_51M0...92K8jA0&quot;,</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider bg-rose-600 text-white px-1.5 py-0.5 rounded">
                          Leaked Secret
                        </span>
                      </div>
                      <div className="bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded -mx-1">
                        +   secretKey: process.env.STRIPE_SECRET_KEY,
                      </div>
                      <div className="text-slate-400">  &#125;;</div>
                    </div>

                    {/* Remediation Box */}
                    <div className="text-xs text-slate-700 dark:text-zinc-300 space-y-1.5">
                      <p className="font-semibold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Remediation Advice</span>
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400">
                        A live production Stripe secret key was detected. Exposed secret keys grant full access to your Stripe account, customer charges, and bank transfers.
                      </p>
                      <div className="rounded-lg bg-white dark:bg-zinc-900 p-2.5 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-slate-800 dark:text-zinc-200 space-y-1">
                        <div>1. Revoke and rotate this secret key immediately in your Stripe Dashboard.</div>
                        <div>2. Add <code className="text-[#281C59] dark:text-blue-400 font-bold">STRIPE_SECRET_KEY</code> to your GitHub Repository Secrets.</div>
                        <div>3. Re-push commit to clear the Secura Security Gate.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. LOGO & METRICS BAR ────────────────────────────────────────── */}
      <section className="py-12 border-y border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-8">
            Engineered for developers across popular languages, frameworks & platforms
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div className="p-4 rounded-2xl bg-[#EDE9E6]/40 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#281C59] dark:text-white">500K+</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">PRs Inspected</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#EDE9E6]/40 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#281C59] dark:text-white">100+</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">Secret Signatures</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#EDE9E6]/40 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#281C59] dark:text-white">&lt; 1.2s</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">Average Gate Check</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#EDE9E6]/40 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#281C59] dark:text-white">0%</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">Code Retained</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. CORE FEATURES BENTO GRID ──────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#281C59] dark:text-blue-400">
              DevSecOps Without Friction
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-2 mb-4">
              Everything you need to secure your code pipeline
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Designed to stop credential leaks before code ever reaches production branches, with zero noise and zero developer friction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs hover:border-[#281C59]/40 transition-all">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-blue-400 flex items-center justify-center mb-4">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Automated PR Merge Gates
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Seamlessly integrated with GitHub Checks API. Automatically fails check runs and locks the merge button when critical secrets are introduced.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs hover:border-[#281C59]/40 transition-all">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-blue-400 flex items-center justify-center mb-4">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                100+ Secret & Token Signatures
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Comprehensive recognition for AWS, Google Cloud, Azure, Stripe, OpenAI, GitHub PATs, Slack webhooks, Private RSA/SSH keys, and database URIs.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs hover:border-[#281C59]/40 transition-all">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-blue-400 flex items-center justify-center mb-4">
                <EyeOff className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Zero False Alarm Noise Filter
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Shannon entropy heuristics and context analysis ignore test fixtures, mock files, and dummy placeholder strings (`YOUR_KEY_HERE`).
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs hover:border-[#281C59]/40 transition-all">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-blue-400 flex items-center justify-center mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                One-Click GitHub App
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                No complex YAML pipelines or custom GitHub Actions runners. Install the official GitHub App once, and protect all repositories instantly.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs hover:border-[#281C59]/40 transition-all">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-blue-400 flex items-center justify-center mb-4">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Granular Gate Policies
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Tailor policy thresholds per repository. Enforce zero tolerance on production branches while keeping feature branches fast and flexible.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs hover:border-[#281C59]/40 transition-all">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#281C59] dark:bg-zinc-900 dark:text-blue-400 flex items-center justify-center mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Zero Code Retention
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Diffs are inspected ephemerally in-memory. Secura never persists your proprietary code, and never uses your codebase to train AI models.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-[#EDE9E6]/30 dark:bg-zinc-950/60 border-y border-slate-200/80 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#281C59] dark:text-blue-400">
              Simple 3-Step Setup
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-2 mb-4">
              How Secura protects your codebase
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Zero configuration required. Start protecting pull requests in under half a minute.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 relative">
              <div className="text-4xl font-extrabold text-[#281C59]/20 dark:text-white/20 mb-3">01</div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Connect GitHub App</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Install the official Secura GitHub App. Select all or specific repositories you want protected. No personal access token or SSH key required.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 relative">
              <div className="text-4xl font-extrabold text-[#281C59]/20 dark:text-white/20 mb-3">02</div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Open Any Pull Request</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Developers write and push code normally. Secura triggers automatically on pull request creation and every subsequent commit update.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 relative">
              <div className="text-4xl font-extrabold text-[#281C59]/20 dark:text-white/20 mb-3">03</div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Automated Merge Gate</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                If credentials leak, the Secura Security Gate blocks merge and comments actionable remediation directly on GitHub. Safe code merges instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. FAQ SECTION ─────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#281C59] dark:text-blue-400">
              Frequently Asked Questions
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2 mb-3">
              Common questions about Secura
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Everything you need to know about security, privacy, and GitHub App integration.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm font-semibold text-slate-900 dark:text-white hover:text-[#281C59] dark:hover:text-blue-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-5 sm:px-5 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed border-t border-slate-100 dark:border-zinc-800/80 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 8. BOTTOM HERO CTA ─────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <div className="rounded-3xl bg-[#281C59] text-white p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl shadow-[#281C59]/30">
            {/* Ambient backdrop glow */}
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <img
                src="/logo.png"
                alt="Secura"
                className="h-14 w-14 rounded-2xl object-cover mx-auto shadow-lg"
              />
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Start Securing Your Repositories in 30 Seconds
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Connect your GitHub account and protect your pull requests from accidental secret leaks today. Free for individual developers and open-source teams.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-white text-[#281C59] px-6 py-3.5 text-xs font-bold hover:bg-slate-100 transition-all shadow-md"
                >
                  <GithubIcon className="h-4 w-4" />
                  <span>Get Started with GitHub</span>
                </Link>
                <a
                  href="https://github.com/apps/secura-security-scanner"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white px-5 py-3.5 text-xs font-semibold transition-all"
                >
                  <span>Install GitHub App</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200/80 dark:border-zinc-800/80 py-12 bg-white dark:bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Secura" className="h-7 w-7 rounded-xl object-cover" />
            <span className="text-sm font-bold text-[#281C59] dark:text-white">Secura</span>
            <span className="text-xs text-slate-400">© 2026 Secura Inc. Zero Code Retention.</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-zinc-400">
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Sign Up
            </Link>
            <a
              href="https://github.com/apps/secura-security-scanner"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              GitHub App
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-slate-200 text-[#281C59] shadow-sm">
            <img src="/logo.png" alt="Secura" className="h-7 w-7 rounded-xl object-cover" />
          </div>
        </div>
      }
    >
      <LandingPageContent />
    </Suspense>
  );
}
