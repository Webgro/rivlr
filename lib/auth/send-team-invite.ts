import { Resend } from "resend";
import { teamInviteEmail } from "@/lib/email/templates";

/**
 * Send a team-invite email. Like the magic-link send, this bypasses the
 * unsubscribe filter — it's transactional account access, not marketing.
 */

const FROM_ADDRESS =
  process.env.RESEND_FROM ?? "Rivlr Intel <alerts@rivlr.app>";
const REPLY_TO = process.env.RESEND_REPLY_TO ?? "support@rivlr.app";

export async function sendTeamInviteEmail(opts: {
  inviterEmail: string;
  inviteeEmail: string;
  url: string;
  expiresInMinutes: number;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  const resend = new Resend(apiKey);
  const built = teamInviteEmail(opts);
  const noOpUnsub = "https://rivlr.app/unsubscribe?token=signin";
  const html = built.html.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, noOpUnsub);
  const text = built.text.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, noOpUnsub);
  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: opts.inviteeEmail,
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
