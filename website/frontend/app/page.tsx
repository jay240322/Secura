"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { ContextGraphSection } from "@/components/landing/context-graph";
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
  Terminal,
  EyeOff,
  Cpu,
  Layers,
  Code2,
  FileCode,
  AlertTriangle,
  Key,
  Database,
  Cloud,
  CreditCard,
  Bot,
  Binary,
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

function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function LandingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setSubscribed(true);
      setNewsletterEmail("");
    }
  };

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add("dark");
    const token = api.getToken();
    const user = api.getStoredUser();
    setIsAuthenticated(Boolean(token && user));

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

  const FAQS = [
    {
      q: "Does Secura store or retain our source code?",
      a: "No. Secura operates under a strict Zero Code Retention policy. Pull request diffs are inspected in-memory through the GitHub Checks API and immediately discarded. Your source code is never cached, persistently stored on disks, or used to train machine learning models.",
    },
    {
      q: "How does the Security Gate prevent unsafe pull request merges?",
      a: "Secura registers as an official GitHub Check Run on your repositories. When a PR is opened or updated, Secura scans every modified line in milliseconds. If critical secrets violate your policy, the Secura Check reports a failure status, automatically locking GitHub's merge button.",
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
    <div className="dark min-h-screen bg-[#111113] text-zinc-100 selection:bg-zinc-800 selection:text-white">
      {/* ─── 1. NAVBAR ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-[#111113]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="Secura Owl Logo"
              className="h-8 w-8 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
            />
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white">
                Secura
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-semibold">
                v2.0
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-zinc-400">
            <a href="#context" className="hover:text-white transition-colors">
              Context Engine
            </a>
            <a href="#coverage" className="hover:text-white transition-colors">
              100+ Signatures
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#comparison" className="hover:text-white transition-colors">
              Why Secura
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {mounted && isAuthenticated ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-xl bg-[#00285B] hover:bg-[#001f44] text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
              >
                <span>Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="hidden sm:inline-flex rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="flex items-center gap-1.5 rounded-xl bg-[#00285B] hover:bg-[#001f44] text-white px-4 py-2 text-xs font-semibold shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <GithubIcon className="h-3.5 w-3.5" />
                  <span>Get Started</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── 2. HERO SECTION ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Ambient Radial Gradient without blue background shade in dark theme */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(0,40,91,0.06),transparent_70%)] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center relative z-10">
          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-6">
            Cut Code Review Time.{" "}
            <span className="block text-[#00285B] dark:text-[#00285B] mt-1">
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
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl bg-[#00285B] hover:bg-[#00285B]/90 text-white px-6 py-3.5 text-sm font-semibold shadow-md shadow-[#00285B]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <GithubIcon className="h-4 w-4" />
              <span>Start Free with GitHub</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href="#demo"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-[#EDE9E6] dark:hover:bg-zinc-800 hover:text-[#00285B] dark:hover:text-white transition-all shadow-2xs"
            >
              <Terminal className="h-4 w-4 text-[#00285B] dark:text-zinc-400" />
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

        {/* ─── 3. INTERACTIVE PR REVIEW MOCK ────────────── */}
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
                    target: <code className="text-[#00285B] dark:text-zinc-300 font-semibold">main</code> ← branch: <code>feature/stripe-billing</code>
                  </span>
                </div>
              </div>

              {/* Secura Bot Review Comment Box */}
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <img
                    src="/logo.png"
                    alt="Secura Bot"
                    className="h-9 w-9 rounded-xl object-cover ring-2 ring-[#00285B]/20 shrink-0"
                  />
                  <div className="flex-1 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          secura-bot
                        </span>
                        <span className="text-[10px] font-mono rounded bg-[#00285B] text-white px-1.5 py-0.2">
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
                        <div>2. Add <code className="text-[#00285B] dark:text-blue-300 font-bold">STRIPE_SECRET_KEY</code> to your GitHub Repository Secrets.</div>
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
              <p className="text-3xl sm:text-4xl font-extrabold text-[#00285B] dark:text-white">500K+</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">PRs Inspected</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#EDE9E6]/40 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#00285B] dark:text-white">100+</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">Secret Signatures</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#EDE9E6]/40 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#00285B] dark:text-white">&lt; 1.2s</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">Average Gate Check</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#EDE9E6]/40 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#00285B] dark:text-white">0%</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">Code Retained</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. BEST-IN-CLASS CONTEXT: INTERACTIVE CODE GRAPH ─────────────── */}
      <ContextGraphSection />

      {/* ─── 6. SUPPORTED SECRET CATEGORIES (Coverage Section) ─────────────── */}
      <section id="coverage" className="py-20 sm:py-28 bg-[#EDE9E6]/25 dark:bg-zinc-950/50 border-t border-slate-200/80 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#00285B] dark:text-zinc-400 font-mono">
              Comprehensive Detection Engine
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-2 mb-4">
              100+ High-Entropy Secret Signatures
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Secura guards your repository against leaks across cloud infrastructure, payment gateways, AI APIs, version control, and private certificates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <CreditCard className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Payment Gateways</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                Stripe live secrets, Square production tokens, PayPal credentials, Braintree authorization keys, and live billing hooks.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["sk_live_*", "sq0csp-*", "access_token$production", "rk_live_*"].map((p, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-4">
                <Cloud className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Cloud Infrastructure</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                AWS access key IDs & secret keys, Google Cloud Service Account JSONs, Azure connection strings, and DigitalOcean PATs.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["AKIA[0-9A-Z]{16}", "gcp-service-account.json", "AccountKey=*", "dop_v1_*"].map((p, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">AI & LLM Services</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                OpenAI project API tokens, Anthropic Claude keys, HuggingFace user tokens, Cohere keys, and Replicate API tokens.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["sk-proj-*", "sk-ant-api03-*", "hf_[a-zA-Z0-9]{34}", "r8_*"].map((p, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Databases & Storage</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                PostgreSQL connection URIs with embedded passwords, MongoDB connection strings, Redis auth tokens, and MySQL credentials.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["postgres://*:*@", "mongodb+srv://*:*@", "redis://:token@", "mysql://*:*@"].map((p, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                <Key className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">VCS & Auth Tokens</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                GitHub Personal Access Tokens (classic & fine-grained), GitHub OAuth client secrets, GitLab tokens, and npm publish tokens.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["ghp_[0-9a-zA-Z]{36}", "github_pat_*", "glpat-*", "npm_*"].map((p, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
                <Binary className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Cryptographic Keys</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                Private RSA keys, OpenSSH private keys, PGP private key blocks, and SSL/TLS certificates committed to git history.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["BEGIN RSA PRIVATE KEY", "BEGIN OPENSSH PRIVATE", "BEGIN PGP PRIVATE", "BEGIN EC PRIVATE"].map((p, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. WHY SECURA COMPARISON TABLE ─────────────────────────────────── */}
      <section id="comparison" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#00285B] dark:text-zinc-400 font-mono">
              Designed For Velocity
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-2 mb-4">
              Secura vs Legacy Security Scanners
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Why fast-moving engineering teams replace heavy, slow security scanners with Secura.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#141417] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40">
                    <th className="py-4 px-6 font-bold text-slate-900 dark:text-white">Feature</th>
                    <th className="py-4 px-6 font-bold text-[#00285B] dark:text-white bg-[#EDE9E6]/30 dark:bg-zinc-900/60">
                      Secura
                    </th>
                    <th className="py-4 px-6 font-medium text-slate-500 dark:text-zinc-400">Traditional Scanners</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  <tr>
                    <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">Scan Latency</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-zinc-900/60 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> &lt; 50ms In-Memory AST
                    </td>
                    <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">5 to 12 minutes (Heavy CI Runner wait)</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">Code Retention Policy</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-zinc-900/60">
                      0% (Inspected in-memory, never persisted)
                    </td>
                    <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">Clones full repository to vendor disk</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">Test Mock Handling</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-zinc-900/60">
                      Shannon Entropy Filter (Zero False Positives)
                    </td>
                    <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">Spams PRs with false alerts on test fixtures</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">PR Gate Enforcement</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-zinc-900/60">
                      Automated GitHub PR Merge Lock & Unblock
                    </td>
                    <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">Passive emails & easily ignored dashboards</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">Setup Friction</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-zinc-900/60">
                      30-Second 1-Click GitHub App (Zero YAML)
                    </td>
                    <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">Requires custom Docker, YAML & secrets config</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 8. CORE FEATURES BENTO GRID ──────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 bg-[#EDE9E6]/25 dark:bg-zinc-950/50 border-t border-slate-200/80 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#00285B] dark:text-zinc-400 font-mono">
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
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-zinc-900 dark:text-white flex items-center justify-center mb-4">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Automated PR Merge Gates
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Seamlessly integrated with GitHub Checks API. Automatically fails check runs and locks the merge button when critical secrets are introduced.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-zinc-900 dark:text-white flex items-center justify-center mb-4">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                100+ Secret & Token Signatures
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Comprehensive recognition for AWS, Google Cloud, Azure, Stripe, OpenAI, GitHub PATs, Slack webhooks, Private RSA/SSH keys, and database URIs.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-zinc-900 dark:text-white flex items-center justify-center mb-4">
                <EyeOff className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Zero False Alarm Noise Filter
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Shannon entropy heuristics and context analysis ignore test fixtures, mock files, and dummy placeholder strings (`YOUR_KEY_HERE`).
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-zinc-900 dark:text-white flex items-center justify-center mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                One-Click GitHub App
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                No complex YAML pipelines or custom GitHub Actions runners. Install the official GitHub App once, and protect all repositories instantly.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-zinc-900 dark:text-white flex items-center justify-center mb-4">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                Granular Gate Policies
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Tailor policy thresholds per repository. Enforce zero tolerance on production branches while keeping feature branches fast and flexible.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417]">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-zinc-900 dark:text-white flex items-center justify-center mb-4">
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

      {/* ─── 9. FAQ SECTION ─────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#00285B] dark:text-zinc-400 font-mono">
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
                className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm font-semibold text-slate-900 dark:text-white hover:text-[#00285B] dark:hover:text-zinc-200 transition-colors"
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

      {/* ─── 10. BOTTOM HERO CTA ────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 border-t border-slate-200/80 dark:border-zinc-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center">
          <div className="rounded-3xl bg-[#00285B] p-8 sm:p-14 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10 max-w-2xl mx-auto space-y-5">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Stop Leaking Secrets Today.
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                Connect your GitHub account in 30 seconds. Protect every pull request across your public and private repositories with zero code retention.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-[#00285B] px-6 py-3.5 text-xs font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <GithubIcon className="h-4 w-4" />
                  <span>Install Secura Free</span>
                  <ArrowRight className="h-4 w-4" />
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

      {/* ─── 11. FOOTER (Exact CodeRabbit Layout Tailored for Secura) ─────────── */}
      <footer className="border-t border-slate-200/80 dark:border-zinc-800/80 pt-16 pb-6 bg-white dark:bg-[#111113] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          {/* Top Section: Brand & Newsletter (Left) + Multi-Column Directory (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pb-14 border-b border-slate-100 dark:border-zinc-800/60">
            {/* Left: Brand Identity, Tagline & Newsletter */}
            <div className="lg:col-span-5 space-y-6">
              {/* Brand Lockup */}
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.png" alt="Secura" className="h-7 w-7 rounded-xl object-cover shadow-sm" />
                  <span className="text-lg font-bold tracking-tight text-[#00285B] dark:text-white">Secura</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm leading-relaxed">
                  Autonomous PR security and secret leak prevention with zero source code retention.
                </p>
              </div>

              {/* Newsletter Subscription Block */}
              <div className="space-y-3 pt-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-200 block">
                  Sign up for our newsletter
                </span>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm leading-relaxed">
                  Stay updated on newly detected secret signatures, AST engine releases, and DevSecOps insights.
                </p>
                {subscribed ? (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium max-w-md">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>Thank you! You are subscribed to Secura security updates.</span>
                  </div>
                ) : (
                  <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md">
                    <input
                      type="email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="flex-1 h-9 rounded-lg px-3.5 text-xs bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#00285B] dark:focus:ring-blue-500 transition-all"
                    />
                    <button
                      type="submit"
                      className="h-9 px-4 rounded-lg bg-[#00285B] hover:bg-[#001f44] text-white text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      Subscribe
                    </button>
                  </form>
                )}
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 leading-normal max-w-sm">
                  By signing up you agree to our Terms of Use and authorize Secura to provide occasional updates.
                </p>
              </div>

              {/* Social Channels */}
              <div className="flex items-center gap-3 pt-1">
                <a
                  href="https://github.com/apps/secura-security-scanner"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="h-8 w-8 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <GithubIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://x.com/Jay_patel_2107"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter)"
                  className="h-8 w-8 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </a>
                <a
                  href="https://linkedin.com/in/Jayp01"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="h-8 w-8 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <LinkedInIcon className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Right: Categorized Navigation Links Columns */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-8">
              {/* Column 1: Product */}
              <div className="space-y-3.5">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-200">
                  Product
                </h4>
                <ul className="space-y-2.5 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  <li>
                    <a href="#coverage" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Secret Scanner
                    </a>
                  </li>
                  <li>
                    <a href="#context" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      In-Memory AST
                    </a>
                  </li>
                  <li>
                    <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Merge Gates
                    </a>
                  </li>
                  <li>
                    <a href="#context" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Context Engine
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/apps/secura-security-scanner"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      GitHub App ↗
                    </a>
                  </li>
                </ul>
              </div>

              {/* Column 2: Explore */}
              <div className="space-y-3.5">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-200">
                  Explore
                </h4>
                <ul className="space-y-2.5 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  <li>
                    <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Pricing & Plans
                    </a>
                  </li>
                  <li>
                    <a href="#context" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Interactive Demo
                    </a>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Sign In
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Get Started
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Column 3: Resources */}
              <div className="space-y-3.5">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-200">
                  Resources
                </h4>
                <ul className="space-y-2.5 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  <li>
                    <a href="#coverage" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      100+ Signatures
                    </a>
                  </li>
                  <li>
                    <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Threat Models
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      FAQ & Knowledge
                    </a>
                  </li>
                  <li>
                    <a href="#comparison" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Why Secura
                    </a>
                  </li>
                </ul>
              </div>

              {/* Column 4: Company & Trust */}
              <div className="space-y-3.5">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-200">
                  Company
                </h4>
                <ul className="space-y-2.5 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  <li>
                    <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      About Secura
                    </a>
                  </li>
                  <li>
                    <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Zero Retention
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.jaypatel.online/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Jay Patel ↗
                    </a>
                  </li>
                  <li>
                    <a
                      href="mailto:pateljay0j@gmail.com"
                      className="hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Contact
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ─── MASSIVE OUTLINED SECURA WORDMARK (Fade Effect + 20% Bottom Cut) ─── */}
        <div className="w-full overflow-hidden select-none pointer-events-none flex justify-center items-end leading-none my-2 sm:my-4">
          <span
            className="text-[16vw] sm:text-[18.5vw] font-black tracking-tighter leading-[0.78] block uppercase select-none font-sans text-transparent translate-y-[20%]"
            style={{
              WebkitTextStroke: "2.5px #00285B",
              WebkitMaskImage:
                "linear-gradient(to bottom, rgba(0, 0, 0, 1) 15%, rgba(0, 0, 0, 0.35) 65%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, rgba(0, 0, 0, 1) 15%, rgba(0, 0, 0, 0.35) 65%, transparent 100%)",
            }}
          >
            SECURA
          </span>
        </div>

        {/* Bottom Copyright, Legal & Security Guarantee Line (After SECURA Text) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-2 border-t border-slate-100 dark:border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:text-zinc-500">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© 2026 Secura Inc. Zero Code Retention Guaranteed.</span>
            <span className="hidden sm:inline text-slate-300 dark:text-zinc-700">·</span>
            <a href="#privacy" className="hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
              Privacy Policy
            </a>
            <span className="text-slate-300 dark:text-zinc-700">·</span>
            <a href="#terms" className="hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
              Terms of Use
            </a>
          </div>
          <div className="flex items-center gap-6">
            <span>Zero Code Retention</span>
            <span>In-Memory AST</span>
            <span>GitHub Checks</span>
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
        <div className="dark min-h-screen flex items-center justify-center bg-[#111113]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-white shadow-sm">
            <img src="/logo.png" alt="Secura" className="h-7 w-7 rounded-xl object-cover" />
          </div>
        </div>
      }
    >
      <LandingPageContent />
    </Suspense>
  );
}
