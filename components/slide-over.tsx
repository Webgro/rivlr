"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Slide-over panel anchored to the right edge of the viewport. Used by the
 * intercepted /products/[id] route — clicking a row in the dashboard opens
 * detail in this overlay (URL still updates, back button closes).
 *
 * On mobile the panel takes the full viewport (because of the route group
 * the layout still renders the sidebar above it, so we keep it full-bleed
 * with a sticky close button).
 */
export function SlideOver({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function close() {
    router.back();
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="flex-1 bg-black/40 backdrop-blur-[2px] animate-[slideover-fade_0.18s_ease-out]"
      />
      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl overflow-y-auto border-l border-default bg-surface shadow-2xl animate-[slideover-in_0.22s_cubic-bezier(0.32,0.72,0,1)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-default bg-surface/90 backdrop-blur px-5 py-3">
          <button
            type="button"
            onClick={close}
            className="text-xs text-muted hover:text-foreground font-mono uppercase tracking-wider"
          >
            ← Close
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1 text-muted hover:text-foreground hover:bg-elevated"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </aside>
      <style>{`
        @keyframes slideover-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideover-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
