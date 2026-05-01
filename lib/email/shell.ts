/**
 * HTML chrome shared by every Rivlr email. Brand-consistent with the
 * dark marketing site — ink (#0a0a0a) body, elevated (#141414) card,
 * paper (#f5f3ee) text, signal (#ff3b30) accent.
 *
 * Email-client compatibility notes:
 *  - color-scheme meta + supported-color-schemes meta tells iOS Mail /
 *    Apple Mail / new Outlook that we explicitly want a dark render and
 *    not to auto-invert. Gmail (web + iOS) respects this since 2024.
 *  - We use bgcolor= on tables in addition to inline CSS — Outlook's
 *    Word renderer ignores CSS background on table cells but does
 *    respect bgcolor.
 *  - All styles inline (no <style> block) — most clients strip <style>.
 *  - Body text intentionally not pure-white (#f5f3ee paper) to avoid
 *    halation against the ink background. Same colour as the site.
 *
 * Drop {{UNSUBSCRIBE_URL}} placeholders in here — lib/email/send.ts
 * substitutes the real per-recipient link before send.
 */

export function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ShellOpts {
  preheader?: string;
  footerNote?: string;
}

export function renderShell(body: string, opts: ShellOpts = {}): string {
  const dashUrl = "https://rivlr.app/dashboard";
  const settingsUrl = "https://rivlr.app/settings";
  const preheader = opts.preheader ?? "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Rivlr</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#f5f3ee;">
${preheader ? `<div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escape(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="background:#0a0a0a;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Wordmark -->
        <tr>
          <td style="padding:0 8px 24px;">
            <a href="${dashUrl}" style="text-decoration:none;color:#f5f3ee;">
              <span style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:#f5f3ee;">rivlr<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;vertical-align:middle;margin-left:4px;"></span></span>
            </a>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td bgcolor="#141414" style="background:#141414;border-radius:14px;padding:32px;border:1px solid #262626;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 8px;font-size:12px;color:#8a8a8a;line-height:1.6;">
            ${opts.footerNote ? `<div style="margin-bottom:8px;">${opts.footerNote}</div>` : ""}
            <a href="${dashUrl}" style="color:#8a8a8a;text-decoration:underline;">Dashboard</a>
            &nbsp;·&nbsp;
            <a href="${settingsUrl}" style="color:#8a8a8a;text-decoration:underline;">Manage notifications</a>
            &nbsp;·&nbsp;
            <a href="{{UNSUBSCRIBE_URL}}" style="color:#8a8a8a;text-decoration:underline;">Unsubscribe</a>
            <div style="margin-top:8px;color:#666;">Rivlr · a Webgro Ltd product, made in London.</div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Currency symbol helper shared across templates. */
export function currencySymbol(c: string): string {
  switch (c) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "CAD":
      return "CA$";
    case "AUD":
      return "A$";
    default:
      return c + " ";
  }
}
