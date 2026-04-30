"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Slide-over panel anchored to the right edge of the viewport. Used by the
 * intercepted /products/[id] route — clicking a row in the dashboard opens
 * detail in this overlay (URL still updates, back button closes).
 *
 * <SlideOverShell> is the static chrome (backdrop + panel frame + close
 * button). <SlideOver> wraps it with router-back close behaviour. Loading
 * states use the bare shell so they can render before any router context.
 */
export function SlideOverShell({
  onClose,
  children,
}: {
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-[2px] animate-[slideover-fade_0.18s_ease-out]"
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl overflow-y-auto border-l border-default bg-surface shadow-2xl animate-[slideover-in_0.22s_cubic-bezier(0.32,0.72,0,1)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-default bg-surface/90 backdrop-blur px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted hover:text-foreground font-mono uppercase tracking-wider"
          >
            ← Close
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted hover:text-foreground hover:bg-elevated"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
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

export function SlideOver({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div ref={panelRef}>
      <SlideOverShell onClose={() => router.back()}>{children}</SlideOverShell>
    </div>
  );
}
