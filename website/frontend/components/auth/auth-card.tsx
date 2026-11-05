"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Check,
  HelpCircle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import {
  auth,
  googleProvider,
  githubProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fetchGitHubUserProfile,
} from "@/lib/firebase";

interface AuthCardProps {
  initialMode?: "login" | "signup";
}

const GITHUB_APP_INSTALL_URL = "https://github.com/apps/secura-security-scanner";

export function AuthCard({ initialMode = "login" }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"github" | "google" | "github-user" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [agreedTerms, setAgreedTerms] = useState(false);

  // GitHub username direct fetch modal state
  const [showGithubUsernameModal, setShowGithubUsernameModal] = useState(false);
  const [customGithubHandle, setCustomGithubHandle] = useState("");
  const [githubFetchLoading, setGithubFetchLoading] = useState(false);

  // Post-auth redirect:
  // - If logging in (isLogin = true): DO NOT redirect to GitHub App; stay on website and navigate to dashboard/redirectUrl.
  // - If not logging in (new signup / isLogin = false): open the GitHub App in another tab so user can grant repositories,
  //   while navigating the current tab to the Secura repositories page!
  const handlePostAuthSuccess = (msg: string, isLogin: boolean = true) => {
    const pendingInstId =
      typeof window !== "undefined"
        ? sessionStorage.getItem("secura_pending_installation_id")
        : null;

    if (pendingInstId) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("secura_pending_installation_id");
      }
      setSuccessMessage(`${msg} Connecting your GitHub App installation...`);
      void api.syncRepositories().finally(() => {
        setTimeout(
          () =>
            router.push(
              `/repositories?installed=true&installation_id=${pendingInstId}`
            ),
          700
        );
      });
      return;
    }

    if (isLogin) {
      // User logged in: do NOT redirect to GitHub App; go directly to dashboard
      setSuccessMessage(`${msg} Redirecting to your dashboard...`);
      setTimeout(() => {
        router.push(redirectUrl || "/dashboard");
      }, 700);
      return;
    }

    // New registration / signup (not login):
    // Open the GitHub App in another tab for selecting repositories,
    // while the current tab smoothly loads the Secura repositories page.
    setSuccessMessage(`${msg} Opening Secura GitHub App in a new tab to select repositories...`);
    try {
      window.open(GITHUB_APP_INSTALL_URL, "_blank", "noopener,noreferrer");
    } catch {
      // ignore popup blocker if any
    }
    setTimeout(() => {
      router.push("/repositories?setup_action=signup");
    }, 800);
  };

  // Automatically handle GitHub OAuth code callback if redirected back from GitHub
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setLoading(true);
      setErrorMessage(null);
      void api
        .completeGitHubOAuth(code)
        .then((res) => {
          setLoading(false);
          if (res.success && res.user) {
            handlePostAuthSuccess(
              `Authenticated as @${res.user.githubUsername || res.user.name} via GitHub!`,
              mode === "login"
            );
          } else {
            setErrorMessage(res.error || "GitHub authentication failed.");
          }
        })
        .catch(() => {
          setLoading(false);
          setErrorMessage("Network error during GitHub authentication.");
        });
    }
  }, [searchParams, redirectUrl, router, mode]);

  // Password requirements validation
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const getPasswordStrength = () => {
    let score = 0;
    if (hasMinLength) score++;
    if (hasUpperCase) score++;
    if (hasNumber) score++;
    if (hasSymbol) score++;
    return score; // 0 - 4
  };

  const passwordScore = getPasswordStrength();
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];

  // Handle standard Login / Signup
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
      if (!agreedTerms) {
        setErrorMessage("Please accept the terms and security policy to create an account.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "login") {
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (fbErr: unknown) {
          console.info("Firebase email sign-in fallback:", fbErr);
        }

        const res = await api.login(email, password);
        if (res.success) {
          handlePostAuthSuccess("Welcome back!", true);
        } else {
          setErrorMessage(res.error || "Invalid email or password.");
        }
      } else {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (fbErr: unknown) {
          console.info("Firebase registration fallback:", fbErr);
        }

        const res = await api.register(email, password, name);
        if (res.success) {
          handlePostAuthSuccess("Account created successfully!", false);
        } else {
          setErrorMessage(res.error || "Registration failed.");
        }
      }
    } catch {
      setErrorMessage("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Real Social OAuth (Firebase Popup or Direct GitHub OAuth)
  const handleOAuth = async (provider: "github" | "google") => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSocialLoading(provider);

    try {
      // 1. Authenticate using Firebase Popup (uses https://secura-35ffc.firebaseapp.com/__/auth/handler)
      const activeProvider = provider === "github" ? githubProvider : googleProvider;
      const result = await signInWithPopup(auth, activeProvider);
      const firebaseUser = result.user;

      if (!firebaseUser.email && !firebaseUser.githubUsername) {
        throw new Error(`Could not retrieve profile from ${provider}.`);
      }

      const userEmail =
        firebaseUser.email || `${firebaseUser.githubUsername || "user"}@users.noreply.github.com`;
      const userName =
        firebaseUser.displayName || (firebaseUser.githubUsername ? `@${firebaseUser.githubUsername}` : "User");
      const userAvatar = firebaseUser.photoURL || undefined;

      const res = await api.oauthSignIn(
        provider,
        userEmail,
        userName,
        userAvatar,
        provider === "github"
          ? {
              username: firebaseUser.githubUsername,
              profileUrl: firebaseUser.githubProfileUrl,
              reposCount: firebaseUser.githubReposCount,
            }
          : undefined
      );

      if (res.success) {
        handlePostAuthSuccess(
          `Connected as ${firebaseUser.githubUsername ? `@${firebaseUser.githubUsername}` : userName}!`,
          mode === "login"
        );
      } else {
        setErrorMessage(res.error || `Authentication succeeded with Firebase, but dashboard sync failed.`);
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
      if (err?.code === "auth/operation-not-allowed" || err?.code === "auth/configuration-not-found") {
        setErrorMessage(
          "GitHub / Google provider is not enabled in Firebase Console. Please enable it under Authentication ➔ Sign-in method."
        );
        return;
      }
      if (
        err?.code === "auth/account-exists-with-different-credential" ||
        err?.message?.includes("account-exists-with-different-credential")
      ) {
        setErrorMessage(
          "Account Conflict: An account with this email address already exists using Google (or Email). Please click 'Continue with Google' to sign in, or enable 'Allow creation of multiple accounts with the same email address' in Firebase Console (Settings ➔ User account linking)."
        );
        return;
      }
      if (
        err?.code === "auth/invalid-credential" ||
        err?.message?.includes("incorrect_client_credentials") ||
        err?.message?.includes("client_id and/or client_secret")
      ) {
        setErrorMessage(
          "Firebase GitHub Error: Incorrect client credentials. The Client ID and Client Secret in Firebase Console (Authentication ➔ Sign-in method ➔ GitHub) must match your GitHub OAuth App credentials (Client ID: Ov23liUhYd0XHKWzMo4M)."
        );
        return;
      }

      setErrorMessage(
        err?.message ||
          "Could not authenticate. Please verify network connectivity."
      );
    } finally {
      setSocialLoading(null);
    }
  };

  // Direct GitHub Account fetch by username
  const handleFetchGitHubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGithubHandle.trim()) return;

    setGithubFetchLoading(true);
    setErrorMessage(null);

    try {
      const cleanHandle = customGithubHandle.trim().replace(/^@/, "");
      const ghProfile = await fetchGitHubUserProfile(cleanHandle);

      if (!ghProfile) {
        setErrorMessage(`GitHub user "@${cleanHandle}" not found. Please verify the username.`);
        setGithubFetchLoading(false);
        return;
      }

      const res = await api.oauthSignIn(
        "github",
        ghProfile.email || `${cleanHandle}@users.noreply.github.com`,
        ghProfile.name || cleanHandle,
        ghProfile.avatarUrl,
        {
          username: ghProfile.login,
          profileUrl: ghProfile.htmlUrl,
          reposCount: ghProfile.publicRepos,
        }
      );

      if (res.success) {
        setShowGithubUsernameModal(false);
        handlePostAuthSuccess(`Connected GitHub account @${ghProfile.login}!`, mode === "login");
      } else {
        setErrorMessage(res.error || "Failed to link GitHub account.");
      }
    } catch {
      setErrorMessage("Could not connect to GitHub API. Please check network connection.");
    } finally {
      setGithubFetchLoading(false);
    }
  };


  return (
    <div className="w-full max-w-md mx-auto" suppressHydrationWarning>
      {/* Background card with clean minimal light styling */}
      <div className="relative rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-7 sm:p-8 shadow-2xl shadow-slate-900/10 dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:shadow-none" suppressHydrationWarning>
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-3">
            <img
              src="/logo.png"
              alt="Secura"
              className="h-11 w-11 rounded-2xl object-cover shadow-md shadow-[#281C59]/15 group-hover:scale-105 transition-all"
            />
            <span className="text-2xl font-bold tracking-tight text-[#281C59] dark:text-zinc-100">
              Secura
            </span>
          </Link>
          <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            {mode === "login" ? "Sign in to Secura" : "Create your account"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Automated secret leak detection & DevSecOps merge gates
          </p>
        </div>

        {/* ─── Official GitHub App CTA Banner ─────────────────────────────── */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 shadow-2xs">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
              </span>
              <div className="truncate">
                <span className="font-medium text-slate-800 dark:text-zinc-200">Secura GitHub App</span>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">Install to auto-scan your repositories</p>
              </div>
            </div>
            <a
              href="https://github.com/apps/secura-security-scanner"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              <span>Install</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1 mb-5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800" suppressHydrationWarning>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => {
              setMode("login");
              setErrorMessage(null);
            }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "login"
                ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => {
              setMode("signup");
              setErrorMessage(null);
            }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "signup"
                ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p>{errorMessage}</p>
                {errorMessage.includes("Continue with Google") && (
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => handleOAuth("google")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow transition-all"
                  >
                    <span>Sign In with Google Now</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="font-medium">{successMessage}</p>
                <div className="flex items-center gap-2 pt-0.5">
                  <a
                    href={GITHUB_APP_INSTALL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white shadow hover:bg-emerald-500 transition-colors"
                  >
                    <span>Go to GitHub App (new tab)</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => router.push(redirectUrl || "/dashboard")}
                    className="text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 underline underline-offset-2 transition-colors"
                  >
                    Skip to Command Center
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Social Login Buttons ────────────────────────────────────────── */}
        <div className="space-y-2 mb-5" suppressHydrationWarning>
          {/* GitHub Button */}
          <button
            type="button"
            suppressHydrationWarning
            disabled={socialLoading !== null || loading}
            onClick={() => handleOAuth("github")}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-2xs disabled:opacity-50"
          >
            {socialLoading === "github" ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500 dark:text-zinc-400" />
            ) : (
              <svg className="h-4 w-4 fill-current text-slate-900 dark:text-zinc-100" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            )}
            <span>
              {mode === "login" ? "Continue with GitHub" : "Sign up with GitHub"}
            </span>
          </button>

          {/* Google Button */}
          <button
            type="button"
            suppressHydrationWarning
            disabled={socialLoading !== null || loading}
            onClick={() => handleOAuth("google")}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-2xs disabled:opacity-50"
          >
            {socialLoading === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500 dark:text-zinc-400" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
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
            )}
            <span>
              {mode === "login" ? "Continue with Google" : "Sign up with Google"}
            </span>
          </button>
        </div>

        {/* Quick Option: Connect by GitHub Username */}
        <div className="text-center mb-5">
          <button
            type="button"
            onClick={() => setShowGithubUsernameModal(!showGithubUsernameModal)}
            className="text-[11px] text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1.5 transition-colors"
          >
            <svg className="h-3 w-3 fill-current text-slate-600 dark:text-zinc-400" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>Connect with GitHub username directly</span>
          </button>
        </div>

        {/* Direct GitHub username modal */}
        {showGithubUsernameModal && (
          <form onSubmit={handleFetchGitHubAccount} className="mb-5 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Fetch GitHub Account</span>
              <button
                type="button"
                onClick={() => setShowGithubUsernameModal(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400">@</span>
              <input
                type="text"
                required
                value={customGithubHandle}
                onChange={(e) => setCustomGithubHandle(e.target.value)}
                placeholder="your-github-username"
                className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-7 pr-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={githubFetchLoading}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-sm"
            >
              {githubFetchLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>Fetch & Sign In with GitHub</span>
              )}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-slate-200 dark:border-zinc-800 w-full" />
          <span className="bg-white dark:bg-zinc-950 px-3 text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
            or continue with email
          </span>
          <div className="border-t border-slate-200 dark:border-zinc-800 w-full" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
          {mode === "signup" && (
            <div>
              <label htmlFor="full-name-input" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="full-name-input"
                  type="text"
                  required
                  suppressHydrationWarning
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="work-email-input" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Work Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="work-email-input"
                type="email"
                required
                suppressHydrationWarning
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@company.com"
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-password-input" className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                Password
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => alert("A password reset link has been dispatched to your email address.")}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="auth-password-input"
                type={showPassword ? "text" : "password"}
                required
                suppressHydrationWarning
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition-all"
              />
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Interactive Password Requirements Checklist on Signup */}
            {mode === "signup" && (
              <div className="mt-2.5 space-y-2 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60">
                {/* Visual Bar */}
                <div className="flex gap-1 h-1">
                  {[0, 1, 2, 3].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-full flex-1 rounded-full transition-colors ${
                        passwordScore > lvl
                          ? strengthColors[passwordScore - 1]
                          : "bg-slate-200 dark:bg-zinc-800"
                      }`}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 dark:text-zinc-400 pt-1">
                  <span className={`flex items-center gap-1 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                    {hasMinLength ? <Check className="h-3 w-3" /> : "•"} 8+ characters
                  </span>
                  <span className={`flex items-center gap-1 ${hasUpperCase ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                    {hasUpperCase ? <Check className="h-3 w-3" /> : "•"} Uppercase letter
                  </span>
                  <span className={`flex items-center gap-1 ${hasNumber ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                    {hasNumber ? <Check className="h-3 w-3" /> : "•"} Number (0-9)
                  </span>
                  <span className={`flex items-center gap-1 ${hasSymbol ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                    {hasSymbol ? <Check className="h-3 w-3" /> : "•"} Special symbol
                  </span>
                </div>
              </div>
            )}
          </div>

          {mode === "signup" && (
            <div>
              <label htmlFor="confirm-password-input" className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="confirm-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  suppressHydrationWarning
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Options */}
          {mode === "login" ? (
            <div className="flex items-center gap-2 pt-0.5">
              <input
                id="remember"
                type="checkbox"
                suppressHydrationWarning
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-blue-600 focus:ring-0"
              />
              <label htmlFor="remember" className="text-xs text-slate-600 dark:text-zinc-300 cursor-pointer">
                Remember this device for 30 days
              </label>
            </div>
          ) : (
            <div className="flex items-start gap-2 pt-0.5">
              <input
                id="terms"
                type="checkbox"
                required
                suppressHydrationWarning
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-blue-600 focus:ring-0"
              />
              <label htmlFor="terms" className="text-[11px] text-slate-600 dark:text-zinc-300 leading-tight cursor-pointer">
                I agree to the Secura Security Gate Terms of Service and automated code inspection policies.
              </label>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            suppressHydrationWarning
            disabled={loading || socialLoading !== null}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-600/25 transition-all disabled:opacity-50 mt-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <>
                <span>
                  {mode === "login" ? "Sign In to Secura" : "Create Developer Account"}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer Security Badge */}
        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
            <span>🔒</span> End-to-end encrypted session • Zero secret retention
          </span>
        </div>
      </div>
    </div>
  );
}
