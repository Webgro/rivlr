"use client";

import { useTransition } from "react";
import { toggleAdminFlag } from "./actions";

export function AdminToggleForm({
  userId,
  isAdmin,
  isSelf,
}: {
  userId: string;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function submit() {
    const ok = isAdmin
      ? confirm(
          isSelf
            ? "Demote yourself? You'll lose admin access immediately. Recovery is via the ADMIN_USER_IDS env var. Continue?"
            : "Revoke admin access for this user?",
        )
      : confirm("Grant admin access to this user?");
    if (!ok) return;

    const fd = new FormData();
    fd.set("user-id", userId);
    fd.set("grant", String(!isAdmin));
    startTransition(async () => {
      await toggleAdminFlag(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={isPending}
      className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        isAdmin
          ? "border border-default bg-surface text-muted hover:text-signal hover:border-signal/50"
          : "bg-foreground text-surface hover:opacity-90"
      }`}
    >
      {isPending
        ? "Saving…"
        : isAdmin
          ? `Revoke admin${isSelf ? " (self)" : ""}`
          : "Grant admin"}
    </button>
  );
}
