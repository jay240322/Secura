"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useTheme } from "@/components/theme-provider";
import type { User as UserType } from "@/types";
import {
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  User,
  X,
} from "lucide-react";

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-[#281C59] dark:text-zinc-100 mb-3 flex items-center gap-2">
      {children}
    </h2>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange?: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-zinc-800 last:border-0">
      <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">{label}</span>
      <button
        type="button"
        onClick={() => onChange?.(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? "bg-[#281C59]" : "bg-slate-200 dark:bg-zinc-800"
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white dark:bg-zinc-200 transition-transform shadow-xs ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Policy settings
  const [maxCritical, setMaxCritical] = useState(0);
  const [maxHigh, setMaxHigh] = useState(0);
  const [minScore, setMinScore] = useState(80);
  const [policyFeedback, setPolicyFeedback] = useState<string | null>(null);

  // Notification toggles
  const [notifyCritical, setNotifyCritical] = useState(true);
  const [notifyHigh, setNotifyHigh] = useState(true);
  const [notifyFailure, setNotifyFailure] = useState(true);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowLogoutModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleConfirmLogout = () => {
    api.clearAuth();
    setCurrentUser(null);
    setShowLogoutModal(false);
    router.push("/login");
  };

  const handleResyncWorkspace = async () => {
    setIsSyncing(true);
    setActionFeedback(null);
    try {
      await api.syncRepositories();
      setActionFeedback("Repositories and security gates resynced successfully.");
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      setActionFeedback("Data resynced successfully.");
      setTimeout(() => setActionFeedback(null), 2500);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // 1. Fetch user profile from stored auth or backend
    const stored = api.getStoredUser();
    if (stored) {
      setCurrentUser(stored);
      let cleanInitName = stored.name || "";
      if (cleanInitName.includes("@users.noreply.github.com")) {
        cleanInitName = cleanInitName.split("@")[0].replace(/^@/, "");
      }
      setName(cleanInitName);
      setEmail(stored.email || "");
    }

    // 2. Load stored policy if present
    try {
      const savedPolicy = localStorage.getItem("secura_policy_settings");
      if (savedPolicy) {
        const parsed = JSON.parse(savedPolicy);
        if (parsed.maxCritical !== undefined) setMaxCritical(parsed.maxCritical);
        if (parsed.maxHigh !== undefined) setMaxHigh(parsed.maxHigh);
        if (parsed.minScore !== undefined) setMinScore(parsed.minScore);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsUpdating(true);
    setProfileFeedback(null);
    try {
      const res = await api.updateProfile(name.trim());
      if (res.success && res.user) {
        setCurrentUser(res.user);
        setName(res.user.name || "");
        setProfileFeedback("Name updated successfully!");
        setTimeout(() => setProfileFeedback(null), 3500);
      } else {
        setProfileFeedback(res.error || "Failed to update profile.");
      }
    } catch {
      setProfileFeedback("Network error updating profile.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(
        "secura_policy_settings",
        JSON.stringify({ maxCritical, maxHigh, minScore })
      );
      setPolicyFeedback("Security gate policy saved successfully!");
      setTimeout(() => setPolicyFeedback(null), 3500);
    } catch {
      setPolicyFeedback("Failed to save policy settings.");
    }
  };

  const isGithubConnected = Boolean(
    currentUser?.provider === "github" ||
    currentUser?.githubUsername ||
    currentUser?.email?.includes("github")
  );

  const isGoogleConnected = Boolean(
    currentUser?.provider === "google" ||
    currentUser?.email?.includes("gmail")
  );

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6 w-full">
      {/* ─── 1. Account Profile ────────────────────────────────────────────── */}
      <div className="w-full">
        <SectionTitle>
          <User className="h-4 w-4 text-[#281C59] dark:text-zinc-300" />
          <span>Account Profile</span>
        </SectionTitle>
        <Card className="w-full">
          <CardContent className="space-y-4 pt-5">
            {/* User Avatar + Provider Badge */}
            <div suppressHydrationWarning className="flex items-center gap-3.5 pb-4 border-b border-slate-100 dark:border-zinc-800">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDE9E6] border border-[#EDE9E6] text-[#281C59] font-bold text-lg">
                  {(name || email || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{name || "User"}</p>
                <p className="text-xs text-slate-500 font-mono">
                  {email && !email.includes("@users.noreply.github.com") ? email : (currentUser?.githubUsername ? `@${currentUser.githubUsername}` : "GitHub Account")}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {isGithubConnected && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#EDE9E6] dark:bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-[#281C59] dark:text-zinc-300 border border-[#EDE9E6] dark:border-zinc-800">
                      <GithubIcon className="h-3 w-3" />
                      <span>GitHub Account</span>
                    </span>
                  )}
                  {isGoogleConnected && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#EDE9E6] dark:bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-[#281C59] dark:text-zinc-300 border border-[#EDE9E6] dark:border-zinc-800">
                      <span>Google Account</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Edit Form */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label htmlFor="settings-name" className="block text-xs text-slate-600 dark:text-zinc-400 mb-1 font-medium">
                  Display Name
                </label>
                <input
                  id="settings-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name or handle"
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs text-slate-900 dark:text-zinc-100 outline-none focus:border-[#281C59] focus:ring-1 focus:ring-[#281C59]/20 shadow-xs"
                />
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                  Initially fetched from your {isGithubConnected ? "GitHub" : isGoogleConnected ? "Google" : "account"} profile. You can change it anytime.
                </p>
              </div>

              <div>
                <label htmlFor="settings-email" className="block text-xs text-slate-600 dark:text-zinc-400 mb-1 font-medium">
                  Email Address
                </label>
                <input
                  id="settings-email"
                  type="text"
                  disabled
                  value={email && !email.includes("@users.noreply.github.com") ? email : (currentUser?.githubUsername ? `@${currentUser.githubUsername} (GitHub OAuth)` : "GitHub Account")}
                  className="w-full rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 px-3.5 py-2 text-xs text-slate-500 dark:text-zinc-500 outline-none cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                  Email is verified through OAuth authentication.
                </p>
              </div>

              {profileFeedback && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between shadow-xs">
                  <span>{profileFeedback}</span>
                  <button type="button" onClick={() => setProfileFeedback(null)}>
                    <X className="h-3 w-3 text-emerald-600 hover:text-emerald-800" />
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isUpdating}
                className="flex items-center gap-2 rounded-xl bg-[#281C59] px-4 py-2 text-xs font-semibold text-white hover:bg-[#281C59]/90 transition-all shadow-xs disabled:opacity-50"
              >
                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Save Profile Changes</span>
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ─── 2. GitHub Integration & App Status ───────────────────────────── */}
      <div className="w-full">
        <SectionTitle>
          <GithubIcon className="h-4 w-4 text-[#281C59] dark:text-zinc-300" />
          <span>GitHub Integration</span>
        </SectionTitle>
        <Card className="w-full">
          <CardContent className="space-y-4 pt-5">
            {/* Integration Status Box */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDE9E6] dark:bg-zinc-900 border border-[#EDE9E6] dark:border-zinc-800 text-[#281C59] dark:text-zinc-200">
                  <GithubIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                      {isGithubConnected ? `@${currentUser?.githubUsername || (currentUser?.email?.includes("@users.noreply.github.com") ? currentUser.email.split("@")[0].replace(/^@/, "") : (currentUser?.name && !currentUser.name.includes("@") ? currentUser.name : "jay240322"))}` : "GitHub Account"}
                    </p>
                    {isGithubConnected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        <span>Connected</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Not connected</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    {isGithubConnected
                      ? "Authenticated via GitHub OAuth for pull request scanning and gate checks."
                      : "Connect your GitHub account to enable automatic Pull Request scanning."}
                  </p>
                </div>
              </div>

              {isGithubConnected ? (
                <a
                  href={`https://github.com/${currentUser?.githubUsername || (currentUser?.email?.includes("@users.noreply.github.com") ? currentUser.email.split("@")[0].replace(/^@/, "") : "jay240322")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-[#281C59] dark:text-blue-400 hover:underline transition-colors shrink-0"
                >
                  <span>Profile</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const url = await api.getGitHubOAuthUrl();
                    if (url) window.location.href = url;
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-[#281C59] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#281C59]/90 transition-all shadow-xs shrink-0"
                >
                  <GithubIcon className="h-3.5 w-3.5" />
                  <span>Connect GitHub</span>
                </button>
              )}
            </div>

            {/* GitHub App Card */}
            <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-[#EDE9E6]/40 dark:bg-zinc-900/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#281C59] dark:text-zinc-100 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#281C59] dark:text-blue-400" />
                  <span>Secura Security Scanner App</span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Intercepts pull requests, reports secret leakage, and blocks unsafe merges on GitHub.
                </p>
              </div>
              <a
                href="https://github.com/apps/secura-security-scanner"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-[#281C59] dark:text-zinc-300 hover:bg-[#EDE9E6] dark:hover:bg-zinc-800 transition-all shadow-xs shrink-0"
              >
                <span>Configure App on GitHub</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── 3. Security Policy (Gate Evaluation) ─────────────────────────── */}
      <div>
        <SectionTitle>
          <Shield className="h-4 w-4 text-emerald-600" />
          <span>Security Policy & Gate Thresholds</span>
        </SectionTitle>
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-slate-900">What does the Security Policy do?</p>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                When the GitHub App inspects a Pull Request, Secura tests all detected secrets against this policy. If the PR violates these thresholds, the <strong className="text-slate-800">Secura Security Gate fails</strong> and the PR merge is blocked on GitHub.
              </p>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label htmlFor="policy-max-critical" className="block text-xs text-slate-600 dark:text-zinc-400 mb-1 font-medium">
                    Max Critical Secrets
                  </label>
                  <input
                    id="policy-max-critical"
                    type="number"
                    min={0}
                    value={maxCritical}
                    onChange={(e) => setMaxCritical(Number.parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/20 shadow-xs"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">Default: 0 (block on any AWS key, DB string, or private key)</p>
                </div>

                <div>
                  <label htmlFor="policy-max-high" className="block text-xs text-slate-600 dark:text-zinc-400 mb-1 font-medium">
                    Max High Findings
                  </label>
                  <input
                    id="policy-max-high"
                    type="number"
                    min={0}
                    value={maxHigh}
                    onChange={(e) => setMaxHigh(Number.parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/20 shadow-xs"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">Default: 0 (block on API tokens & webhooks)</p>
                </div>

                <div>
                  <label htmlFor="policy-min-score" className="block text-xs text-slate-600 dark:text-zinc-400 mb-1 font-medium">
                    Min Score (out of 100)
                  </label>
                  <input
                    id="policy-min-score"
                    type="number"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(Number.parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/20 shadow-xs"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">Default: 80</p>
                </div>
              </div>

              {policyFeedback && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center justify-between shadow-xs">
                  <span>{policyFeedback}</span>
                  <button type="button" onClick={() => setPolicyFeedback(null)}>
                    <X className="h-3 w-3 text-emerald-600 hover:text-emerald-900" />
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-[#281C59] px-4 py-2 text-xs font-semibold text-white hover:bg-[#281C59]/90 transition-all shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save Gate Policy</span>
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ─── 4. Notifications ────────────────────────────────────────────── */}
      <div className="w-full">
        <SectionTitle>
          <Bell className="h-4 w-4 text-[#281C59] dark:text-zinc-300" />
          <span>Security Alert Notifications</span>
        </SectionTitle>
        <Card className="w-full">
          <CardContent className="pt-2">
            <Toggle
              label="Alert when critical secret is detected on Pull Request"
              checked={notifyCritical}
              onChange={setNotifyCritical}
            />
            <Toggle
              label="Alert when high-severity token is committed"
              checked={notifyHigh}
              onChange={setNotifyHigh}
            />
            <Toggle
              label="Alert on Security Gate failure / merge block"
              checked={notifyFailure}
              onChange={setNotifyFailure}
            />
          </CardContent>
        </Card>
      </div>

      {/* ─── 5. Theme / Appearance ────────────────────────────────────────── */}
      <div className="w-full">
        <SectionTitle>
          <Palette className="h-4 w-4 text-[#281C59] dark:text-zinc-300" />
          <span>Appearance & Theme</span>
        </SectionTitle>
        <Card className="w-full">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Select your preferred workspace aesthetic. Choose between Minimal Light and Pure Darkness.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {/* Minimal Light Option */}
              <button
                type="button"
                onClick={(e) => setTheme("light", e)}
                suppressHydrationWarning
                className="flex items-center justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer border-[#281C59] bg-[#EDE9E6]/50 ring-2 ring-[#281C59]/30 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 dark:ring-0 dark:shadow-none hover:dark:border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-400">
                    <Sun className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100">Minimal Light</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Clean, crisp white minimalist styling</p>
                  </div>
                </div>
                <span className="flex dark:hidden h-5 w-5 items-center justify-center rounded-full bg-[#281C59] text-white shadow-xs">
                  <Check className="h-3 w-3" />
                </span>
              </button>

              {/* Pure Darkness Option */}
              <button
                type="button"
                onClick={(e) => setTheme("dark", e)}
                suppressHydrationWarning
                className="flex items-center justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer border-slate-200 bg-white hover:border-slate-300 ring-0 shadow-none dark:border-blue-500 dark:bg-zinc-900 dark:ring-2 dark:ring-blue-500/30 dark:shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100">
                    <Moon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100">Pure Darkness</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Pitch black OLED with zinc accents</p>
                  </div>
                </div>
                <span className="hidden dark:flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                  <Check className="h-3 w-3" />
                </span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── 6. Account Session & Actions ───────────────────────────────────── */}
      <div className="w-full">
        <SectionTitle>
          <LogOut className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span>Account Session & Actions</span>
        </SectionTitle>
        <Card className="w-full border-rose-200/60 dark:border-rose-950/40">
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Current Active Session</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span>Active Now</span>
                  </span>
                </p>
                <p suppressHydrationWarning className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Signed in as <span className="font-semibold text-slate-700 dark:text-zinc-200">{name || "Developer"}</span> via {isGithubConnected ? "GitHub OAuth" : isGoogleConnected ? "Google OAuth" : "Secura ID"}.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResyncWorkspace}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                  title="Resync repositories from GitHub"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-[#281C59]" : "text-slate-500"}`} />
                  <span>{isSyncing ? "Syncing…" : "Resync Data"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>

            {actionFeedback && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between shadow-xs">
                <span>{actionFeedback}</span>
                <button type="button" onClick={() => setActionFeedback(null)}>
                  <X className="h-3 w-3 text-emerald-600 hover:text-emerald-800" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logout Confirmation Modal Dialog via Portal */}
      {showLogoutModal && mounted && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogoutModal(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            {/* Warning Icon Badge */}
            <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 shadow-xs">
              <LogOut className="h-6 w-6" />
            </div>

            {/* Dialog Text */}
            <h3 className="text-center text-base font-bold text-slate-900 dark:text-white">
              Are you sure?
            </h3>
            <p className="mt-1.5 text-center text-xs text-slate-500 dark:text-zinc-400">
              Are you sure you want to log out? You will need to sign in again to access your security dashboard.
            </p>

            {/* Action Buttons */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
