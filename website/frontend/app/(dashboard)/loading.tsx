import { Loader } from "@/components/ui/loader";

export default function DashboardLoading() {
  return (
    <div className="relative w-full min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center py-16 animate-in fade-in duration-150">
      <div className="relative w-40 h-28 flex items-center justify-center overflow-visible">
        <Loader size="md" />
      </div>
      <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-zinc-400 font-mono tracking-tight animate-pulse">
        Secura Security Gate · Loading...
      </p>
    </div>
  );
}

