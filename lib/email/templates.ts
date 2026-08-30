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
<div style="margin-top:16px;font-size:13px;color:#8a8a8a;line-height:1.6;">This is your moment: hold your prices, run a promotion, or order more from your supplier before they restock.</div>`,
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

// ─── Undercut ──────────────────────────────────────────────────────────
/**
 * Fired when a linked competitor's price drops below the user's own
 * price for the same item. The highest-signal alert we send: it names
 * both products and both prices so the user can decide on a reprice
 * without opening the app.
 */
export function undercutEmail(opts: {
  competitor: TrackedProduct;
  myTitle: string;
  myPrice: number;
  theirPrice: number;
  currency: string;
}): Built {
  const { competitor, myTitle, myPrice, theirPrice, currency } = opts;
  const symbol = currencySymbol(currency);
  const gap = (myPrice - theirPrice).toFixed(2);
  const pct = (((myPrice - theirPrice) / myPrice) * 100).toFixed(1);
  const subject = `You've been undercut: ${myTitle}`;
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">You've been undercut</h1>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;"><strong style="color:#f5f3ee;">${escape(competitor.storeDomain)}</strong> just priced the item linked to <strong style="color:#f5f3ee;">${escape(myTitle)}</strong> below yours.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;border:1px solid #262626;margin:0 0 20px;">
  <tr><td style="padding:16px;">
    <div style="font-size:13px;color:#8a8a8a;margin-bottom:4px;">Your price</div>
    <div style="font-size:18px;color:#f5f3ee;font-weight:600;margin-bottom:12px;">${symbol}${myPrice.toFixed(2)}</div>
    <div style="font-size:13px;color:#8a8a8a;margin-bottom:4px;">Their price (${escape(competitor.storeDomain)})</div>
    <div style="font-size:18px;color:#ff3b30;font-weight:600;">${symbol}${theirPrice.toFixed(2)} <span style="font-size:13px;color:#8a8a8a;font-weight:400;">(${symbol}${gap} / ${pct}% below you)</span></div>
  </td></tr>
</table>
<a href="${competitor.url}" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">See their listing</a>
<div style="margin-top:16px;font-size:13px;color:#8a8a8a;line-height:1.6;">Hold, match, or ride it out. Whatever you decide, now you know.</div>`,
    {
      preheader: `${competitor.storeDomain} is now ${symbol}${gap} below you on ${myTitle}`,
    },
  );
  const text = `You've been undercut: ${myTitle}\n\nYour price: ${symbol}${myPrice.toFixed(2)}\nTheir price (${competitor.storeDomain}): ${symbol}${theirPrice.toFixed(2)} (${pct}% below you)\n\nTheir listing: ${competitor.url}\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}

// ─── Days-cover warning ────────────────────────────────────────────────
export function daysCoverWarningEmail(
  p: TrackedProduct,
  daysCover: number,
  qty: number,
  dailyRate: number,
): Built {
  const subject = `Competitor selling out in ${daysCover.toFixed(1)} days: ${p.title ?? p.handle}`;
  const daysColor = daysCover < 3 ? "#ff3b30" : "#d97706";
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">Competitor about to sell out</h1>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;">A competitor product you track is selling faster than its remaining stock will last. At this rate they'll be out of stock soon.</p>
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
        <td style="color:#8a8a8a;padding:2px 0;font-weight:600;">Days left</td>
        <td style="text-align:right;font-family:ui-monospace,monospace;font-weight:600;color:${daysColor};">${daysCover.toFixed(1)} days</td>
      </tr>
    </table>
  </td></tr>
</table>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;">Hold your prices, time a promotion for when they sell out, or order more from your supplier. That's the playbook.</p>
<a href="${p.url}" style="display:inline-block;background:#f5f3ee;color:#0a0a0a;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">View product →</a>`,
    {
      preheader: `${qty} units selling ${dailyRate.toFixed(1)}/day = ${daysCover.toFixed(1)} days left`,
    },
  );
  const text = `Competitor about to sell out: ${p.title ?? p.handle}\n\n${qty} units in stock, selling ${dailyRate.toFixed(1)}/day = ${daysCover.toFixed(1)} days left.\n\nView: ${p.url}\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
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

// ─── Welcome (first signup) ────────────────────────────────────────────
export function welcomeEmail(opts: { email: string }): Built {
  const subject = "Welcome to Rivlr";
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">Welcome to Rivlr</h1>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;">You&apos;re in. Here&apos;s what&apos;s waiting for you on the dashboard:</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1a1a" style="background:#1a1a1a;border-radius:8px;border:1px solid #262626;margin:0 0 20px;">
  <tr><td style="padding:18px;">
    <ul style="margin:0;padding:0 0 0 18px;color:#c0c0c0;font-size:14px;line-height:1.8;">
      <li>Paste any Shopify product link and Rivlr starts watching the price &amp; stock</li>
      <li>Mark your own store to unlock the <strong style="color:#f5f3ee;">Opportunities</strong> view</li>
      <li>Get email alerts the moment competitors drop a price or run out of stock</li>
      <li>See competitor prices in other countries: UK, Ireland, US, Germany and more</li>
      <li>Exact stock counts, even when a store only shows &quot;In stock&quot;</li>
    </ul>
  </td></tr>
</table>

<a href="https://rivlr.app/dashboard" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">Open dashboard →</a>

<p style="margin:20px 0 0;color:#8a8a8a;font-size:12px;line-height:1.6;">Stuck or curious? Just reply to this email, a real person reads it.</p>`,
    {
      preheader: "Your Rivlr account is ready. Here's what's inside.",
    },
  );
  const text = `Welcome to Rivlr.\n\nYou're in. On the dashboard you can:\n- Paste any Shopify product link to start tracking price & stock\n- Mark your own store to unlock Opportunities\n- Get email alerts on competitor price drops & sell-outs\n- See competitor prices in other countries (UK/Ireland/US/Germany and more)\n- Get exact stock counts, even when a store only shows "In stock"\n\nDashboard: https://rivlr.app/dashboard\n\nStuck? Reply to this email, a real person reads it.\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}

// ─── Guided setup finished ─────────────────────────────────────────────

/**
 * Sent when both catalogue imports finish, so the setup screen can
 * honestly tell people to close the tab. A big pair of catalogues takes
 * minutes, and sitting on a progress bar is a poor use of anyone's
 * afternoon.
 */
export function setupReadyEmail(opts: {
  matchCount: number;
  competitorDomain: string | null;
}): Built {
  const { matchCount, competitorDomain } = opts;
  const hasMatches = matchCount > 0;
  const subject = hasMatches
    ? `Your ${matchCount} matched product${matchCount === 1 ? "" : "s"} are ready`
    : "Your Rivlr setup is ready";

  const headline = hasMatches
    ? `We found ${matchCount} product${matchCount === 1 ? "" : "s"} you both sell`
    : "Your catalogue is ready";
  const body = hasMatches
    ? `We've finished reading both catalogues${
        competitorDomain ? ` and compared yours against ${escape(competitorDomain)}` : ""
      }. Pick which ones to watch and we'll email you whenever their price or stock moves.`
    : "We've finished reading the catalogue. Choose the products you'd like to keep an eye on and we'll take it from there.";

  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">${escape(headline)}</h1>
<p style="margin:0 0 20px;color:#c0c0c0;font-size:14px;line-height:1.6;">${body}</p>

<a href="https://rivlr.app/welcome" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">Finish setting up →</a>

<p style="margin:20px 0 0;color:#8a8a8a;font-size:12px;line-height:1.6;">This picks up exactly where you left off.</p>`,
    { preheader: hasMatches ? `${matchCount} products matched and ready to track.` : "Your catalogue import has finished." },
  );

  const text = `${headline}\n\n${body.replace(/<[^>]+>/g, "")}\n\nFinish setting up: https://rivlr.app/welcome\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}

// ─── Team invite ───────────────────────────────────────────────────────
export function teamInviteEmail(opts: {
  inviterEmail: string;
  inviteeEmail: string;
  url: string;
  expiresInDays: number;
}): Built {
  const subject = `${opts.inviterEmail} invited you to their Rivlr account`;
  const html = renderShell(
    `<h1 style="margin:0 0 12px;font-size:20px;letter-spacing:-0.01em;color:#f5f3ee;font-weight:600;">You&apos;ve been invited to Rivlr</h1>
<p style="margin:0 0 16px;color:#c0c0c0;font-size:14px;line-height:1.6;"><strong style="color:#f5f3ee;">${escape(opts.inviterEmail)}</strong> added <strong style="color:#f5f3ee;">${escape(opts.inviteeEmail)}</strong> to their Rivlr account. You&apos;ll see all the products and stores they track.</p>
<a href="${opts.url}" style="display:inline-block;background:#ff3b30;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">Accept &amp; sign in →</a>
<p style="margin:20px 0 0;color:#8a8a8a;font-size:13px;line-height:1.6;">No rush, this link works for <strong style="color:#c0c0c0;">${opts.expiresInDays} days</strong>. After that (or any time you prefer), you can also sign in at <a href="https://rivlr.app/login" style="color:#c0c0c0;text-decoration:underline;">rivlr.app/login</a> using <strong style="color:#c0c0c0;">${escape(opts.inviteeEmail)}</strong>, your address is already on the account.</p>
<p style="margin:16px 0 0;color:#8a8a8a;font-size:12px;line-height:1.6;">If you weren&apos;t expecting this, ignore the email, clicking is the only way you get added.</p>
<p style="margin:16px 0 0;color:#8a8a8a;font-size:12px;line-height:1.6;">If the button doesn&apos;t work, copy and paste:<br>
<a href="${opts.url}" style="color:#8a8a8a;word-break:break-all;text-decoration:underline;">${opts.url}</a></p>`,
    {
      preheader: `${opts.inviterEmail} added you to their Rivlr account.`,
    },
  );
  const text = `${opts.inviterEmail} invited you to their Rivlr account.\n\nAccept & sign in: ${opts.url}\n\nThis link works for ${opts.expiresInDays} days. Or sign in any time at https://rivlr.app/login with ${opts.inviteeEmail}.`;
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
<p style="margin:16px 0 0;color:#8a8a8a;font-size:12px;line-height:1.6;">Didn&apos;t request this? You can ignore this email, no one can sign in without clicking the link.</p>`,
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
  const text = `Rivlr, test email\n\nEmail is working. Real alerts will land here as products change.\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;
  return { subject, html, text };
}
