/**
 * HTML chrome shared by every Rivlr email. Brand-consistent with the
 * marketing site (paper background, ink text, signal-red accent dot
 * after the wordmark). Inline styles only — most email clients (Outlook,
 * Apple Mail, Yahoo) strip <style> blocks.
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
<meta name="color-scheme" content="light dark">
<title>Rivlr</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f3ee;color:#0a0a0a;">
${preheader ? `<div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escape(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Wordmark -->
        <tr>
          <td style="padding:0 8px 24px;">
            <a href="${dashUrl}" style="text-decoration:none;color:#0a0a0a;">
              <span style="font-size:18px;font-weight:600;letter-spacing:-0.01em;">rivlr<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;vertical-align:middle;margin-left:4px;"></span></span>
            </a>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#ffffff;border-radius:14px;padding:32px;border:1px solid #e0ddd6;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 8px;font-size:12px;color:#888;line-height:1.6;">
            ${opts.footerNote ? `<div style="margin-bottom:8px;">${opts.footerNote}</div>` : ""}
            <a href="${dashUrl}" style="color:#888;text-decoration:underline;">Dashboard</a>
            &nbsp;·&nbsp;
            <a href="${settingsUrl}" style="color:#888;text-decoration:underline;">Manage notifications</a>
            &nbsp;·&nbsp;
            <a href="{{UNSUBSCRIBE_URL}}" style="color:#888;text-decoration:underline;">Unsubscribe</a>
            <div style="margin-top:8px;">Rivlr · a Webgro Ltd product, made in London.</div>
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
