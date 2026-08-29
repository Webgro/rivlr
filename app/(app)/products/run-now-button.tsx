"use client";

import { useTransition, useState } from "react";
import { runCrawlNow } from "./actions";
import { useRouter } from "next/navigation";

export function RunNowButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function trigger() {
    setMsg(null);
    startTransition(async () => {
      const result = await runCrawlNow(false);
      if (result.ok) {
        setMsg("Checking now · progress shows bottom-right");
        // Refresh after a delay so the dashboard picks up new observations.
        setTimeout(() => router.refresh(), 8000);
        setTimeout(() => setMsg(null), 6000);
      } else {
        setMsg(`Error: ${"error" in result ? result.error : "unknown"}`);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-muted font-mono">{msg}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={trigger}
        className="rounded-md border border-default bg-elevated px-3 py-2 text-sm font-medium transition hover:border-strong disabled:opacity-50"
      >
        {pending ? "Checking…" : "Check now"}
      </button>
    </div>
  );
}
