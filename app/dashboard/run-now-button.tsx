"use client";

import { useTransition, useState } from "react";
import { runCrawlNow } from "@/app/products/actions";
import { useRouter } from "next/navigation";

export function RunNowButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const result = await runCrawlNow();
      if (result.ok) {
        setMsg(
          result.scheduled > 0
            ? `Queued ${result.scheduled} product${result.scheduled === 1 ? "" : "s"}. Refresh in 30s.`
            : "Nothing due — all products are up to date.",
        );
        // Refresh after a short delay so workers have time to write.
        setTimeout(() => router.refresh(), 4000);
      } else {
        setMsg(`Error: ${result.error}`);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span className="text-xs text-neutral-400 font-mono">{msg}</span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-medium text-paper transition hover:border-neutral-500 disabled:opacity-50"
      >
        {pending ? "Running…" : "Run crawl now"}
      </button>
    </div>
  );
}
