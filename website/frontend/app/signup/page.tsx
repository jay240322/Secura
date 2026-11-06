"use client";

import { Suspense } from "react";
import { CodeRabbitAuth } from "@/components/auth/coderabbit-auth";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-[#111113] flex items-center justify-center text-xs text-zinc-500 font-mono">
          Loading sign up...
        </div>
      }
    >
      <CodeRabbitAuth initialMode="signup" />
    </Suspense>
  );
}
