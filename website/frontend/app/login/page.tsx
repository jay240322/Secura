import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Secura Security Gate",
  description: "Sign in to your Secura Developer Security Command Center.",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#0a0e14] overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <Suspense fallback={<div className="text-xs text-slate-500">Loading authentication...</div>}>
        <AuthCard initialMode="login" />
      </Suspense>
    </div>
  );
}

