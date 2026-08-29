"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUserAction } from "./actions";
import type { CompPlan } from "@/lib/admin";

const PLANS: CompPlan[] = [
  "free",
  "starter",
  "growth",
  "pro",
  "owner",
  "unlimited",
];

/**
 * Three-field form: email + comp plan + reason. Server action
 * handles validation, uniqueness, audit. On success redirect to
 * /admin/users/[id] of the new user.
 */
export function CreateUserForm() {
  const [email, setEmail] = useState("");
  const [comp, setComp] = useState<CompPlan>("unlimited");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !reason.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createUserAction({
        email: email.trim(),
        compPlan: comp,
        compReason: reason.trim(),
      });
      if (result.ok) {
        router.push(`/admin/users/${result.userId}?status=created`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 space-y-6 rounded-lg border border-default bg-elevated p-5"
    >
      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium text-muted"
        >
          Prospect email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contact@prospect.com"
          disabled={isPending}
          className="mt-2 block w-full rounded-md border border-default bg-surface px-3 py-2.5 text-sm text-foreground font-mono outline-none focus:border-strong"
        />
        <p className="mt-1 text-xs text-muted">
          Must not already exist on another Rivlr account. They&apos;ll
          sign in via magic link to this address when you hand over.
        </p>
      </div>

      {/* Comp plan */}
      <div>
        <label
          htmlFor="comp"
          className="block text-xs font-medium text-muted"
        >
          Initial comp plan
        </label>
        <select
          id="comp"
          name="comp"
          value={comp}
          onChange={(e) => setComp(e.target.value as CompPlan)}
          disabled={isPending}
          className="mt-2 block w-full rounded-md border border-default bg-surface px-3 py-2 text-sm font-mono uppercase tracking-wider text-foreground outline-none focus:border-strong"
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          <strong>unlimited</strong> is the default for soft-launch / demo
          accounts, no caps anywhere. Clear or change at any time on the
          user detail page.
        </p>
      </div>

      {/* Reason */}
      <div>
        <label
          htmlFor="reason"
          className="block text-xs font-medium text-muted"
        >
          Reason
        </label>
        <input
          id="reason"
          name="reason"
          type="text"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Webgro client demo, Acme Stores, contact 2026-05-06"
          disabled={isPending}
          className="mt-2 block w-full rounded-md border border-default bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-strong"
        />
        <p className="mt-1 text-xs text-muted">
          Captured on the comp record + audit log. Anything that helps
          you remember why this account exists.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-signal/40 bg-signal/[0.04] px-4 py-3 text-sm text-signal">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end">
        <button
          type="submit"
          disabled={isPending || !email.trim() || !reason.trim()}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isPending ? (
            <>
              <span className="rivlr-spinner" aria-hidden />
              Creating…
            </>
          ) : (
            "Create user"
          )}
        </button>
      </div>
    </form>
  );
}
