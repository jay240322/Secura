"use client";

import Link from "next/link";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingFooter } from "@/components/landing/landing-footer";
import {
  ShieldCheck,
  Zap,
  Lock,
  GitPullRequest,
  CheckCircle2,
  Cpu,
  ArrowRight,
  ExternalLink,
  Layers,
  HeartHandshake,
  KeyRound,
  FileCode2,
} from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";

export default function AboutPage() {
  return (
    <div className="dark min-h-screen bg-[#141417ed] text-zinc-100 selection:bg-zinc-800 selection:text-white" style={{ backgroundColor: "#141417ed" }}>
      <LandingNavbar activePage="about" />

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-500 font-mono mb-3 block">
            About Secura
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Built to Eliminate Security Regressions at Git-Speed
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            Secura was created to replace slow, noisy legacy scanners with an autonomous, in-memory security engine that lives directly in your pull request workflow.
          </p>
        </div>

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
          <div className="p-5 rounded-2xl border border-white/10 bg-[#18181b]/90 backdrop-blur-md text-center">
            <p className="text-3xl font-extrabold text-white font-mono">&lt; 50ms</p>
            <p className="text-xs text-zinc-400 mt-1">In-Memory AST Scan</p>
          </div>
          <div className="p-5 rounded-2xl border border-white/10 bg-[#18181b]/90 backdrop-blur-md text-center">
            <p className="text-3xl font-extrabold text-emerald-400 font-mono">0%</p>
            <p className="text-xs text-zinc-400 mt-1">Code Stored on Disks</p>
          </div>
          <div className="p-5 rounded-2xl border border-white/10 bg-[#18181b]/90 backdrop-blur-md text-center">
            <p className="text-3xl font-extrabold text-blue-400 font-mono">100+</p>
            <p className="text-xs text-zinc-400 mt-1">Secret Signatures</p>
          </div>
          <div className="p-5 rounded-2xl border border-white/10 bg-[#18181b]/90 backdrop-blur-md text-center">
            <p className="text-3xl font-extrabold text-purple-400 font-mono">99.4%</p>
            <p className="text-xs text-zinc-400 mt-1">False-Alarm Filter</p>
          </div>
        </div>

        {/* Our Mission */}
        <section className="mb-20 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#18181b]/80 backdrop-blur-md p-8 sm:p-12 shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Our Mission: Developer Velocity Without Vulnerabilities
            </h2>
            <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
              <p>
                In high-velocity software engineering, developer momentum is everything. Yet, traditional security scanners introduce heavy 10-minute CI/CD queue delays and flood pull requests with false positive alerts on test fixtures and harmless mock strings.
              </p>
              <p>
                Secura takes a fundamentally different architectural approach. Instead of cloning entire repositories or storing proprietary source code on external servers, Secura processes pull request diffs ephemerally in-memory through the GitHub Checks API.
              </p>
              <p>
                By combining deep Abstract Syntax Tree (AST) static analysis with Shannon entropy evaluation, Secura accurately spots real production credential leaks in under 50 milliseconds while guaranteeing absolute zero code retention.
              </p>
            </div>
          </div>
        </section>

        {/* Core Architectural Pillars */}
        <section className="mb-20">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-8 text-center sm:text-left">
            Core Architectural Principles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-md space-y-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Absolute Zero Code Retention</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Code diffs are analyzed in volatile memory and immediately evicted. We never store source trees on disk, never build persistent indexes of your IP, and never train external models on customer code.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-md space-y-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Sub-50ms AST Static Analysis</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Our parsing pipeline parses multi-language source code into syntax trees within milliseconds. Checks complete before developers can even switch browser tabs.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-md space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Shannon Entropy Heuristics</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Mathematical entropy scoring evaluates character distribution randomness to catch obscure tokens while cleanly ignoring obvious placeholders like `YOUR_KEY_HERE`.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-md space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Automated PR Check Run Gates</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Secura hooks natively into GitHub Check Runs. Merges are automatically prevented when critical secrets are caught and immediately unblocked as soon as issues are resolved.
              </p>
            </div>
          </div>
        </section>

        {/* Founded & Leadership */}
        <section className="mb-20 rounded-3xl border border-white/10 bg-gradient-to-br from-[#18181b] to-[#121215] p-8 sm:p-10 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="h-16 w-16 rounded-2xl bg-[#00285B] border border-blue-500/30 flex items-center justify-center text-white text-2xl font-black shrink-0">
              JP
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-lg font-bold text-white">Built by Jay Patel</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Secura was architected by Jay Patel to eliminate hard-coded secrets, credential exposures, and cloud key leaks in modern GitHub development teams.
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-4 pt-1">
                <a
                  href="https://www.jaypatel.online/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  <span>Website (jaypatel.online)</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-zinc-600">&bull;</span>
                <a
                  href="mailto:hello@secura.ink"
                  className="text-xs text-zinc-400 hover:text-white font-medium"
                >
                  hello@secura.ink
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="rounded-3xl bg-[#00285B] p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="max-w-xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Ready to Protect Your Repositories?
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Install the official Secura GitHub App in 30 seconds. Zero YAML configuration required.
            </p>
            <div className="pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-[#00285B] hover:bg-slate-100 px-6 py-3 text-xs font-bold shadow-md transition-all"
              >
                <GithubIcon className="h-4 w-4" />
                <span>Get Started Free</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

