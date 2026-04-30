"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { runDiscoveryNow } from "./actions";

export function RunDiscoveryButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function trigger() {
    setMsg(null);
    startTransition(async () => {
      const result = await runDiscoveryNow();
      if (result.ok) {
        setMsg(
          result.newDiscoveries > 0
            ? `Found ${result.newDiscoveries} new across ${result.storesScanned} stores`
            : `Scanned ${result.storesScanned} stores · nothing new`,
        );
        router.refresh();
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
        onClick={trigger}
        disabled={pending}
        className="rounded-md border border-default bg-elevated px-3 py-2 text-sm font-medium hover:border-strong disabled:opacity-50"
      >
        {pending ? "Scanning…" : "↻ Run scan now"}
      </button>
    </div>
  );
}
