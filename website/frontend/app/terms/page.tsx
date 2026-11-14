"use client";

import Link from "next/link";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function TermsPage() {
  const lastUpdated = "November 14, 2026";

  return (
    <div className="dark min-h-screen bg-[#141417ed] text-zinc-100 selection:bg-zinc-800 selection:text-white" style={{ backgroundColor: "#141417ed" }}>
      <LandingNavbar activePage="terms" />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <div className="border-b border-white/10 pb-10 mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono mb-2 block">
            Secura Terms of Service
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Terms of Use
          </h1>
          <p className="text-xs text-zinc-400">
            Last Updated: {lastUpdated} &bull; Please review these terms carefully before connecting repositories.
          </p>
        </div>

        <div className="space-y-10 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">1. Acceptance of Terms</h2>
            <p className="text-zinc-400">
              By accessing Secura or installing the Secura GitHub App on your repositories, you agree to comply with and be bound by these Terms of Use and our Zero Retention Privacy Policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">2. Scope of Service & Security Evaluation</h2>
            <p className="text-zinc-400">
              Secura provides automated code and pull request vulnerability detection via Abstract Syntax Tree (AST) static analysis and entropy classification. Services are provided on an &ldquo;as-is&rdquo; basis to assist engineering teams in safeguarding credentials and preventing secret leakage.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">3. Zero Code Retention Guarantee</h2>
            <p className="text-zinc-400">
              Secura guarantees that customer source code evaluated during pull request scanning is executed in ephemeral memory and discarded immediately upon completion. Secura does not claim any intellectual property rights over code scanned by the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">4. User Responsibilities</h2>
            <p className="text-zinc-400">
              You agree to use Secura only on repositories and codebases you own or have explicit authorization to monitor and protect. You must not attempt to reverse engineer, abuse, or deliberately disrupt Secura scanning infrastructure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">5. Contact Information</h2>
            <p className="text-zinc-400">
              For questions concerning these terms, contact{" "}
              <a href="mailto:hello@secura.ink" className="text-blue-400 hover:underline">
                hello@secura.ink
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

