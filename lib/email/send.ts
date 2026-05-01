import { Resend } from "resend";
import { db, schema } from "@/lib/db";
import { inArray } from "drizzle-orm";
import { unsubscribeUrl } from "./unsubscribe";

/**
 * Centralised email sender — every Rivlr email goes through here so we
 * get four things for free:
 *
 *   1. Unsubscribe filtering — addresses in email_unsubscribes are
 *      removed before send. No accidental sends to opted-out users.
 *   2. List-Unsubscribe header (RFC 8058) so Gmail / Outlook show the
 *      one-click unsubscribe button next to the From line.
 *   3. Per-recipient unsubscribe link in the footer (HMAC-signed).
 *   4. Single From-address + reply-to config in one place.
 *
 * Returns { sent: number; skipped: number } so callers can record sends
 * accurately into alert_log even when some recipients were skipped.
 */

const FROM_ADDRESS =
  process.env.RESEND_FROM ?? "Rivlr Intel <alerts@rivlr.app>";
const REPLY_TO = process.env.RESEND_REPLY_TO ?? "support@rivlr.app";
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://rivlr.app";

interface SendArgs {
  to: string[];
  subject: string;
  /** Pre-rendered HTML body. Use renderShell() to wrap content. */
  html: string;
  /** Optional plain-text fallback. */
  text?: string;
}

interface SendResult {
  sent: number;
  skipped: number;
  error?: string;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { sent: 0, skipped: args.to.length, error: "RESEND_API_KEY not set" };
  }

  // Filter unsubscribed addresses.
  const recipients = Array.from(
    new Set(args.to.map((e) => e.toLowerCase().trim()).filter(Boolean)),
  );
  if (recipients.length === 0) return { sent: 0, skipped: 0 };

  const unsubRows = await db
    .select({ email: schema.emailUnsubscribes.email })
    .from(schema.emailUnsubscribes)
    .where(inArray(schema.emailUnsubscribes.email, recipients));
  const unsubSet = new Set(unsubRows.map((r) => r.email));
  const allowed = recipients.filter((e) => !unsubSet.has(e));
  const skipped = recipients.length - allowed.length;
  if (allowed.length === 0) return { sent: 0, skipped };

  const resend = new Resend(resendKey);

  // Per-recipient send so the unsubscribe link in the footer + the
  // List-Unsubscribe header are correctly addressed to the actual
  // recipient (not the first in the list). Resend doesn't support
  // per-recipient headers in a single batch call.
  let sent = 0;
  for (const to of allowed) {
    const unsubLink = unsubscribeUrl(to, APP_BASE_URL);
    const personalisedHtml = args.html.replace(
      /\{\{UNSUBSCRIBE_URL\}\}/g,
      unsubLink,
    );
    const personalisedText = args.text?.replace(
      /\{\{UNSUBSCRIBE_URL\}\}/g,
      unsubLink,
    );

    try {
      await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        replyTo: REPLY_TO,
        subject: args.subject,
        html: personalisedHtml,
        text: personalisedText,
        headers: {
          // Gmail/Outlook one-click unsubscribe (RFC 8058)
          "List-Unsubscribe": `<${unsubLink}>, <mailto:unsubscribe@rivlr.app?subject=Unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;
    } catch {
      // best-effort — surface to UI is a future feature
    }
  }

  return { sent, skipped };
}
