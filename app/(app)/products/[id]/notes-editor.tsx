"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProductNotes } from "../actions";

/**
 * Free-text notes for a product. Auto-saves on blur or button click.
 * Markdown-ish rendering kept simple — preserves line breaks and shows the
 * raw text. No editor library; the input is a plain textarea.
 */
export function NotesEditor({
  productId,
  initial,
}: {
  productId: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const router = useRouter();

  const dirty = (initial ?? "") !== value;

  function save() {
    if (!dirty) return;
    const fd = new FormData();
    fd.set("id", productId);
    fd.set("notes", value);
    startTransition(async () => {
      await saveProductNotes(fd);
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-default bg-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted font-mono">
          Notes
        </div>
        <div className="flex items-center gap-3 text-xs text-muted font-mono">
          {pending
            ? "Saving…"
            : dirty
              ? "Unsaved"
              : savedAt
                ? "Saved"
                : null}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder="Anything you want to remember about this product — restock cadence, pricing tactics, anecdotes…"
        rows={4}
        className="block w-full rounded-md border border-default bg-surface px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none font-mono leading-5 focus:border-strong"
      />
      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="rounded-md border border-default bg-surface px-3 py-1 text-xs hover:border-strong disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
