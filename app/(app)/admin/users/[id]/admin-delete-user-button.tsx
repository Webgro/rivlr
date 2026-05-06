"use client";

import { useState, useTransition, useId } from "react";
import { adminDeleteUser } from "./actions";

/**
 * Admin-initiated user deletion. Same typed-confirm friction as the
 * user-facing /profile delete flow — admin must type the target's
 * email exactly to enable the destructive submit.
 *
 * Disabled on self — admin should use the regular /profile delete
 * flow rather than going through the admin surface against
 * themselves.
 */
export function AdminDeleteUserButton({
  userId,
  email,
  isSelf,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputId = useId();

  const matches = confirm.trim().toLowerCase() === email.toLowerCase();

  if (isSelf) {
    return (
      <p className="text-xs text-muted">
        You can&apos;t delete your own account from /admin. Use the danger
        zone on{" "}
        <a
          href="/profile"
          className="text-foreground underline-offset-4 hover:underline"
        >
          your Profile
        </a>{" "}
        instead.
      </p>
    );
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!matches) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await adminDeleteUser(fd);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-signal/40 bg-signal/[0.04] px-3.5 py-1.5 text-xs font-medium text-signal hover:border-signal hover:bg-signal/[0.08] transition"
      >
        Delete user…
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
          <div className="w-full max-w-md rounded-xl border border-signal/40 bg-elevated p-6 shadow-2xl">
            <h2 className="text-lg font-semibold tracking-tight text-signal">
              Delete this user?
            </h2>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Hard-deletes everything tied to{" "}
              <span className="font-mono text-foreground">{email}</span>.
              Audit log entries persist with this email captured at write
              time. No undo.
            </p>
            <form onSubmit={submit} className="mt-5">
              <input type="hidden" name="user-id" value={userId} />
              <label
                htmlFor={inputId}
                className="block text-xs text-muted-strong"
              >
                Type{" "}
                <span className="font-mono text-foreground">{email}</span>{" "}
                to confirm:
              </label>
              <input
                id={inputId}
                name="confirm-email"
                type="email"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                className="mt-2 block w-full rounded-md border border-default bg-surface px-3 py-2 text-sm text-foreground font-mono outline-none focus:border-signal/50"
              />
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirm("");
                  }}
                  disabled={isPending}
                  className="rounded-md border border-default bg-surface px-3.5 py-1.5 text-xs text-foreground hover:border-strong transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!matches || isPending}
                  className="rounded-md bg-signal px-4 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Deleting…" : "Delete user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
