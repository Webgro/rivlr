"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAuthorisedEmail,
  removeAuthorisedEmail,
  type TeamMember,
} from "./team-actions";
import { ConfirmDialog } from "@/components/confirm-action-button";

/**
 * Settings → Team access panel.
 *
 * Shows the list of authorised emails (primary first) and an invite
 * form. Invite triggers a magic link that both authorises the email
 * AND signs them in on click.
 *
 * Remove is gated by a confirm dialog — it doesn't delete data, but
 * does revoke sign-in access. Primary email can't be removed here.
 */
export function TeamPanel({ initial }: { initial: TeamMember[] }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { tone: "ok" | "error"; message: string }
    | null
  >(null);
  const [emailInput, setEmailInput] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const router = useRouter();

  function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setFeedback(null);
    const fd = new FormData();
    fd.set("email", emailInput);
    startTransition(async () => {
      const result = await addAuthorisedEmail(fd);
      if (result.ok) {
        setFeedback({ tone: "ok", message: result.message ?? "Invite sent." });
        setEmailInput("");
        router.refresh();
      } else {
        setFeedback({
          tone: "error",
          message: result.error ?? "Couldn't send invite.",
        });
      }
    });
  }

  function confirmRemove() {
    if (!removeTarget) return;
    const target = removeTarget;
    setFeedback(null);
    const fd = new FormData();
    fd.set("email", target);
    startTransition(async () => {
      const result = await removeAuthorisedEmail(fd);
      if (result.ok) {
        setFeedback({ tone: "ok", message: `${target} removed.` });
        setRemoveTarget(null);
        router.refresh();
      } else {
        setFeedback({
          tone: "error",
          message: result.error ?? "Couldn't remove.",
        });
      }
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-default bg-elevated p-4">
      {/* Member list */}
      <ul className="space-y-2">
        {initial.map((m) => (
          <li
            key={m.email}
            className="flex items-center gap-3 rounded-md border border-default bg-surface px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-mono text-foreground truncate">
                  {m.email}
                </span>
                {m.isPrimary && (
                  <span className="rounded bg-signal/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-signal font-mono flex-shrink-0">
                    primary
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted/80 font-mono mt-0.5 uppercase tracking-[0.15em]">
                {m.lastUsedAt
                  ? `Last seen ${formatRelative(m.lastUsedAt)}`
                  : m.isPrimary
                    ? "—"
                    : "Invite pending"}
              </div>
            </div>
            {!m.isPrimary && (
              <button
                type="button"
                onClick={() => setRemoveTarget(m.email)}
                className="text-xs text-muted hover:text-signal transition px-2 py-1"
                title="Remove access for this email"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Invite form */}
      <form onSubmit={invite} className="mt-4 flex items-center gap-2 flex-wrap">
        <input
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="staff@example.com"
          required
          className="flex-1 min-w-[220px] rounded-md border border-default bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-strong"
        />
        <button
          type="submit"
          disabled={pending || !emailInput.trim()}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
        >
          {pending ? (
            <>
              <span className="rivlr-spinner" aria-hidden />
              Sending…
            </>
          ) : (
            "Send invite →"
          )}
        </button>
      </form>

      {feedback && (
        <p
          className={`mt-3 text-xs font-mono ${feedback.tone === "ok" ? "text-green-500" : "text-signal"}`}
        >
          {feedback.message}
        </p>
      )}

      <p className="mt-3 text-[11px] text-muted/80 leading-relaxed">
        Invitees get a magic-link email. One click signs them in to{" "}
        <strong className="text-foreground">your</strong> Rivlr account —
        same products, same stores, same data. No roles for now: every
        authorised email has full access.
      </p>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        pending={pending}
        title={`Remove ${removeTarget} from your account?`}
        description="They won't be able to sign in any more. Existing sessions on their device stay valid until they expire (up to 30 days) — sign them out remotely from any active session afterward if needed."
        confirmLabel="Yes, remove"
        variant="danger"
      />
    </div>
  );
}

function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  if (ms < 0) return "in the future";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}
