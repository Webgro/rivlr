"use client";

import { useState, useTransition } from "react";
import { getOrCreateShareLink, revokeShareLink } from "./share-actions";

/**
 * "Share" on the product detail page. Opens a small modal: create (or
 * fetch) the public link, copy it, revoke it. The link shows the
 * product's charts read-only at /share/[token], no sign-in needed.
 */
export function ShareButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openModal() {
    setOpen(true);
    setError(null);
    if (!url) {
      startTransition(async () => {
        const r = await getOrCreateShareLink(productId);
        if (r.ok && r.token) {
          setUrl(`${window.location.origin}/share/${r.token}`);
        } else {
          setError(r.error ?? "Couldn't create the link.");
        }
      });
    }
  }

  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function revoke() {
    startTransition(async () => {
      await revokeShareLink(productId);
      setUrl(null);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-md border border-default bg-surface px-3 py-1.5 text-xs font-medium hover:border-strong transition"
      >
        Share
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-default bg-elevated p-6 shadow-2xl">
            <h2 className="text-lg font-semibold tracking-tight">
              Share this product
            </h2>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Anyone with the link sees a read-only view of this
              product&apos;s price and stock history. No sign-in needed.
              Revoke it any time.
            </p>

            {error && (
              <div className="mt-4 rounded-md border border-signal/40 bg-signal/[0.04] px-3 py-2 text-sm text-signal">
                {error}
              </div>
            )}

            {isPending && !url && (
              <div className="mt-4 text-sm text-muted">Creating link…</div>
            )}

            {url && (
              <div className="mt-4 flex items-center gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 rounded-md border border-default bg-surface px-3 py-2 text-xs font-mono text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="rounded-md bg-foreground px-3 py-2 text-xs font-medium text-surface hover:opacity-90 transition flex-shrink-0"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              {url ? (
                <button
                  type="button"
                  onClick={revoke}
                  disabled={isPending}
                  className="text-xs text-muted hover:text-signal transition underline-offset-4 hover:underline"
                >
                  Revoke link
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-default bg-surface px-3.5 py-1.5 text-xs text-foreground hover:border-strong transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
