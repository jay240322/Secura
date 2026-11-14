"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { ContextGraphSection } from "@/components/landing/context-graph";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingFooter } from "@/components/landing/landing-footer";
import BlurText from "./BlurText";
import BlurContainer from "./BlurContainer";
import ScrollReveal from "./ScrollReveal";
import VariableProximity from "./VariableProximity";
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
  Server,
  Cloud,
  CreditCard,
  Bot,
  Binary,
} from "lucide-react";

import { GithubIcon } from "@/components/ui/github-icon";

function LandingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleAnimationComplete = () => {
    console.log('Animation completed!');
  };

  useEffect(() => {
    document.documentElement.classList.add("dark");
    const token = api.getToken();
    const user = api.getStoredUser();

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
      a: "Secura detects over 100+ categories of secrets including AWS Access Keys, Google Cloud Service Account JSONs, Stripe Secret Keys, OpenAI API Keys, GitHub Personal Access Tokens, Slack Webhooks, Connection strings (PostgreSQL, MySQL, MongoDB), Private RSA/SSH keys, and high-entropy API tokens.",
    },
    {
      q: "Is Secura free for individual developers and open-source?",
      a: "Yes! Secura provides a generous free tier for developers, open-source projects, and small engineering teams with unlimited PR scans across public and private GitHub repositories.",
    },
  ];

  return (
    <div
      className="dark min-h-screen bg-[#141417ed] text-zinc-100 selection:bg-zinc-800 selection:text-white"
      style={{ backgroundColor: "#141417ed" }}
    >
      {/* ─── 1. NAVBAR ──────────────────────────────────────────────────────── */}
      <LandingNavbar activePage="home" />

      {/* ─── 2. HERO SECTION ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Ambient Radial Gradient without blue background shade in dark theme */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(0,40,91,0.06),transparent_70%)] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center relative z-10">
          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-6">
            Cut Code Review Time.{" "}
            <div
              ref={containerRef}
              style={{ position: "relative" }}
              className="mt-2 block"
            >
              <VariableProximity
                label="Stop Secret Leaks Before Merge."
                className="variable-proximity-demo text-[#B6FF5C] tracking-tight select-none cursor-pointer"
                style={{ color: "#B6FF5C" }}
                fromFontVariationSettings="'wght' 400, 'opsz' 9"
                toFontVariationSettings="'wght' 1000, 'opsz' 40"
                containerRef={containerRef}
                radius={180}
                falloff="linear"
                smoothing={0.2}
                scale={1.12}
                lift={3}
                idleWave={false}
              />
            </div>
          </h1>

          {/* Subheading */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-zinc-400 leading-relaxed mb-8">
            Secura connects to your GitHub repositories in seconds to inspect pull requests for exposed credentials, API keys, private certificates, and insecure dependencies — blocking leaks with zero false alarms.
          </p>

          {/* Primary Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10">
            <Link
              href="/signup"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl bg-[#00285B] hover:bg-[#00285B]/90 text-white px-6 py-3.5 text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <GithubIcon className="h-4 w-4" />
              <span>Start Free with GitHub</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href="#demo"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/10 hover:text-[#00285B] dark:hover:text-white transition-all"
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
          <BlurContainer delay={200} distance={45} blur={10} className="rounded-2xl">
            <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-[#EDE9E6] dark:bg-[#141417ed] p-3 sm:p-5 backdrop-blur-md">
              {/* GitHub Pull Request Mock Frame (Child Container) */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md overflow-hidden">
                {/* Window Title Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 px-4 py-3 bg-slate-50/70 dark:bg-white/[0.03] backdrop-blur-sm">
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
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        <GitPullRequest className="h-3 w-3" />
                        <span>Open</span>
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        feat(auth): integrate Stripe Live API & production storage
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
                    <div className="flex-1 rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 backdrop-blur-sm p-4 space-y-3">
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

                      {/* Diff Preview with Caught Secret (Child Container) */}
                      <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-900/80 dark:bg-[#141417e6] backdrop-blur-md text-slate-100 font-mono text-xs overflow-x-auto p-3.5 space-y-1">
                        <div className="text-[11px] text-slate-400 pb-1 border-b border-slate-800 dark:border-white/10">
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

                      {/* Remediation Box (Child Container) */}
                      <div className="text-xs text-slate-700 dark:text-zinc-300 space-y-1.5">
                        <p className="font-semibold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Remediation Advice</span>
                        </p>
                        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400">
                          A live production Stripe secret key was detected. Exposed secret keys grant full access to your Stripe account, customer charges, and bank transfers.
                        </p>
                        <div className="rounded-lg bg-white/80 dark:bg-[#141417e6] backdrop-blur-md p-2.5 border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-800 dark:text-zinc-200 space-y-1">
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
          </BlurContainer>
        </div>
      </section>

      {/* ─── 4. LOGO & METRICS BAR ────────────────────────────────────────── */}
      <section className="py-12 border-y border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141417ed] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-8">
            Engineered for developers across popular languages, frameworks & platforms
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { val: "500K+", label: "PRs Inspected" },
              { val: "100+", label: "Secret Signatures" },
              { val: "< 1.2s", label: "Average Gate Check" },
              { val: "0%", label: "Code Retained" },
            ].map((m, i) => (
              <BlurContainer key={i} delay={90 * (i + 1)} distance={30} blur={8} className="rounded-2xl h-full">
                <div className="p-4 rounded-2xl bg-[#EDE9E6]/40 dark:bg-[#141417e6] backdrop-blur-md border border-slate-200/80 dark:border-white/10 h-full flex flex-col justify-center">
                  <p className="text-3xl sm:text-4xl font-extrabold text-[#00285B] dark:text-white">{m.val}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">{m.label}</p>
                </div>
              </BlurContainer>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. BEST-IN-CLASS CONTEXT: INTERACTIVE CODE GRAPH ─────────────── */}
      <BlurContainer delay={150} distance={40} blur={10}>
        <ContextGraphSection />
      </BlurContainer>

      {/* ─── 6. SUPPORTED SECRET CATEGORIES (Coverage Section) ─────────────── */}
      <section id="coverage" className="py-20 sm:py-28 bg-[#EDE9E6]/25 dark:bg-[#141417ed] border-t border-slate-200/80 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#00285B] dark:text-zinc-400 font-mono">
              Comprehensive Detection Engine
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-2 mb-4">
              100+ High-Entropy Secret Signatures
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Secura guards your repository against leaks across cloud infrastructure, payment gateways, machine learning APIs, version control, and private certificates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <BlurContainer delay={100} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                  <CreditCard className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Payment Gateways</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                  Stripe live secrets, Square production tokens, PayPal credentials, Braintree authorization keys, and live billing hooks.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["sk_live_*", "sq0csp-*", "access_token$production", "rk_live_*"].map((p, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 backdrop-blur-xs">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </BlurContainer>

            <BlurContainer delay={150} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-4">
                  <Cloud className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Cloud Infrastructure</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                  AWS access key IDs & secret keys, Google Cloud Service Account JSONs, Azure connection strings, and DigitalOcean PATs.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["AKIA[0-9A-Z]{16}", "gcp-service-account.json", "AccountKey=*", "dop_v1_*"].map((p, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 backdrop-blur-xs">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </BlurContainer>

            <BlurContainer delay={200} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                  <Bot className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Model & LLM Services</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                  OpenAI project API tokens, Anthropic Claude keys, HuggingFace user tokens, Cohere keys, and Replicate API tokens.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["sk-proj-*", "sk-ant-api03-*", "hf_[a-zA-Z0-9]{34}", "r8_*"].map((p, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 backdrop-blur-xs">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </BlurContainer>

            <BlurContainer delay={250} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                  <Server className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Data Stores & Storage</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                  PostgreSQL connection URIs with embedded passwords, MongoDB connection strings, Redis auth tokens, and MySQL credentials.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["postgresql://...", "mongodb+srv://...", "redis-cache://...", "mysql://..."].map((p, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 backdrop-blur-xs">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </BlurContainer>

            <BlurContainer delay={300} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                  <Key className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">VCS & Auth Tokens</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                  GitHub Personal Access Tokens (classic & fine-grained), GitHub OAuth client secrets, GitLab tokens, and npm publish tokens.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["ghp_[0-9a-zA-Z]{36}", "github_pat_*", "glpat-*", "npm_*"].map((p, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 backdrop-blur-xs">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </BlurContainer>

            <BlurContainer delay={350} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
                  <Binary className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Cryptographic Keys</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
                  Private RSA keys, OpenSSH private keys, PGP private key blocks, and SSL/TLS certificates committed to git history.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["BEGIN RSA PRIVATE KEY", "BEGIN OPENSSH PRIVATE", "BEGIN PGP PRIVATE", "BEGIN EC PRIVATE"].map((p, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 backdrop-blur-xs">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </BlurContainer>
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

          <BlurContainer delay={150} distance={40} className="rounded-2xl">
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03]">
                      <th className="py-4 px-6 font-bold text-slate-900 dark:text-white">Feature</th>
                      <th className="py-4 px-6 font-bold text-[#00285B] dark:text-white bg-[#EDE9E6]/30 dark:bg-blue-950/20">
                        Secura
                      </th>
                      <th className="py-4 px-6 font-medium text-slate-500 dark:text-zinc-400">Traditional Scanners</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    <tr>
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">Scan Latency</td>
                      <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-blue-950/20 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> &lt; 50ms In-Memory AST
                      </td>
                      <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">5 to 12 minutes (Heavy CI Runner wait)</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">Code Retention Policy</td>
                      <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-blue-950/20">
                        0% (Inspected in-memory, never persisted)
                      </td>
                      <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">Clones full repository to vendor disk</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">Test Mock Handling</td>
                      <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-blue-950/20">
                        Shannon Entropy Filter (Zero False Positives)
                      </td>
                      <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">Spams PRs with false alerts on test fixtures</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">PR Gate Enforcement</td>
                      <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-blue-950/20">
                        Automated GitHub PR Merge Lock & Unblock
                      </td>
                      <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">Passive emails & easily ignored dashboards</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">Setup Friction</td>
                      <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-[#EDE9E6]/30 dark:bg-blue-950/20">
                        30-Second 1-Click GitHub App (Zero YAML)
                      </td>
                      <td className="py-4 px-6 text-slate-500 dark:text-zinc-400">Requires custom Docker, YAML & secrets config</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </BlurContainer>
        </div>
      </section>

      {/* ─── 8. CORE FEATURES BENTO GRID ──────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 bg-[#EDE9E6]/25 dark:bg-[#141417ed] border-t border-slate-200/80 dark:border-white/10">
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
            <BlurContainer delay={100} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-white/[0.06] dark:border dark:border-white/10 dark:text-white flex items-center justify-center mb-4">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  Automated PR Merge Gates
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Seamlessly integrated with GitHub Checks API. Automatically fails check runs and locks the merge button when critical secrets are introduced.
                </p>
              </div>
            </BlurContainer>

            <BlurContainer delay={150} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-white/[0.06] dark:border dark:border-white/10 dark:text-white flex items-center justify-center mb-4">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  100+ Secret & Token Signatures
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Comprehensive recognition for AWS, Google Cloud, Azure, Stripe, OpenAI, GitHub PATs, Slack webhooks, Private RSA/SSH keys, and connection URIs.
                </p>
              </div>
            </BlurContainer>

            <BlurContainer delay={200} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-white/[0.06] dark:border dark:border-white/10 dark:text-white flex items-center justify-center mb-4">
                  <EyeOff className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  Zero False Alarm Noise Filter
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Shannon entropy heuristics and context analysis ignore test fixtures, mock files, and dummy placeholder strings (`YOUR_KEY_HERE`).
                </p>
              </div>
            </BlurContainer>

            <BlurContainer delay={250} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-white/[0.06] dark:border dark:border-white/10 dark:text-white flex items-center justify-center mb-4">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  One-Click GitHub App
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  No complex YAML pipelines or custom GitHub Actions runners. Install the official GitHub App once, and protect all repositories instantly.
                </p>
              </div>
            </BlurContainer>

            <BlurContainer delay={300} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-white/[0.06] dark:border dark:border-white/10 dark:text-white flex items-center justify-center mb-4">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  Granular Gate Policies
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Tailor policy thresholds per repository. Enforce zero tolerance on production branches while keeping feature branches fast and flexible.
                </p>
              </div>
            </BlurContainer>

            <BlurContainer delay={350} distance={35} className="rounded-2xl h-full">
              <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md hover:border-white/20 transition-all h-full">
                <div className="h-10 w-10 rounded-xl bg-[#EDE9E6] text-[#00285B] dark:bg-white/[0.06] dark:border dark:border-white/10 dark:text-white flex items-center justify-center mb-4">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  Zero Code Retention
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Diffs are inspected ephemerally in-memory. Secura never persists your proprietary code, and never uses your codebase for model training.
                </p>
              </div>
            </BlurContainer>
          </div>
        </div>
      </section>

      {/* ─── 8.5 DEEP CODE INTELLIGENCE & ARCHITECTURE SHOWCASE (BlurText Animation) ─── */}
      <section className="py-20 sm:py-28 border-t border-slate-200/80 dark:border-white/10 relative overflow-hidden bg-slate-50/50 dark:bg-[#141417ed]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          {/* BlurText & ScrollReveal Animation Showcase */}
          <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-mono mb-3">
              Next-Gen Static Analysis & Pipeline Telemetry
            </span>

            <BlurText
              text="Isn't this so cool?!"
              effect="blur"
              animateBy="words"
              direction="top"
              staggerFrom="start"
              trigger="view"
              delay={200}
              stepDuration={0.35}
              blur={10}
              distance={50}
              onAnimationComplete={handleAnimationComplete}
              className="text-2xl mb-8 font-bold text-blue-600 dark:text-blue-400 justify-center"
              loop={false}
              loopDelay={2}
              focusOnHover={false}
            />

            <BlurText
              text="Deep Code Intelligence & Continuous Threat Defense"
              effect="blur"
              animateBy="words"
              direction="top"
              staggerFrom="start"
              trigger="view"
              delay={300}
              stepDuration={0.3}
              blur={12}
              distance={40}
              className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white justify-center leading-tight mb-4"
              loop={false}
              loopDelay={2}
              focusOnHover={false}
            />

            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl mb-10">
              Secura operates as an autonomous security co-pilot directly in your git workflow, combining deep AST structural parsing, Shannon entropy analytics, and instant GitHub check run enforcement.
            </p>
          </div>

          {/* 3-Pillar Enterprise Architecture Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <BlurContainer delay={100} distance={35} className="rounded-2xl h-full">
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-md p-6 hover:border-blue-500/30 transition-all h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Code2 className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">In-Memory AST Parsing</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                  Unlike regex-only scanners that match blind strings, Secura decomposes code diffs into Abstract Syntax Trees. It distinguishes variables, comments, imports, and mock test fixtures with surgical precision.
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">AST Analysis</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">&lt; 50ms Latency</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">12+ Languages</span>
                </div>
              </div>
            </BlurContainer>

            <BlurContainer delay={200} distance={35} className="rounded-2xl h-full">
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-md p-6 hover:border-emerald-500/30 transition-all h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Shannon Entropy Filter</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                  High-entropy keys and hashed secrets generate mathematical signatures. Secura calculates character distribution variance to separate random cryptokeys from standard test mocks (`dummy_mock_token_123`).
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">Entropy Scorer</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">99.4% Less Noise</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">Zero Spurious Alerts</span>
                </div>
              </div>
            </BlurContainer>

            <BlurContainer delay={300} distance={35} className="rounded-2xl h-full">
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-md p-6 hover:border-purple-500/30 transition-all h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Automated PR Merge Guard</h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                  Secura registers native GitHub Check Runs that block pull requests in real time when critical leaks are detected. Once rotated or resolved, check status automatically transitions to passing with zero manual unlocks.
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">GitHub Checks</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">Merge Lock</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">Auto-Remediation</span>
                </div>
              </div>
            </BlurContainer>
          </div>

          {/* Standards & Security Governance Bar */}
          <BlurContainer delay={200} distance={30} className="rounded-2xl">
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#18181b]/80 backdrop-blur-md p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="space-y-1.5 text-center lg:text-left">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                    Industry Security Standards & Threat Models
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Built to satisfy rigorous DevSecOps compliance requirements right out of the box.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto text-center font-mono text-xs">
                  <div className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60">
                    <p className="font-bold text-slate-900 dark:text-white">OWASP A02</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Cryptographic Failures</p>
                  </div>
                  <div className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60">
                    <p className="font-bold text-slate-900 dark:text-white">CWE-798</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Hard-coded Secrets</p>
                  </div>
                  <div className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60">
                    <p className="font-bold text-slate-900 dark:text-white">SOC 2 Ready</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Zero Disk Retention</p>
                  </div>
                  <div className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60">
                    <p className="font-bold text-slate-900 dark:text-white">TLS 1.3</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Encrypted In-Transit</p>
                  </div>
                </div>
              </div>
            </div>
          </BlurContainer>
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
              <BlurContainer key={idx} delay={40 * (idx + 1)} distance={20} blur={6} className="rounded-2xl">
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#141417e6] backdrop-blur-md overflow-hidden">
                  <button
                    type="button"
                    suppressHydrationWarning
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
                    <div className="px-4 pb-5 sm:px-5 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed border-t border-slate-100 dark:border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              </BlurContainer>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 10. BOTTOM HERO CTA ────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 border-t border-slate-200/80 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center">
          <BlurContainer delay={150} distance={35} className="rounded-3xl">
            <div className="rounded-3xl bg-[#00285B] p-8 sm:p-14 text-white relative overflow-hidden">
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
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-[#00285B] px-6 py-3.5 text-xs font-bold hover:scale-[1.02] active:scale-[0.98] transition-all"
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
          </BlurContainer>
        </div>
      </section>

      {/* ─── 11. FOOTER ──────────────────────────────────────────────────────── */}
      <LandingFooter />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div
          className="dark min-h-screen flex items-center justify-center bg-[#141417ed]"
          style={{ backgroundColor: "#141417ed" }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#141417e6] backdrop-blur-md border border-white/10 text-white">
            <img src="/logo.png" alt="Secura" className="h-7 w-7 rounded-xl object-cover" />
          </div>
        </div>
      }
    >
      <LandingPageContent />
    </Suspense>
  );
}
