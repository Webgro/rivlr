"use client";

import { useState, useTransition } from "react";
import { sendTestNotification } from "./actions";

/**
 * "Send test email" button on the Settings page. Hits the addresses
 * currently saved in app_settings.notification_emails and shows
 * "sent N / skipped M" feedback inline so the user knows it worked
 * without leaving the page.
 *
 * Disabled when there are no recipients (forces save-first flow).
 */
export function SendTestEmailButton({
  hasRecipients,
}: {
  hasRecipients: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "warn" | "error">("ok");

  function send() {
    setFeedback(null);
    startTransition(async () => {
      const result = await sendTestNotification();
      if (!result.ok) {
        setTone("error");
        setFeedback(result.error ?? "Failed to send test email.");
        return;
      }
      if (result.error) {
        setTone("error");
        setFeedback(result.error);
        return;
      }
      if (result.sent === 0) {
        setTone("warn");
        setFeedback(
          result.skipped > 0
            ? `All ${result.skipped} address${result.skipped === 1 ? "" : "es"} previously unsubscribed. Re-add to send.`
            : "No emails sent. Check the API key.",
        );
        return;
      }
      setTone("ok");
      const skipMsg =
        result.skipped > 0
          ? ` (skipped ${result.skipped} unsubscribed)`
          : "";
      setFeedback(
        `✓ Test sent to ${result.sent} address${result.sent === 1 ? "" : "es"}${skipMsg}.`,
      );
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={send}
        disabled={pending || !hasRecipients}
        title={
          hasRecipients
            ? "Send a test email to every address above"
            : "Save at least one email address first"
        }
        className="rounded-md border border-default bg-surface px-4 py-2 text-sm hover:border-strong transition disabled:opacity-50 inline-flex items-center gap-2"
      >
        {pending ? (
          <>
            <span className="rivlr-spinner" aria-hidden />
            Sending…
          </>
        ) : (
          "Send test email"
        )}
      </button>
      {feedback && (
        <span
          className={`text-xs font-mono ${
            tone === "ok"
              ? "text-green-500"
              : tone === "warn"
                ? "text-amber-400"
                : "text-signal"
          }`}
        >
          {feedback}
        </span>
      )}
    </>
  );
}
