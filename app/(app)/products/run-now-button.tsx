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
        setMsg(
          result.scheduled > 0
            ? `Queued ${result.scheduled} · refreshing in 30s`
            : "Nothing due",
        );
        setTimeout(() => router.refresh(), 4000);
      } else {
        setMsg(`Error: ${result.error}`);
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
        {pending ? "Running…" : "Run crawl now"}
      </button>
    </div>
  );
}
