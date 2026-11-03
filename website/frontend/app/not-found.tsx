import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0e14]">
      <div className="text-center">
        <p className="text-6xl font-bold text-slate-800 mb-4">404</p>
        <h1 className="text-xl font-semibold text-slate-300 mb-2">
          Page not found
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/dashboard"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

