"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "rivlr-cookie-acked";

/**
 * Tiny consent notice. Rivlr only uses strictly-necessary cookies (session
 * + theme), so this is more of an FYI banner than a real consent flow —
 * acknowledging it dismisses it. If we ever add analytics, this becomes
 * a proper opt-in.
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const acked = localStorage.getItem(STORAGE_KEY);
    if (!acked) setShow(true);
  }, []);

  function ack() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 max-w-sm rounded-lg border border-default bg-elevated p-4 shadow-lg">
      <p className="text-xs text-muted-strong leading-relaxed">
        We use strictly-necessary cookies (login session + theme
        preference). No tracking, no ads.{" "}
        <Link
          href="/legal/cookies"
          className="underline hover:text-foreground"
        >
          Cookie policy
        </Link>
        .
      </p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={ack}
          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-surface"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
