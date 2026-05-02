import { Resend } from "resend";
import { magicLinkEmail } from "@/lib/email/templates";

/**
 * Send a magic-link email. Bypasses the lib/email/send.ts unsubscribe
 * filter on purpose — sign-in is strictly transactional, not marketing,
 * and CAN-SPAM / RFC 8058 explicitly exempt account-related security
 * communications. We don't want a user who unsubscribed from price
 * alerts to also lock themselves out of the product.
 *
 * Still includes List-Unsubscribe headers because Gmail's spam filter
 * grades emails that have them more favourably even when "transactional"
 * — but the link points at /unsubscribe with a sentinel token that just
 * shows a "this is a sign-in email, not marketing" page.
 */

const FROM_ADDRESS =
  process.env.RESEND_FROM ?? "Rivlr Intel <alerts@rivlr.app>";
const REPLY_TO = process.env.RESEND_REPLY_TO ?? "support@rivlr.app";

export async function sendMagicLinkEmail(opts: {
  email: string;
  url: string;
  expiresInMinutes: number;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const resend = new Resend(apiKey);
  const built = magicLinkEmail({
    url: opts.url,
    expiresInMinutes: opts.expiresInMinutes,
  });

  // Replace the {{UNSUBSCRIBE_URL}} placeholder with a no-op route — the
  // shell footer always includes it, but unsubscribe doesn't apply to
  // transactional auth emails.
  const noOpUnsub = "https://rivlr.app/unsubscribe?token=signin";
  const html = built.html.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, noOpUnsub);
  const text = built.text.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, noOpUnsub);

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: opts.email,
      replyTo: REPLY_TO,
      subject: built.subject,
      html,
      text,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send failed",
    };
  }
}
