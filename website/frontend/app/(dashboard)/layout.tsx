import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { ReactNode, Suspense } from "react";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      <Suspense fallback={<div className="w-60 bg-white dark:bg-zinc-950 h-screen shrink-0 border-r border-slate-200/80 dark:border-zinc-800" />}>
        <Sidebar />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Suspense fallback={<div className="h-16 bg-white dark:bg-black border-b border-slate-200/80 dark:border-zinc-800" />}>
          <TopNav />
        </Suspense>
        <main className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 min-w-0 bg-slate-50/60 dark:bg-black transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
