"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { runCrawlForProduct } from "../actions";

export function CrawlNowButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function trigger() {
    setMsg(null);
    startTransition(async () => {
      const res = await runCrawlForProduct(productId);
      if (res.ok) {
        setMsg("Queued. Refreshing in a few seconds.");
        // Wait for the crawl to actually finish in the background, then refresh.
        setTimeout(() => router.refresh(), 8000);
        setTimeout(() => setMsg(null), 12000);
      } else {
        setMsg("Could not queue the crawl");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted font-mono">{msg}</span>}
      <button
        type="button"
        onClick={trigger}
        disabled={pending}
        className="rounded-md border border-default bg-elevated px-3 py-1.5 text-sm hover:border-strong disabled:opacity-50"
      >
        {pending ? "Crawling…" : "↻ Crawl now"}
      </button>
    </div>
  );
}
