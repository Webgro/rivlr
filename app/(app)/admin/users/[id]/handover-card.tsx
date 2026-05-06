"use client";

import { useState, useTransition } from "react";
import { sendSigninLink } from "./actions";

/**
 * "Handover" affordance — sends the prospect a fresh magic link so
 * they can sign in for the first time and take ownership of the
 * account you've populated for them.
 *
 * No special framing on their side — they get the standard "Sign in
 * to Rivlr" email and land on /dashboard like any other user.
 */
export function HandoverCard({
  userId,
  email,
  lastLoginAt,
}: {
  userId: string;
  email: string;
  lastLoginAt: Date | null;
}) {
  const [feedback, setFeedback] = useState<
    | { tone: "ok" | "error"; message: string }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    setFeedback(null);
    const fd = new FormData();
    fd.set("user-id", userId);
    startTransition(async () => {
      const result = await sendSigninLink(fd);
      if (result.ok) {
        setFeedback({
          tone: "ok",
          message: `Sign-in link sent to ${email}. Link expires in 15 minutes.`,
        });
      } else {
        setFeedback({
          tone: "error",
          message: result.error ?? "Couldn't send link.",
        });
      }
    });
  }

  const hasSignedIn = !!lastLoginAt;

  return (
    <section className="mt-6 rounded-lg border border-default bg-elevated p-5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted/70 font-mono">
        Handover
      </div>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">
        Send sign-in link
      </h3>
      <p className="mt-1.5 text-xs text-muted leading-relaxed">
        Emails {email} a magic link they can click to sign in. Use this at
        the moment of handover — once they&apos;ve signed in, the account
        is theirs to manage. Consider clearing the comp plan first if
        they&apos;re paying through Stripe.
      </p>
      {hasSignedIn && (
        <p className="mt-2 text-[11px] text-muted/80 font-mono">
          Note: this user has already signed in (last seen{" "}
          {lastLoginAt!.toLocaleString()}). Sending another link is a
          login reset, not a first-time invite.
        </p>
      )}
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={send}
          disabled={isPending}
          className="rounded-md bg-foreground px-3.5 py-1.5 text-xs font-medium text-surface hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isPending ? (
            <>
              <span className="rivlr-spinner" aria-hidden />
              Sending…
            </>
          ) : hasSignedIn ? (
            "Send sign-in link →"
          ) : (
            "Hand over · send sign-in link →"
          )}
        </button>
        {feedback && (
          <span
            className={`text-xs font-mono ${feedback.tone === "ok" ? "text-green-500" : "text-signal"}`}
          >
            {feedback.message}
          </span>
        )}
      </div>
    </section>
  );
}
