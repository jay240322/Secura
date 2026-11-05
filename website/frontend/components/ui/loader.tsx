"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ─── Custom 3-Bar Jumping Loader Component (From Uiverse.io by Donewenfu) ───────
export function Loader({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const scale =
    size === "sm" ? "scale-75" : size === "lg" ? "scale-125" : "scale-100";

  return (
    <div className={`relative inline-flex items-center justify-center w-[80px] h-[60px] ${scale} ${className}`}>
      <div className="loader">
        <div className="justify-content-center jimu-primary-loading" />
      </div>
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

  const showLoader = useCallback((durationMs?: number) => {
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

  // When pathname or search params change, hide the navigation loader smoothly
  useEffect(() => {
    setIsLoading(false);
  }, [pathname, searchParams]);

  // Page Navigation Listener: Only triggers when the user clicks a link that navigates to ANOTHER page
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
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
            // Delay slightly so Next.js Link onClick handles client routing first
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              setIsLoading(true);
            }, 60);

            // Safety fallback timeout in case route transition is slow or aborted
            if (safetyTimer) clearTimeout(safetyTimer);
            safetyTimer = setTimeout(() => {
              setIsLoading(false);
            }, 6000);
          }
        }
      } catch {
        // Invalid URL, do nothing
      }
    };

    // Standard event bubbling (no capture) so Next.js Link receives and processes the click
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      if (timeoutId) clearTimeout(timeoutId);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <LoaderContext.Provider value={{ showLoader, hideLoader, isLoading }}>
      {children}
      {/* ─── Global Page Navigation Overlay Loader (Uiverse.io Donewenfu) ── */}
      {isLoading && (
        <div
          role="status"
          aria-label="Loading page..."
          className="fixed inset-0 z-[99999] pointer-events-none w-screen h-screen flex items-center justify-center bg-white/70 dark:bg-black/75 backdrop-blur-[6px] animate-in fade-in duration-150 select-none"
        >
          <div className="relative w-[120px] h-[80px] flex items-center justify-center">
            <div className="loader">
              <div className="justify-content-center jimu-primary-loading" />
            </div>
          </div>
        </div>
      )}
    </LoaderContext.Provider>
  );
}
