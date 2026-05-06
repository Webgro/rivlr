"use client";

import { useState, useTransition, useId } from "react";

/**
 * Delete-account confirmation modal. Two layers of friction:
 *
 *   1. The "Delete account…" button opens a modal — no immediate
 *      destructive action from a single click.
 *   2. Inside the modal, the user must type their email exactly to
 *      enable the final "Delete forever" button.
 *
 * Server enforces the same typed-email check defensively (in
 * /api/account/delete) so a JavaScript-disabled client can't bypass
 * the gate.
 */
export function DeleteAccountButton({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputId = useId();

  const matches = confirm.trim().toLowerCase() === email.toLowerCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-signal/40 bg-signal/[0.04] px-3.5 py-1.5 text-xs font-medium text-signal hover:border-signal hover:bg-signal/[0.08] transition"
      >
        Delete account…
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-signal/40 bg-elevated p-6 shadow-2xl">
            <h2
              id="delete-account-title"
              className="text-lg font-semibold tracking-tight text-signal"
            >
              Delete your account?
            </h2>

            <p className="mt-2 text-sm text-muted leading-relaxed">
              This is permanent. We&apos;ll:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted leading-relaxed">
              <li className="flex gap-2">
                <span className="text-signal">·</span>
                <span>
                  Cancel any active Stripe subscription immediately (no
                  refund for the unused portion of this period).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-signal">·</span>
                <span>
                  Delete every product, store preference, tag, group, alert
                  history, discovery, and team-access email tied to your
                  account.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-signal">·</span>
                <span>
                  Delete your Stripe customer record and sign you out of
                  every device.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-signal">·</span>
                <span>
                  Not send a recovery email. There&apos;s no undo.
                </span>
              </li>
            </ul>

            <form action="/api/account/delete" method="post" className="mt-6">
              <label
                htmlFor={inputId}
                className="block text-xs text-muted-strong"
              >
                Type your email{" "}
                <span className="font-mono text-foreground">{email}</span> to
                confirm:
              </label>
              <input
                id={inputId}
                name="confirm-email"
                type="email"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                placeholder="you@example.com"
                className="mt-2 block w-full rounded-md border border-default bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-signal/50 font-mono"
              />

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirm("");
                  }}
                  disabled={isPending}
                  className="rounded-md border border-default bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground hover:border-strong transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!matches || isPending}
                  onClick={() => startTransition(() => {})}
                  className="rounded-md bg-signal px-4 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Deleting…" : "Delete forever"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
