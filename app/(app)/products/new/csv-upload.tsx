"use client";

import { useState } from "react";

/**
 * Client-side CSV/text-file reader. Parses the file and appends URLs to the
 * existing textarea so the user can review before submitting. Accepts any
 * CSV / TSV / plain text — we just split on whitespace/commas and look for
 * URL-like lines, so the file can be a single-column dump or a multi-column
 * spreadsheet export.
 */
export function CsvUploadButton({
  textareaId,
}: {
  textareaId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleFile(file: File) {
    setBusy(true);
    setFeedback(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const tokens = text
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => /^https?:\/\//i.test(s));
      const unique = Array.from(new Set(tokens));

      const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
      if (ta) {
        const existing = ta.value.trim();
        ta.value = existing
          ? `${existing}\n${unique.join("\n")}`
          : unique.join("\n");
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
      setFeedback(
        unique.length > 0
          ? `Added ${unique.length} URL${unique.length === 1 ? "" : "s"} from file`
          : "No URLs found in file",
      );
      setBusy(false);
    };
    reader.onerror = () => {
      setFeedback("Couldn't read file");
      setBusy(false);
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex items-center gap-3">
      <label
        className="inline-flex items-center gap-2 rounded-md border border-default bg-elevated px-3 py-1.5 text-sm cursor-pointer hover:border-strong"
      >
        <span>↑ Upload CSV / text file</span>
        <input
          type="file"
          accept=".csv,.tsv,.txt"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = ""; // allow re-uploading same file
          }}
        />
      </label>
      {feedback && (
        <span className="text-xs text-muted font-mono">{feedback}</span>
      )}
    </div>
  );
}
