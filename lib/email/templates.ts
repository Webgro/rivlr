import { type TrackedProduct } from "@/lib/db";
import { renderShell, escape, currencySymbol } from "./shell";

/**
 * All transactional + digest email templates in one place. Each function
 * returns { subject, html, text } so the sender doesn't have to know
 * about layout. Templates accept an `unsubscribeUrl` placeholder in the
 * shell that the sender substitutes per recipient.
 *
 * Colour palette (matches the dark site theme):
 *   #0a0a0a  body bg (ink)
 *   #141414  card bg (elevated)
 *   #1a1a1a  inner highlight bg (deeper elevated)
 *   #262626  border
 *   #f5f3ee  primary text (paper, slightly off-white to avoid halation)
 *   #c0c0c0  body text
 *   #8a8a8a  muted text
 *   #ff3b30  signal accent
 *   #16a34a  positive (price drop, in stock)
 *   #d97706  warning (amber)
 */

interface Built {
  subject: string;
  html: string;
  text: string;
}

// ─── Stock-out ─────────────────────────────────────────────────────────
export function stockOutEmail(p: TrackedProduct): Built {
  const subject = `Out of stock: ${p.title ?? p.handle}`;
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">Out of stock</h1>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;">A competitor product you're tracking just went out of stock at <strong style="color:#f5f3ee;">${escape(p.storeDomain)}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;border:1px solid #262626;margin:0 0 20px;">
  <tr><td style="padding:16px;">
    <div style="font-weight:600;font-size:15px;color:#f5f3ee;margin-bottom:4px;">${escape(p.title ?? p.handle)}</div>
    <div style="font-size:13px;color:#8a8a8a;font-family:ui-monospace,monospace;">${escape(p.storeDomain)}</div>
  </td></tr>
</table>
<a href="${p.url}" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">View on competitor's site →</a>
<div style="margin-top:16px;font-size:13px;color:#8a8a8a;line-height:1.6;">This is your moment — hold prices, run a campaign, or order more from your supplier before they restock.</div>`,
    {
      preheader: `${p.title ?? p.handle} is sold out at ${p.storeDomain}`,
    },
  );
  const text = `Out of stock: ${p.title ?? p.handle}\n\nA competitor product just went out of stock at ${p.storeDomain}.\n\nView: ${p.url}\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}

// ─── Stock-in ──────────────────────────────────────────────────────────
export function stockInEmail(p: TrackedProduct): Built {
  const subject = `Back in stock: ${p.title ?? p.handle}`;
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">Back in stock</h1>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;">Restocked at <strong style="color:#f5f3ee;">${escape(p.storeDomain)}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;border:1px solid #262626;margin:0 0 20px;">
  <tr><td style="padding:16px;">
    <div style="font-weight:600;font-size:15px;color:#f5f3ee;margin-bottom:4px;">${escape(p.title ?? p.handle)}</div>
    <div style="font-size:13px;color:#8a8a8a;font-family:ui-monospace,monospace;">${escape(p.storeDomain)}</div>
  </td></tr>
</table>
<a href="${p.url}" style="display:inline-block;background:#f5f3ee;color:#0a0a0a;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">View on competitor's site →</a>`,
    {
      preheader: `${p.title ?? p.handle} is restocked at ${p.storeDomain}`,
    },
  );
  const text = `Back in stock: ${p.title ?? p.handle}\n\nRestocked at ${p.storeDomain}.\n\nView: ${p.url}\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}

// ─── Price-drop ────────────────────────────────────────────────────────
export function priceDropEmail(
  p: TrackedProduct,
  prev: number,
  now: number,
  currency: string,
): Built {
  const symbol = currencySymbol(currency);
  const drop = (prev - now).toFixed(2);
  const pct = (((prev - now) / prev) * 100).toFixed(1);
  const subject = `Price drop −${pct}%: ${p.title ?? p.handle}`;
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">Price drop</h1>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;"><strong style="color:#f5f3ee;">${escape(p.storeDomain)}</strong> just cut the price of a product you're tracking.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;border:1px solid #262626;margin:0 0 20px;">
  <tr><td style="padding:16px;">
    <div style="font-weight:600;font-size:15px;color:#f5f3ee;margin-bottom:8px;">${escape(p.title ?? p.handle)}</div>
    <div style="font-size:18px;line-height:1;">
      <span style="text-decoration:line-through;color:#666;font-size:14px;">${symbol}${prev.toFixed(2)}</span>
      &nbsp;
      <strong style="color:#ff3b30;font-weight:600;">${symbol}${now.toFixed(2)}</strong>
      <span style="font-size:13px;color:#8a8a8a;margin-left:6px;">(−${symbol}${drop} / −${pct}%)</span>
    </div>
  </td></tr>
</table>
<a href="${p.url}" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">View on competitor's site →</a>`,
    {
      preheader: `${symbol}${prev.toFixed(2)} → ${symbol}${now.toFixed(2)} at ${p.storeDomain}`,
    },
  );
  const text = `Price drop: ${p.title ?? p.handle}\n\n${symbol}${prev.toFixed(2)} → ${symbol}${now.toFixed(2)} (−${pct}%) at ${p.storeDomain}.\n\nView: ${p.url}\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}

// ─── Days-cover warning ────────────────────────────────────────────────
export function daysCoverWarningEmail(
  p: TrackedProduct,
  daysCover: number,
  qty: number,
  dailyRate: number,
): Built {
  const subject = `Competitor going dark in ${daysCover.toFixed(1)} days: ${p.title ?? p.handle}`;
  const daysColor = daysCover < 3 ? "#ff3b30" : "#d97706";
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">Competitor about to go dark</h1>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;">A competitor product you track is running low on stock relative to its sales rate. They're likely to go out of stock soon.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;border:1px solid #262626;margin:0 0 20px;">
  <tr><td style="padding:16px;">
    <div style="font-weight:600;font-size:15px;color:#f5f3ee;margin-bottom:12px;">${escape(p.title ?? p.handle)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
      <tr>
        <td style="color:#8a8a8a;padding:2px 0;">Current stock</td>
        <td style="text-align:right;font-family:ui-monospace,monospace;color:#f5f3ee;">${qty} units</td>
      </tr>
      <tr>
        <td style="color:#8a8a8a;padding:2px 0;">Selling at</td>
        <td style="text-align:right;font-family:ui-monospace,monospace;color:#f5f3ee;">${dailyRate.toFixed(1)}/day</td>
      </tr>
      <tr>
        <td style="color:#8a8a8a;padding:2px 0;font-weight:600;">Days cover</td>
        <td style="text-align:right;font-family:ui-monospace,monospace;font-weight:600;color:${daysColor};">${daysCover.toFixed(1)} days</td>
      </tr>
    </table>
  </td></tr>
</table>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;">Hold your prices, time a campaign for when they go dark, or order more from your supplier — this is the playbook.</p>
<a href="${p.url}" style="display:inline-block;background:#f5f3ee;color:#0a0a0a;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">View product →</a>`,
    {
      preheader: `${qty} units selling ${dailyRate.toFixed(1)}/day = ${daysCover.toFixed(1)} days left`,
    },
  );
  const text = `Competitor about to go dark: ${p.title ?? p.handle}\n\n${qty} units in stock, selling ${dailyRate.toFixed(1)}/day = ${daysCover.toFixed(1)} days cover.\n\nView: ${p.url}\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}

// ─── Weekly digest ─────────────────────────────────────────────────────
export interface DigestPayload {
  weekStart: Date;
  totalActive: number;
  priceChanges: number;
  stockChanges: number;
  newDiscoveries: number;
  topMovers: Array<{
    title: string;
    storeDomain: string;
    deltaPct: number;
    direction: "drop" | "rise";
    url: string;
  }>;
  oosNow: Array<{ title: string; storeDomain: string; daysOos: number; url: string }>;
}

export function weeklyDigestEmail(p: DigestPayload): Built {
  const range = p.weekStart.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  const subject = `Rivlr weekly · ${p.priceChanges} price moves, ${p.stockChanges} stock changes`;

  const moversHtml =
    p.topMovers.length > 0
      ? p.topMovers
          .map(
            (m) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid #262626;">
                 <a href="${m.url}" style="color:#f5f3ee;text-decoration:none;font-size:14px;">${escape(m.title)}</a><br>
                 <span style="font-size:12px;color:#8a8a8a;font-family:ui-monospace,monospace;">${escape(m.storeDomain)}</span>
               </td>
               <td style="padding:8px 0;border-bottom:1px solid #262626;text-align:right;font-family:ui-monospace,monospace;font-size:14px;font-weight:600;color:${m.direction === "drop" ? "#16a34a" : "#ff3b30"};">
                 ${m.direction === "drop" ? "−" : "+"}${Math.abs(m.deltaPct)}%
               </td></tr>`,
          )
          .join("")
      : `<tr><td style="padding:12px 0;color:#8a8a8a;font-size:13px;">No notable price moves this week.</td></tr>`;

  const oosHtml =
    p.oosNow.length > 0
      ? p.oosNow
          .map(
            (o) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid #262626;">
                 <a href="${o.url}" style="color:#f5f3ee;text-decoration:none;font-size:14px;">${escape(o.title)}</a><br>
                 <span style="font-size:12px;color:#8a8a8a;font-family:ui-monospace,monospace;">${escape(o.storeDomain)}</span>
               </td>
               <td style="padding:8px 0;border-bottom:1px solid #262626;text-align:right;font-family:ui-monospace,monospace;font-size:14px;color:#ff3b30;">
                 ${o.daysOos}d out
               </td></tr>`,
          )
          .join("")
      : "";

  const html = renderShell(
    `<h1 style="margin:0 0 4px;font-size:22px;letter-spacing:-0.02em;color:#f5f3ee;font-weight:600;">Weekly intel</h1>
<p style="margin:0 0 24px;color:#8a8a8a;font-size:13px;font-family:ui-monospace,monospace;text-transform:uppercase;letter-spacing:0.05em;">Week of ${range}</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
  <tr>
    <td bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;padding:14px;text-align:center;border:1px solid #262626;">
      <div style="font-size:20px;font-weight:600;color:#f5f3ee;">${p.totalActive}</div>
      <div style="font-size:11px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.05em;font-family:ui-monospace,monospace;margin-top:2px;">tracked</div>
    </td>
    <td style="width:8px;"></td>
    <td bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;padding:14px;text-align:center;border:1px solid #262626;">
      <div style="font-size:20px;font-weight:600;color:#f5f3ee;">${p.priceChanges}</div>
      <div style="font-size:11px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.05em;font-family:ui-monospace,monospace;margin-top:2px;">price moves</div>
    </td>
    <td style="width:8px;"></td>
    <td bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;padding:14px;text-align:center;border:1px solid #262626;">
      <div style="font-size:20px;font-weight:600;color:#f5f3ee;">${p.stockChanges}</div>
      <div style="font-size:11px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.05em;font-family:ui-monospace,monospace;margin-top:2px;">stock changes</div>
    </td>
    <td style="width:8px;"></td>
    <td bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;padding:14px;text-align:center;border:1px solid #262626;">
      <div style="font-size:20px;font-weight:600;color:#f5f3ee;">${p.newDiscoveries}</div>
      <div style="font-size:11px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.05em;font-family:ui-monospace,monospace;margin-top:2px;">new launches</div>
    </td>
  </tr>
</table>

<h2 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#8a8a8a;font-family:ui-monospace,monospace;font-weight:500;">Top movers</h2>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
  ${moversHtml}
</table>

${
  p.oosNow.length > 0
    ? `<h2 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#8a8a8a;font-family:ui-monospace,monospace;font-weight:500;">Currently out of stock</h2>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
  ${oosHtml}
</table>`
    : ""
}

<a href="https://rivlr.app/dashboard" style="display:inline-block;background:#f5f3ee;color:#0a0a0a;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">Open dashboard →</a>`,
    {
      preheader: `${p.priceChanges} price moves, ${p.stockChanges} stock changes, ${p.newDiscoveries} new launches`,
    },
  );

  const text = `Rivlr weekly · week of ${range}\n\nTracked: ${p.totalActive}\nPrice moves: ${p.priceChanges}\nStock changes: ${p.stockChanges}\nNew launches: ${p.newDiscoveries}\n\nDashboard: https://rivlr.app/dashboard\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}

// ─── Magic-link sign-in ────────────────────────────────────────────────
export function magicLinkEmail(opts: {
  url: string;
  expiresInMinutes: number;
}): Built {
  const subject = "Your Rivlr sign-in link";
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">Sign in to Rivlr</h1>
<p style="margin:0 0 20px;color:#c0c0c0;font-size:14px;line-height:1.6;">Click the button below to sign in. The link works for ${opts.expiresInMinutes} minutes and can only be used once.</p>
<a href="${opts.url}" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">Sign in →</a>
<p style="margin:20px 0 0;color:#8a8a8a;font-size:12px;line-height:1.6;">If the button doesn&apos;t work, copy and paste this URL:<br>
<a href="${opts.url}" style="color:#8a8a8a;word-break:break-all;text-decoration:underline;">${opts.url}</a></p>
<p style="margin:16px 0 0;color:#8a8a8a;font-size:12px;line-height:1.6;">Didn&apos;t request this? You can ignore this email — no one can sign in without clicking the link.</p>`,
    {
      preheader: `Click to sign in. Link expires in ${opts.expiresInMinutes} minutes.`,
    },
  );
  const text = `Sign in to Rivlr\n\nClick the link below to sign in. Expires in ${opts.expiresInMinutes} minutes.\n\n${opts.url}\n\nDidn't request this? Ignore this email.`;
  return { subject, html, text };
}

// ─── Test email ────────────────────────────────────────────────────────
export function testEmail(): Built {
  const subject = "Rivlr · test email";
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">Email is working <span style="color:#16a34a;">✓</span></h1>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;">If you're seeing this, your notification email is correctly wired up. Real alerts will start landing here when products you're tracking change price or stock.</p>
<a href="https://rivlr.app/settings" style="display:inline-block;background:#f5f3ee;color:#0a0a0a;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">Open settings →</a>`,
    {
      preheader: "Your Rivlr notification email is working.",
    },
  );
  const text = `Rivlr — test email\n\nEmail is working. Real alerts will land here as products change.\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}
