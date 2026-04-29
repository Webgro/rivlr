"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { regenerateSuggestions } from "./actions";

export function RegenerateButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const result = await regenerateSuggestions();
      if (result && "suggested" in result) {
        setMsg(`Found ${result.suggested} new suggestion${result.suggested === 1 ? "" : "s"}`);
      } else {
        setMsg("No new suggestions");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-muted font-mono">{msg}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="rounded-md border border-default bg-elevated px-3 py-1.5 text-sm hover:border-strong disabled:opacity-50"
      >
        {pending ? "Scanning…" : "↻ Regenerate"}
      </button>
    </div>
  );
}
