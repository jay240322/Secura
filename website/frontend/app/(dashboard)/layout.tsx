import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { ReactNode, Suspense } from "react";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0e14]">
      <Suspense fallback={<div className="w-60 bg-[#0d1117] h-screen shrink-0 border-r border-white/[0.06]" />}>
        <Sidebar />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div className="h-16 bg-[#0d1117] border-b border-white/[0.06]" />}>
          <TopNav />
        </Suspense>
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
