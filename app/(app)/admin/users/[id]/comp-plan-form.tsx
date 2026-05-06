"use client";

import { useState, useTransition } from "react";
import { applyCompPlan, removeCompPlan } from "./actions";
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
 * Simple inline form for applying or clearing a comp plan. Reason is
 * required when applying — we want every comp to have justification
 * captured in the audit log.
 */
export function CompPlanForm({
  userId,
  currentComp,
}: {
  userId: string;
  currentComp: CompPlan | null;
}) {
  const [plan, setPlan] = useState<CompPlan>(currentComp ?? "free");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitApply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason.trim()) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await applyCompPlan(fd);
      setReason("");
    });
  }

  function submitClear() {
    const fd = new FormData();
    fd.set("user-id", userId);
    startTransition(async () => {
      await removeCompPlan(fd);
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submitApply} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="user-id" value={userId} />
        <select
          name="plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value as CompPlan)}
          className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm font-mono uppercase tracking-wider text-foreground outline-none focus:border-strong"
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          name="reason"
          type="text"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required) — e.g. trial extension, beta access"
          className="flex-1 min-w-[260px] rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-strong"
        />
        <button
          type="submit"
          disabled={isPending || !reason.trim()}
          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-surface hover:opacity-90 transition disabled:opacity-50"
        >
          {currentComp ? "Update comp" : "Set comp"}
        </button>
      </form>

      {currentComp && (
        <button
          type="button"
          onClick={submitClear}
          disabled={isPending}
          className="text-xs text-muted hover:text-signal transition underline-offset-4 hover:underline"
        >
          Clear comp (revert to subscription state)
        </button>
      )}
    </div>
  );
}
