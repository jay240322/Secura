"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Key,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ShieldCheck,
  Zap,
  LockKeyhole,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api-client";
import {
  auth,
  googleProvider,
  githubProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "@/lib/firebase";
import { useTheme } from "@/components/theme-provider";
import MoltenMetal from "@/components/ui/molten-metal";
import { GithubIcon } from "@/components/ui/github-icon";

interface CodeRabbitAuthProps {
  initialMode?: "login" | "signup";
}

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function CodeRabbitAuth({ initialMode = "login" }: CodeRabbitAuthProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic "Last used on this computer" logic
  const [mounted, setMounted] = useState(false);
  const [lastUsedProvider, setLastUsedProvider] = useState<"github" | "google">("github");

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("secura_last_auth_provider");
      if (saved === "google" || saved === "github") {
        setLastUsedProvider(saved);
      } else {
        setLastUsedProvider("github");
      }
    } catch {
      setLastUsedProvider("github");
    }
  }, []);

  // Email/SSO expanded state
  const [showSSO, setShowSSO] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handlePostAuthSuccess = (providerUsed: "github" | "google" | "local") => {
    if (providerUsed === "github" || providerUsed === "google") {
      try {
        localStorage.setItem("secura_last_auth_provider", providerUsed);
      } catch {}
    }

    const pendingInstId =
      typeof window !== "undefined"
        ? sessionStorage.getItem("secura_pending_installation_id")
        : null;

    if (pendingInstId) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("secura_pending_installation_id");
      }
      void api.syncRepositories().finally(() => {
        router.push(`/repositories?installed=true&installation_id=${pendingInstId}`);
      });
      return;
    }

    router.push(redirectUrl || "/dashboard");
  };

  // Real OAuth
  const handleOAuth = async (provider: "github" | "google") => {
    setErrorMessage(null);
    setSocialLoading(provider);

    try {
      const activeProvider = provider === "github" ? githubProvider : googleProvider;
      const result = await signInWithPopup(auth, activeProvider);
      const firebaseUser = result.user;

      if (!firebaseUser.email && !firebaseUser.githubUsername) {
        throw new Error(`Could not retrieve profile from ${provider}.`);
      }

      const isGithub = provider === "github";
      const ghUsername = firebaseUser.githubUsername;

      let userEmail =
        firebaseUser.email || (isGithub && ghUsername ? `${ghUsername}@users.noreply.github.com` : "");
      if (!userEmail) {
        userEmail = `user-${Date.now()}@secura.security`;
      }

      let userName = firebaseUser.displayName;
      if (isGithub) {
        if (!userName || userName.includes("@users.noreply.github.com") || userName.includes("@")) {
          userName = ghUsername || (userEmail.includes("@") ? userEmail.split("@")[0] : "Developer");
        }
      } else {
        if (!userName || userName.includes("@")) {
          userName = firebaseUser.displayName || (userEmail.includes("@") ? userEmail.split("@")[0] : "Google User");
        }
      }

      const userAvatar =
        firebaseUser.photoURL ||
        (isGithub && ghUsername ? `https://github.com/${ghUsername}.png` : undefined);

      const res = await api.oauthSignIn(
        provider,
        userEmail,
        userName,
        userAvatar,
        isGithub
          ? {
              username: ghUsername,
              profileUrl: firebaseUser.githubProfileUrl,
              reposCount: firebaseUser.githubReposCount,
            }
          : undefined
      );

      if (res.success) {
        handlePostAuthSuccess(provider);
      } else {
        setErrorMessage(res.error || `Authentication succeeded with ${provider}, but dashboard sync failed.`);
      }
    } catch (fbErr: unknown) {
      const err = fbErr as { code?: string; message?: string };
      if (err?.code === "auth/popup-closed-by-user") {
        setErrorMessage("Sign-in popup was closed before completion.");
        return;
      }
      if (err?.code === "auth/unauthorized-domain") {
        setErrorMessage("Firebase Error: localhost domain must be added to Authorized Domains in Firebase Console.");
        return;
      }
      setErrorMessage(err?.message || "Could not authenticate. Please verify network connectivity.");
    } finally {
      setSocialLoading(null);
    }
  };

  // Handle SSO / Email Form
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailClean = email.trim().toLowerCase();
    if (!emailClean || !emailClean.includes("@")) {
      setErrorMessage("Please enter a valid work email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setFormLoading(true);

    try {
      if (mode === "login") {
        try {
          await signInWithEmailAndPassword(auth, emailClean, password);
        } catch {
          // fallback
        }
        const res = await api.login(emailClean, password);
        if (res.success) {
          handlePostAuthSuccess("local");
        } else {
          setErrorMessage(res.error || "Invalid email or password.");
        }
      } else {
        try {
          await createUserWithEmailAndPassword(auth, emailClean, password);
        } catch {
          // fallback
        }
        const res = await api.register(emailClean, password, name.trim());
        if (res.success) {
          handlePostAuthSuccess("local");
        } else {
          setErrorMessage(res.error || "Registration failed.");
        }
      }
    } catch {
      setErrorMessage("Network error occurred. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-white dark:bg-[#111113] flex flex-col lg:flex-row overflow-x-hidden selection:bg-[#281C59] selection:text-white">
      {/* Top Left Brand Badge */}
      <Link
        href="/"
        className="absolute top-5 left-6 z-30 flex items-center gap-2.5 group"
        title="Secura Home"
      >
        <img
          src="/logo.png"
          alt="Secura"
          className="h-8 w-8 rounded-xl object-cover shadow-sm ring-1 ring-white/20 group-hover:scale-105 transition-transform"
        />
        <span className="text-base font-bold tracking-tight text-white drop-shadow-sm">
          Secura
        </span>
      </Link>

      {/* Top Right Utilities: Theme Toggle (with circular burst on click) + Back to Home */}
      <div className="absolute top-5 right-6 z-30 flex items-center gap-3">
        <button
          onClick={(e) => toggleTheme(e)}
          suppressHydrationWarning
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-black/40 backdrop-blur-md text-zinc-300 hover:text-white hover:border-white/40 transition-colors cursor-pointer"
          aria-label="Toggle theme"
          title="Toggle theme (Circular burst)"
        >
          <Sun className="hidden dark:block h-4 w-4 text-amber-400" />
          <Moon className="block dark:hidden h-4 w-4 text-white" />
        </button>

        <Link
          href="/"
          className="text-xs text-zinc-300 hover:text-white transition-colors flex items-center gap-1 font-medium bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/30"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* ─── LEFT COLUMN: Interactive <MoltenMetal /> Background + Secura Copy ─── */}
      <div className="relative flex-1 lg:flex-[1.25] flex flex-col items-center justify-center px-6 sm:px-12 py-20 lg:py-0 overflow-hidden bg-[#111113] select-none">
        {/* React Bits MoltenMetal Canvas Background */}
        <div className="absolute inset-0 z-0 pointer-events-auto">
          <MoltenMetal
            colors={['#281C59', '#5227FF', '#7C3AED', '#3B82F6', '#FF9FFC']}
            coreColor="#FFFFFF"
            speed={0.35}
            scale={3.6}
            detail={3}
            glow={1.6}
            thickness={1}
            swirl={1.1}
            turbulence={0.25}
            haze={0.7}
            brightness={1.3}
            colorMode="molten"
            mouseInteraction={true}
            mouseStrength={0.55}
            flareOnClick={true}
            dpr={2}
          />
        </div>

        {/* Soft readable vignette layer over canvas */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/75 via-black/45 to-black/65 backdrop-blur-[1px] pointer-events-none" />

        {/* Secura Authentic Headline */}
        <div className="relative z-10 max-w-xl text-center px-4">
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white leading-[1.2] drop-shadow-md">
            You&apos;re 2 clicks away from shipping higher-quality code.
          </h1>
        </div>
      </div>

      {/* ─── RIGHT COLUMN: Auth Panel (Matching CodeRabbit Sign In Reference) ────── */}
      <div className="w-full lg:w-[460px] xl:w-[480px] flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-screen lg:min-h-0 bg-white dark:bg-[#111113] text-slate-900 dark:text-zinc-100 border-l border-slate-200/90 dark:border-zinc-800/80 shadow-2xl dark:shadow-none">
        <div className="my-auto max-w-sm w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {mode === "login" ? "Sign into Secura" : "Create your Secura account"}
            </h2>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-5 rounded-xl p-3 text-xs flex items-start gap-2.5 animate-in fade-in border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <p className="flex-1 leading-snug">{errorMessage}</p>
            </div>
          )}

          {!showSSO ? (
            /* ── Provider Stack: ONLY GitHub & Google with Last used badge + chevron down ── */
            <div className="space-y-3">
              {[
                { key: "github" as const, label: "GitHub Cloud", Icon: GithubIcon },
                { key: "google" as const, label: "Google Cloud", Icon: GoogleIcon },
              ].map(({ key, label, Icon }) => (
                <div key={key} className="relative">
                  {mounted && lastUsedProvider === key && (
                    <span
                      className="absolute -top-2.5 right-6 px-1.5 py-0.5 text-[10px] font-sans font-medium bg-white dark:bg-[#111113] border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 rounded leading-none select-none z-10 shadow-xs"
                      title="Last used on this computer"
                    >
                      Last used
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={socialLoading !== null}
                    onClick={() => handleOAuth(key)}
                    suppressHydrationWarning
                    className="w-full h-11 px-4 rounded-lg border flex items-center justify-between cursor-pointer shadow-xs disabled:opacity-50 text-left border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:bg-slate-50 dark:hover:bg-zinc-800/80 text-slate-800 dark:text-zinc-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {socialLoading === key ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#281C59] dark:text-zinc-400" />
                      ) : (
                        <Icon className="h-4.5 w-4.5 shrink-0 text-slate-900 dark:text-white fill-current" />
                      )}
                      <span className="font-semibold text-xs text-slate-900 dark:text-zinc-200">
                        {label}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                  </button>
                </div>
              ))}
            </div>

              {/* Divider: or */}
              <div className="relative flex items-center justify-center py-2">
                <div className="border-t w-full border-slate-200 dark:border-zinc-800" />
                <span className="px-3 text-[11px] font-sans bg-white dark:bg-[#111113] text-slate-400 dark:text-zinc-500">
                  or
                </span>
                <div className="border-t w-full border-slate-200 dark:border-zinc-800" />
              </div>

              {/* Single Sign-On Button */}
              <button
                type="button"
                onClick={() => setShowSSO(true)}
                className="w-full h-11 px-4 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-700 dark:text-zinc-200 transition-colors"
              >
                <Key className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
                <span>Single Sign-On</span>
              </button>
            </div>
          ) : (
            /* ── Work Email Form (Clean White & Dark Theme) ── */
            <form onSubmit={handleEmailAuth} className="space-y-3.5 animate-in fade-in duration-150">
              {mode === "signup" && (
                <div>
                  <label htmlFor="auth-fullname" className="block text-[11px] font-medium mb-1 text-slate-700 dark:text-zinc-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                    <input
                      id="auth-fullname"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full h-10 rounded-xl border pl-8.5 pr-3 text-xs outline-none border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-[#281C59] dark:focus:border-[#5227FF] focus:ring-1 focus:ring-[#281C59]/20"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-[11px] font-medium mb-1 text-slate-700 dark:text-zinc-300">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="developer@company.com"
                    className="w-full h-10 rounded-xl border pl-8.5 pr-3 text-xs outline-none border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-[#281C59] dark:focus:border-[#5227FF] focus:ring-1 focus:ring-[#281C59]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-[11px] font-medium mb-1 text-slate-700 dark:text-zinc-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-10 rounded-xl border pl-8.5 pr-9 text-xs outline-none border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-[#281C59] dark:focus:border-[#5227FF] focus:ring-1 focus:ring-[#281C59]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full h-10 rounded-xl font-semibold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1 bg-[#281C59] hover:bg-[#281C59]/90 text-white"
              >
                {formLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <span>
                    {mode === "login"
                      ? "Sign In to Secura"
                      : "Create Secura Developer Account"}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowSSO(false)}
                className="w-full text-center text-xs cursor-pointer pt-1 font-medium text-slate-500 dark:text-zinc-400 hover:text-[#281C59] dark:hover:text-white"
              >
                ← Back to GitHub & Google sign-in
              </button>
            </form>
          )}

          {/* Switcher: New to Secura? Sign up (Matching Reference with Orange highlight) */}
          <div className="mt-8 text-center text-xs text-slate-500 dark:text-zinc-400">
            {mode === "login" ? (
              <span>
                New to Secura?{" "}
                <Link
                  href="/signup"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode("signup");
                    setShowSSO(false);
                    setErrorMessage(null);
                  }}
                  className="font-semibold cursor-pointer hover:underline text-[#f97316] dark:text-[#f97316]"
                >
                  Sign up
                </Link>
              </span>
            ) : (
              <span>
                Already have a Secura account?{" "}
                <Link
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode("login");
                    setShowSSO(false);
                    setErrorMessage(null);
                  }}
                  className="font-semibold cursor-pointer hover:underline text-[#f97316] dark:text-[#f97316]"
                >
                  Sign in
                </Link>
              </span>
            )}
          </div>
        </div>

        {/* Legal Disclaimer at Bottom (Matching Reference with Orange links) */}
        <div className="pt-8 text-center text-[11px] leading-relaxed max-w-sm mx-auto text-slate-400 dark:text-zinc-500">
          By continuing, you agree to the{" "}
          <a href="#" className="hover:underline font-medium text-[#f97316] dark:text-[#f97316]">
            Terms of Use
          </a>{" "}
          and{" "}
          <a href="#" className="hover:underline font-medium text-[#f97316] dark:text-[#f97316]">
            Privacy Policy
          </a>
          .
        </div>
      </div>
    </div>
  );
}
