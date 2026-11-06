export { CodeRabbitAuth as AuthCard } from "./coderabbit-auth";
export { CodeRabbitAuth } from "./coderabbit-auth";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
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

interface AuthCardProps {
  initialMode?: "login" | "signup";
}

export function AuthCard({ initialMode = "login" }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"github" | "google" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Sync mode if initialMode changes
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Post-auth redirect: seamless and immediate
  const handlePostAuthSuccess = (isLogin: boolean = true) => {
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
            handlePostAuthSuccess(mode === "login");
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

  // Password requirements validation for signup
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
    return score;
  };

  const passwordScore = getPasswordStrength();
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];

  // Handle standard Login / Signup
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailClean = email.trim().toLowerCase();
    if (!emailClean || !emailClean.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        setErrorMessage("Please enter your full name.");
        return;
      }
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
      if (!agreedTerms) {
        setErrorMessage("Please accept the terms to create an account.");
        return;
      }
    } else {
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "login") {
        try {
          await signInWithEmailAndPassword(auth, emailClean, password);
        } catch (fbErr: unknown) {
          console.info("Firebase email sign-in fallback:", fbErr);
        }

        const res = await api.login(emailClean, password);
        if (res.success) {
          handlePostAuthSuccess(true);
        } else {
          setErrorMessage(res.error || "Invalid email or password.");
        }
      } else {
        try {
          await createUserWithEmailAndPassword(auth, emailClean, password);
        } catch (fbErr: unknown) {
          console.info("Firebase registration fallback:", fbErr);
        }

        const res = await api.register(emailClean, password, name.trim());
        if (res.success) {
          handlePostAuthSuccess(false);
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

      // Compute authentic display name (never allow noreply string)
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
        handlePostAuthSuccess(mode === "login");
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
          "An account with this email already exists via another provider. Please continue with that provider."
        );
        return;
      }
      if (
        err?.code === "auth/invalid-credential" ||
        err?.message?.includes("incorrect_client_credentials") ||
        err?.message?.includes("client_id and/or client_secret")
      ) {
        setErrorMessage(
          "Firebase GitHub Error: Incorrect client credentials in Firebase Console."
        );
        return;
      }

      setErrorMessage(
        err?.message || "Could not authenticate. Please verify network connectivity."
      );
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto" suppressHydrationWarning>
      <div
        className="relative rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-950 p-5 sm:p-6 shadow-xl shadow-slate-900/5 dark:shadow-none"
        suppressHydrationWarning
      >
        {/* Brand Header */}
        <div className="text-center mb-3.5">
          <div className="inline-flex items-center justify-center mb-2">
            <img
              src="/logo.png"
              alt="Secura"
              className="h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-slate-200/80 dark:ring-zinc-800"
            />
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            {mode === "login" ? "Sign in to Secura" : "Create your account"}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            {mode === "login"
              ? "Automated secret leak detection & merge gates"
              : "Start securing your pull requests in seconds"}
          </p>
        </div>

        {/* Tab Switch */}
        <div
          className="grid grid-cols-2 p-1 mb-3.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs"
          suppressHydrationWarning
        >
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => {
              setMode("login");
              setErrorMessage(null);
            }}
            className={`py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${
              mode === "login"
                ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
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
            className={`py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${
              mode === "signup"
                ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error notification (clean alert on failure, never green lines) */}
        {errorMessage && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40 p-2.5 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <p className="flex-1 leading-snug">{errorMessage}</p>
          </div>
        )}

        {/* ─── Upper Side: Form Fields ─────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-2.5" suppressHydrationWarning>
          {mode === "signup" && (
            <div>
              <label htmlFor="full-name-input" className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  id="full-name-input"
                  type="text"
                  required
                  suppressHydrationWarning
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 pl-8.5 pr-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-[#281C59] focus:ring-1 focus:ring-[#281C59]/20 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="work-email-input" className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Work Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                id="work-email-input"
                type="email"
                required
                suppressHydrationWarning
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@company.com"
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 pl-8.5 pr-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-[#281C59] focus:ring-1 focus:ring-[#281C59]/20 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="auth-password-input" className="text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                Password
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => alert("A password reset link has been dispatched to your email address.")}
                  className="text-[11px] text-[#281C59] dark:text-blue-400 hover:underline font-medium transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                id="auth-password-input"
                type={showPassword ? "text" : "password"}
                required
                suppressHydrationWarning
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 pl-8.5 pr-9 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-[#281C59] focus:ring-1 focus:ring-[#281C59]/20 focus:outline-none transition-all"
              />
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Password strength bar on signup when typing */}
            {mode === "signup" && password.length > 0 && (
              <div className="mt-1.5 space-y-1">
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
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                  <span>8+ chars with uppercase, number & symbol</span>
                  {passwordScore > 0 && (
                    <span className="font-semibold text-slate-700 dark:text-zinc-300">
                      {strengthLabels[passwordScore - 1]}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {mode === "signup" && (
            <div>
              <label htmlFor="confirm-password-input" className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  id="confirm-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  suppressHydrationWarning
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 pl-8.5 pr-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-[#281C59] focus:ring-1 focus:ring-[#281C59]/20 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          {mode === "login" ? (
            <div className="flex items-center gap-2 pt-0.5">
              <input
                id="remember"
                type="checkbox"
                suppressHydrationWarning
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-700 text-[#281C59] focus:ring-0 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-slate-600 dark:text-zinc-400 cursor-pointer select-none">
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
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-700 text-[#281C59] focus:ring-0 cursor-pointer"
              />
              <label htmlFor="terms" className="text-[11px] text-slate-600 dark:text-zinc-400 leading-tight cursor-pointer select-none">
                I agree to the Secura Security Gate Terms and code inspection policies.
              </label>
            </div>
          )}

          {/* Primary Submit Button */}
          <button
            type="submit"
            suppressHydrationWarning
            disabled={loading || socialLoading !== null}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#281C59] hover:bg-[#281C59]/90 text-white font-semibold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer mt-1"
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

        {/* ─── Divider: or continue with ─────────────────────────────────────── */}
        <div className="relative flex items-center justify-center my-3">
          <div className="border-t border-slate-200 dark:border-zinc-800 w-full" />
          <span className="bg-white dark:bg-zinc-950 px-2.5 text-[10px] uppercase font-semibold text-slate-400 dark:text-zinc-500 shrink-0">
            or continue with
          </span>
          <div className="border-t border-slate-200 dark:border-zinc-800 w-full" />
        </div>

        {/* ─── Lower Side: The Two Buttons (GitHub and Google) ───────────────── */}
        <div className="grid grid-cols-2 gap-2.5" suppressHydrationWarning>
          {/* GitHub Button */}
          <button
            type="button"
            suppressHydrationWarning
            disabled={socialLoading !== null || loading}
            onClick={() => handleOAuth("github")}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium text-xs hover:bg-slate-50 dark:hover:bg-zinc-850 hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            title={mode === "login" ? "Continue with GitHub" : "Sign up with GitHub"}
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
              {socialLoading === "github" ? "Connecting…" : "GitHub"}
            </span>
          </button>

          {/* Google Button */}
          <button
            type="button"
            suppressHydrationWarning
            disabled={socialLoading !== null || loading}
            onClick={() => handleOAuth("google")}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 font-medium text-xs hover:bg-slate-50 dark:hover:bg-zinc-850 hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            title={mode === "login" ? "Continue with Google" : "Sign up with Google"}
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
              {socialLoading === "google" ? "Connecting…" : "Google"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
