"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { api } from "@/lib/api-client";
import { Shield, Loader2, Sparkles } from "lucide-react";

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [appBanner, setAppBanner] = useState<string | null>(null);

  useEffect(() => {
    const token = api.getToken();
    const user = api.getStoredUser();

    // Check if redirected from GitHub App installation
    const installationId = searchParams.get("installation_id");
    const setupAction = searchParams.get("setup_action");

    if (installationId || setupAction) {
      if (token && user) {
        // User is already logged in, sync repositories directly
        void api.syncRepositories().then(() => {
          router.push(
            `/repositories?installed=true${
              installationId ? `&installation_id=${installationId}` : ""
            }`
          );
        });
        return;
      } else {
        if (installationId) {
          try {
            sessionStorage.setItem("secura_pending_installation_id", installationId);
          } catch {
            // ignore
          }
        }
        setAppBanner(
          "GitHub App installation detected! Please sign in or create an account to view your selected repositories."
        );
        setCheckingAuth(false);
        return;
      }
    }

    if (token && user) {
      router.push("/dashboard");
    } else {
      setCheckingAuth(false);
    }
  }, [router, searchParams]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0e14] gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 animate-pulse">
          <Shield className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
          <span>Connecting to Secura Security Gate...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-[#0a0e14] overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Notification banner if coming back from GitHub installation while logged out */}
      {appBanner && (
        <div className="relative z-10 mb-4 max-w-md w-full rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-200 flex items-center gap-2.5 shadow-lg shadow-blue-500/10">
          <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />
          <span>{appBanner}</span>
        </div>
      )}

      <div className="relative z-10 w-full">
        <AuthCard initialMode="login" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e14]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Shield className="h-6 w-6" />
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
