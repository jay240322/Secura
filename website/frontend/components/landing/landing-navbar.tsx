"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GithubIcon } from "@/components/ui/github-icon";
import { api } from "@/lib/api-client";

export function LandingNavbar({ activePage = "home" }: { activePage?: "home" | "about" | "privacy" | "terms" }) {
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = api.getToken();
    const user = api.getStoredUser();
    setIsAuthenticated(Boolean(token && user));
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#141417ed] backdrop-blur-md"
      style={{ backgroundColor: "#141417ed" }}
    >
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <img
            src="/logo.png"
            alt="Secura"
            className="h-8 w-8 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-white">
              Secura
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-zinc-400">
          <Link
            href="/#context"
            className={`transition-colors hover:text-white ${activePage === "home" ? "text-zinc-300" : ""}`}
          >
            Context Engine
          </Link>
          <Link
            href="/#coverage"
            className="hover:text-white transition-colors"
          >
            100+ Signatures
          </Link>
          <Link
            href="/#features"
            className="hover:text-white transition-colors"
          >
            Features
          </Link>
          <Link
            href="/about"
            className={`transition-colors hover:text-white ${activePage === "about" ? "text-white font-bold" : ""}`}
          >
            About
          </Link>
          <Link
            href="/privacy"
            className={`transition-colors hover:text-white ${activePage === "privacy" ? "text-white font-bold" : ""}`}
          >
            Privacy
          </Link>
          <Link
            href="/#faq"
            className="hover:text-white transition-colors"
          >
            FAQ
          </Link>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3">
          {mounted && isAuthenticated ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl bg-[#00285B] hover:bg-[#001f44] text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden sm:inline-flex rounded-xl border border-white/10 bg-[#141417e6] backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
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
  );
}

