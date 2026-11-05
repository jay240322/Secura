import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] dark:bg-black p-4 text-center selection:bg-[#EDE9E6] selection:text-[#281C59]">
      <div className="max-w-md w-full rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl p-8 shadow-xl shadow-slate-900/5">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDE9E6] dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 mb-4 shadow-xs">
          <img
            src="/logo.png"
            alt="Secura"
            className="h-10 w-10 rounded-xl object-cover"
          />
        </div>
        <p className="text-4xl font-extrabold tracking-tight text-[#281C59] dark:text-white mb-2">404</p>
        <h1 className="text-base font-semibold text-slate-800 dark:text-zinc-200 mb-1">
          Page not found
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
          The requested page could not be located on this server.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-[#EDE9E6] dark:hover:bg-zinc-900 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-[#281C59] hover:bg-[#281C59]/90 px-4 py-2 text-xs font-semibold text-white transition-colors shadow-xs"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
