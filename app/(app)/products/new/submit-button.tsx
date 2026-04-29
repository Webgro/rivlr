"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2.5 rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-surface transition hover:opacity-90 disabled:opacity-60"
    >
      {pending && (
        <span
          className="h-3.5 w-3.5 inline-block rounded-full border-2 border-surface/30 border-t-surface animate-spin"
          aria-hidden
        />
      )}
      {pending ? "Adding to queue…" : "Track products"}
    </button>
  );
}
