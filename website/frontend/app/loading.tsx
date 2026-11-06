import { Loader } from "@/components/ui/loader";

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/90 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-40 h-28 flex items-center justify-center overflow-visible">
        <Loader size="md" />
      </div>
      <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-zinc-400 font-mono tracking-tight animate-pulse">
        Loading Secura...
      </p>
    </div>
  );
}

