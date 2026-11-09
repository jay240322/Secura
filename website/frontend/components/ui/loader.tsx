"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ─── Modern Clean Spinner Component ──────────────────────────────────────────
export function Loader({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-5 w-5";

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <svg
        className={`animate-spin text-blue-600 dark:text-blue-500 ${sizeClasses}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

export default Loader;

// ─── Global Click & Navigation Loader Context ──────────────────────────────────
interface LoaderContextType {
  showLoader: (durationMs?: number) => void;
  hideLoader: () => void;
  isLoading: boolean;
}

const LoaderContext = createContext<LoaderContextType>({
  showLoader: () => {},
  hideLoader: () => {},
  isLoading: false,
});

export const useGlobalLoader = () => useContext(LoaderContext);

export function GlobalLoaderProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loadStartTimeRef = useRef<number>(0);

  const showLoader = useCallback((durationMs?: number) => {
    loadStartTimeRef.current = Date.now();
    setIsLoading(true);
    if (durationMs) {
      setTimeout(() => {
        setIsLoading(false);
      }, durationMs);
    }
  }, []);

  const hideLoader = useCallback(() => {
    setIsLoading(false);
  }, []);

  // When pathname or search params change, hide the navigation loader after ensuring minimum display time
  useEffect(() => {
    const elapsed = Date.now() - loadStartTimeRef.current;
    const remainingTime = Math.max(0, 250 - elapsed);

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  // Page Navigation Listener: Only triggers when the user clicks a link that navigates to ANOTHER page
  useEffect(() => {
    let safetyTimer: NodeJS.Timeout | null = null;

    const handleClick = (e: MouseEvent) => {
      // Ignore right clicks or clicks with modifier keys (new tab, etc.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Find if clicked element or its ancestor is an anchor link
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;

      try {
        const targetUrl = new URL(anchor.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        // Only trigger for internal links on same origin, not target="_blank", not downloading, not anchors
        if (
          targetUrl.origin === currentUrl.origin &&
          anchor.target !== "_blank" &&
          !anchor.hasAttribute("download") &&
          !anchor.getAttribute("href")?.startsWith("#")
        ) {
          // Check if navigating to a DIFFERENT pathname or query
          const isDifferentPath = targetUrl.pathname !== currentUrl.pathname;
          const isDifferentSearch =
            targetUrl.pathname === currentUrl.pathname &&
            targetUrl.search !== currentUrl.search &&
            targetUrl.search.length > 0;

          // Only show loader when user goes to another page!
          if (isDifferentPath || isDifferentSearch) {
            loadStartTimeRef.current = Date.now();
            setIsLoading(true);

            // Safety fallback timeout in case route transition is slow or aborted
            if (safetyTimer) clearTimeout(safetyTimer);
            safetyTimer = setTimeout(() => {
              setIsLoading(false);
            }, 5000);
          }
        }
      } catch {
        // Invalid URL, do nothing
      }
    };

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <LoaderContext.Provider value={{ showLoader, hideLoader, isLoading }}>
      {children}
      {/* ─── Global Page Navigation Overlay Loader ── */}
      {isLoading && (
        <div
          role="status"
          aria-label="Loading page..."
          className="fixed inset-0 z-[99999] pointer-events-none w-screen h-screen flex flex-col items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
        >
          <div className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl bg-white/90 dark:bg-zinc-900/90 shadow-lg border border-slate-200/80 dark:border-zinc-800">
            <Loader size="lg" />
            <p className="text-xs font-medium text-slate-600 dark:text-zinc-300">
              Loading...
            </p>
          </div>
        </div>
      )}
    </LoaderContext.Provider>
  );
}
