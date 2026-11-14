"use client";

import Link from "next/link";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ShieldCheck, Lock, EyeOff, FileText, Server, Mail } from "lucide-react";

export default function PrivacyPolicyPage() {
  const lastUpdated = "November 14, 2026";

  return (
    <div className="dark min-h-screen bg-[#141417ed] text-zinc-100 selection:bg-zinc-800 selection:text-white" style={{ backgroundColor: "#141417ed" }}>
      <LandingNavbar activePage="privacy" />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        {/* Header */}
        <div className="border-b border-white/10 pb-10 mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono mb-2 block">
            Secura Trust & Privacy Center
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Privacy Policy & Zero Retention Guarantee
          </h1>
          <p className="text-xs text-zinc-400">
            Last Updated: {lastUpdated} &bull; Effective Immediately for all Secura users and connected repositories.
          </p>
        </div>

        {/* Zero Code Retention Highlight Box */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 sm:p-8 mb-12 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-bold text-white">Our Foundational Pledge: Absolute Zero Code Retention</h2>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Secura analyzes your code pull request diffs strictly in volatile random-access memory (RAM). We do not save, duplicate, persist, or cache your proprietary source code on permanent storage disks. Once a scan completes and findings are evaluated, the in-memory diff is instantly purged. Furthermore, Secura never uses your source code to train artificial intelligence or machine learning models.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-12 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-blue-400 font-mono">1.</span> Information We Collect
            </h2>
            <p>
              When you use Secura or install our official GitHub App, we collect only the minimal metadata strictly required to authenticate your account and execute requested security evaluations:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
              <li>
                <strong className="text-white">Account Information:</strong> Name, work email address, and GitHub handle or avatar when signing in through GitHub or Google OAuth.
              </li>
              <li>
                <strong className="text-white">GitHub Integration Metadata:</strong> GitHub App installation ID, repository IDs, branch names, pull request numbers, and commit SHAs.
              </li>
              <li>
                <strong className="text-white">Scan Result Metadata:</strong> Detected violation types (e.g., &ldquo;AWS Access Key&rdquo;), line numbers, and file paths for reporting check statuses back to GitHub.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-blue-400 font-mono">2.</span> Information We NEVER Collect or Store
            </h2>
            <p>To preserve complete confidentiality and compliance for enterprise engineering teams, Secura explicitly does NOT store:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
              <li>Your underlying repository git tree, source code files, or architectural blueprints.</li>
              <li>The actual plaintext secret tokens or passwords detected during scans.</li>
              <li>Credit card numbers, bank details, or sensitive end-user customer data.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-blue-400 font-mono">3.</span> How We Use Your Information
            </h2>
            <p>We use collected metadata solely for the following business and operational purposes:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
              <li>Executing automated security AST evaluation on incoming pull request webhooks.</li>
              <li>Updating GitHub Check Run statuses to lock or unlock pull request merges.</li>
              <li>Dispatching security audit notices and sign-in verification notifications via email.</li>
              <li>Maintaining and optimizing dashboard analytics for connected repositories.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-blue-400 font-mono">4.</span> Third-Party Subprocessors
            </h2>
            <p>Secura operates with trusted, compliant cloud infrastructure providers:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border border-white/10 bg-[#18181b]/70">
                <p className="font-semibold text-white text-xs">GitHub Apps API</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Webhook delivery and Check Runs gate enforcement.</p>
              </div>
              <div className="p-3.5 rounded-xl border border-white/10 bg-[#18181b]/70">
                <p className="font-semibold text-white text-xs">Firebase & Google OAuth</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Secure authentication and identity verification.</p>
              </div>
              <div className="p-3.5 rounded-xl border border-white/10 bg-[#18181b]/70">
                <p className="font-semibold text-white text-xs">Resend</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Transactional security alerts and welcome emails.</p>
              </div>
              <div className="p-3.5 rounded-xl border border-white/10 bg-[#18181b]/70">
                <p className="font-semibold text-white text-xs">Supabase (PostgreSQL)</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Encrypted metadata and repository configuration records.</p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-blue-400 font-mono">5.</span> Security & Encryption Standards
            </h2>
            <p>
              All communications between your repositories, GitHub, and Secura take place over TLS 1.3 encrypted connections. Internal tokens and private keys are stored using industry-standard AES-256 encryption. Our architecture is designed in alignment with SOC 2 Type II controls and OWASP security guidelines.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-blue-400 font-mono">6.</span> Data Rights & Deletion
            </h2>
            <p>
              You maintain full ownership of your data at all times. You may uninstall the Secura GitHub App or request complete deletion of your account and metadata at any time by contacting our security team. Upon request, all associated configuration data is permanently purged within 48 hours.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 border-t border-white/10 pt-8">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-400" />
              <span>Contact Privacy & Security Team</span>
            </h2>
            <p className="text-zinc-400">
              If you have any questions regarding this Privacy Policy or wish to execute data rights, please contact:
            </p>
            <p className="font-mono text-xs text-white">
              Secura Security Command Center &bull; Email:{" "}
              <a href="mailto:hello@secura.ink" className="text-blue-400 hover:underline">
                hello@secura.ink
              </a>
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

