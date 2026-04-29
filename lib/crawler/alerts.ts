import { db, schema, type TrackedProduct } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";
import { Resend } from "resend";

/**
 * Decides what alerts (if any) to fire for a single crawl observation, and
 * sends emails via Resend. Deduplication: each alert kind is suppressed if
 * the same kind has fired for the same product within the last 24h.
 */

interface AlertInput {
  product: TrackedProduct;
  previousPrice: number | null;
  newPrice: number;
  previousAvailable: boolean | null;
  newAvailable: boolean;
  currency: string;
}

const DEDUPE_WINDOW_HOURS = 24;

export async function sendAlertsForChange(input: AlertInput): Promise<void> {
  const { product } = input;

  // Bail early if no notifications enabled OR no recipients configured.
  if (!product.notifyStockChanges && !product.notifyPriceDrops) return;
  const settings = await getSettings();
  if (settings.notificationEmails.length === 0) return;

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM ?? "alerts@rivlr.app";
  if (!resendKey) return; // No key configured — silently skip until set.

  const resend = new Resend(resendKey);
  const events: Array<{
    kind: "stock_in" | "stock_out" | "price_drop";
    subject: string;
    body: string;
  }> = [];

  // Stock change
  if (
    product.notifyStockChanges &&
    input.previousAvailable !== null &&
    input.previousAvailable !== input.newAvailable
  ) {
    if (input.newAvailable) {
      events.push({
        kind: "stock_in",
        subject: `Back in stock: ${product.title ?? product.handle}`,
        body: stockBackInBody(product),
      });
    } else {
      events.push({
        kind: "stock_out",
        subject: `Out of stock: ${product.title ?? product.handle}`,
        body: stockOutBody(product),
      });
    }
  }

  // Price drop
  if (
    product.notifyPriceDrops &&
    input.previousPrice !== null &&
    input.newPrice < input.previousPrice
  ) {
    events.push({
      kind: "price_drop",
      subject: `Price drop: ${product.title ?? product.handle}`,
      body: priceDropBody(
        product,
        input.previousPrice,
        input.newPrice,
        input.currency,
      ),
    });
  }

  if (events.length === 0) return;

  // Dedupe — suppress kinds that have fired in the last 24h.
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);
  const recent = await db
    .select({ kind: schema.alertLog.kind })
    .from(schema.alertLog)
    .where(
      and(
        eq(schema.alertLog.productId, product.id),
        gt(schema.alertLog.sentAt, cutoff),
      ),
    );
  const suppressed = new Set(recent.map((r) => r.kind));

  for (const evt of events) {
    if (suppressed.has(evt.kind)) continue;
    try {
      await resend.emails.send({
        from: fromAddress,
        to: settings.notificationEmails,
        subject: evt.subject,
        html: evt.body,
      });
      await db.insert(schema.alertLog).values({
        productId: product.id,
        kind: evt.kind,
        sentAt: new Date(),
      });
    } catch {
      // log silently — surfacing to UI is a future feature
    }
  }
}

async function getSettings() {
  const [row] = await db.select().from(schema.appSettings).limit(1);
  return row ?? { notificationEmails: [] as string[] };
}

// ─── Email templates ────────────────────────────────────────────────────

function shell(productUrl: string, dashboardUrl: string, body: string) {
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f5f3ee;padding:32px;color:#0a0a0a;">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;">
  <tr><td style="padding-bottom:24px;">
    <span style="font-size:18px;font-weight:600;">rivlr<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b30;vertical-align:middle;margin-left:4px;"></span></span>
  </td></tr>
  <tr><td style="background:white;border-radius:12px;padding:32px;border:1px solid #e0ddd6;">
    ${body}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e0ddd6;font-size:13px;color:#666;">
      <a href="${productUrl}" style="color:#0a0a0a;">View on competitor →</a> &nbsp;·&nbsp;
      <a href="${dashboardUrl}" style="color:#0a0a0a;">Open dashboard →</a>
    </div>
  </td></tr>
  <tr><td style="padding-top:16px;font-size:12px;color:#888;text-align:center;">
    Rivlr — a Webgro product. <a href="${dashboardUrl}/settings" style="color:#888;">Manage notifications</a>
  </td></tr>
</table>
</body></html>`;
}

function stockOutBody(p: TrackedProduct) {
  const dashUrl = "https://rivlr.app/dashboard";
  return shell(
    p.url,
    dashUrl,
    `<h2 style="margin:0 0 8px;font-size:20px;letter-spacing:-0.01em;">Out of stock: ${escape(p.title ?? p.handle)}</h2>
<p style="margin:0;color:#444;font-size:14px;">A competitor product you're tracking just went out of stock at <strong>${escape(p.storeDomain)}</strong>.</p>`,
  );
}

function stockBackInBody(p: TrackedProduct) {
  const dashUrl = "https://rivlr.app/dashboard";
  return shell(
    p.url,
    dashUrl,
    `<h2 style="margin:0 0 8px;font-size:20px;letter-spacing:-0.01em;">Back in stock: ${escape(p.title ?? p.handle)}</h2>
<p style="margin:0;color:#444;font-size:14px;">Restocked at <strong>${escape(p.storeDomain)}</strong>.</p>`,
  );
}

function priceDropBody(
  p: TrackedProduct,
  prev: number,
  now: number,
  currency: string,
) {
  const dashUrl = "https://rivlr.app/dashboard";
  const symbol = currencyToSymbol(currency);
  const drop = (prev - now).toFixed(2);
  const pct = (((prev - now) / prev) * 100).toFixed(1);
  return shell(
    p.url,
    dashUrl,
    `<h2 style="margin:0 0 8px;font-size:20px;letter-spacing:-0.01em;">Price drop: ${escape(p.title ?? p.handle)}</h2>
<p style="margin:0 0 12px;color:#444;font-size:14px;">${escape(p.storeDomain)} cut the price.</p>
<p style="font-size:20px;margin:0;"><span style="text-decoration:line-through;color:#888;">${symbol}${prev.toFixed(2)}</span> &nbsp;<strong style="color:#ff3b30;">${symbol}${now.toFixed(2)}</strong> <span style="font-size:13px;color:#666;">(−${symbol}${drop} / −${pct}%)</span></p>`,
  );
}

function currencyToSymbol(c: string) {
  switch (c) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return c + " ";
  }
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
