"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";

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

export function LandingFooter() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setSubscribed(true);
      setNewsletterEmail("");
    }
  };

  return (
    <footer className="border-t border-slate-200/80 dark:border-white/10 pt-16 pb-6 bg-white dark:bg-[#141417ed] backdrop-blur-md overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* Top Section: Brand & Newsletter (Left) + Multi-Column Directory (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pb-10">
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
                <form onSubmit={handleNewsletterSubmit} suppressHydrationWarning className="flex flex-col sm:flex-row gap-2 max-w-md">
                  <input
                    type="email"
                    suppressHydrationWarning
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="flex-1 h-9 rounded-lg px-3.5 text-xs bg-slate-50 dark:bg-[#141417e6] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 backdrop-blur-md focus:outline-none focus:ring-1 focus:ring-[#00285B] dark:focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="submit"
                    suppressHydrationWarning
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
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xs flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 transition-colors"
              >
                <GithubIcon className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/Jay_patel_2107"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xs flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://linkedin.com/in/Jayp01"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xs flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 transition-colors"
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
                  <Link href="/#coverage" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    Secret Scanner
                  </Link>
                </li>
                <li>
                  <Link href="/#context" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    In-Memory AST
                  </Link>
                </li>
                <li>
                  <Link href="/#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    Merge Gates
                  </Link>
                </li>
                <li>
                  <Link href="/#context" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    Context Engine
                  </Link>
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
                  <Link href="/#comparison" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    Why Secura
                  </Link>
                </li>
                <li>
                  <Link href="/#context" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    Interactive Demo
                  </Link>
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
                  <Link href="/#coverage" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    100+ Signatures
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    Zero Retention
                  </Link>
                </li>
                <li>
                  <Link href="/#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    FAQ & Knowledge
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    Terms of Use
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Platform & Trust */}
            <div className="space-y-3.5">
              <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-200">
                Platform
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                <li>
                  <Link href="/about" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    About Secura
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
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
                    href="mailto:hello@secura.ink"
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

      {/* ─── MASSIVE OUTLINED SECURA WORDMARK (Single Line Guaranteed, No Extra Dividing Lines) ─── */}
      <div className="w-full overflow-hidden select-none pointer-events-none flex justify-center items-end leading-none my-2 sm:my-3">
        <span
          className="text-[13vw] sm:text-[15.5vw] font-black tracking-tighter leading-none block uppercase select-none font-sans text-transparent whitespace-nowrap translate-y-[15%]"
          style={{
            WebkitTextStroke: "2px #00285B",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0, 0, 0, 1) 20%, rgba(0, 0, 0, 0.3) 70%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, rgba(0, 0, 0, 1) 20%, rgba(0, 0, 0, 0.3) 70%, transparent 100%)",
          }}
        >
          SECURA
        </span>
      </div>

      {/* Bottom Copyright, Legal & Security Guarantee Line (After SECURA Text) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-2 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:text-zinc-500">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>© 2026 Secura Inc. Zero Code Retention Guaranteed.</span>
          <span className="hidden sm:inline text-slate-300 dark:text-zinc-700">·</span>
          <Link href="/privacy" className="hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
            Privacy Policy
          </Link>
          <span className="text-slate-300 dark:text-zinc-700">·</span>
          <Link href="/terms" className="hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
            Terms of Use
          </Link>
          <span className="text-slate-300 dark:text-zinc-700">·</span>
          <Link href="/about" className="hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
            About Secura
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <span>Zero Code Retention</span>
          <span>In-Memory AST</span>
          <span>GitHub Checks</span>
        </div>
      </div>
    </footer>
  );
}

