import { db, schema, type TrackedProduct } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send";
import {
  stockInEmail,
  stockOutEmail,
  priceDropEmail,
} from "@/lib/email/templates";

/**
 * Decides what alerts (if any) to fire for a single crawl observation, and
 * sends emails via Resend. Deduplication: each alert kind is suppressed if
 * the same kind has fired for the same product within the last 24h.
 *
 * Templates and unsubscribe handling live in lib/email/* — this module
 * just owns the decision logic.
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
type AlertKind = "stock_in" | "stock_out" | "price_drop";

interface PendingAlert {
  kind: AlertKind;
  build: () => { subject: string; html: string; text: string };
}

export async function sendAlertsForChange(input: AlertInput): Promise<void> {
  const { product } = input;

  // Bail early if no notifications enabled OR no recipients configured.
  if (!product.notifyStockChanges && !product.notifyPriceDrops) return;
  const settings = await getSettings();
  if (settings.notificationEmails.length === 0) return;

  const events: PendingAlert[] = [];

  // Stock change
  if (
    product.notifyStockChanges &&
    input.previousAvailable !== null &&
    input.previousAvailable !== input.newAvailable
  ) {
    if (input.newAvailable) {
      events.push({
        kind: "stock_in",
        build: () => stockInEmail(product),
      });
    } else {
      events.push({
        kind: "stock_out",
        build: () => stockOutEmail(product),
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
      build: () =>
        priceDropEmail(
          product,
          input.previousPrice!,
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
    const built = evt.build();
    const result = await sendEmail({
      to: settings.notificationEmails,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });
    if (result.sent > 0) {
      await db.insert(schema.alertLog).values({
        productId: product.id,
        kind: evt.kind,
        sentAt: new Date(),
      });
    }
  }
}

async function getSettings() {
  const [row] = await db.select().from(schema.appSettings).limit(1);
  return row ?? { notificationEmails: [] as string[] };
}
