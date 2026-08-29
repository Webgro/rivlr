import { db, schema, type TrackedProduct } from "@/lib/db";
import { eq, and, gt, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send";
import {
  stockInEmail,
  stockOutEmail,
  priceDropEmail,
  undercutEmail,
} from "@/lib/email/templates";

/**
 * Decides what alerts (if any) to fire for a single crawl observation, and
 * sends emails via Resend. Deduplication: each alert kind is suppressed if
 * the same kind has fired for the same product within the last 24h.
 *
 * Alert kinds:
 *  - stock_in / stock_out / price_drop: opt-in per product via the
 *    notify_* flags.
 *  - undercut: fires whenever a linked competitor's price crosses below
 *    the user's own price for the same item. Not gated by the per-product
 *    notify flags; being undercut is the highest-signal event we detect
 *    and the whole point of linking products. Dedupe still applies.
 *
 * Templates and unsubscribe handling live in lib/email/*; this module
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
type AlertKind = "stock_in" | "stock_out" | "price_drop" | "undercut";

interface PendingAlert {
  kind: AlertKind;
  build: () => { subject: string; html: string; text: string };
}

export async function sendAlertsForChange(input: AlertInput): Promise<void> {
  const { product } = input;

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

  // Undercut: this competitor product is linked (same group) to one of
  // the user's own products, and its price just crossed below the user's.
  // Only checked when the price moved down; crossing requires the
  // previous price to have been at or above the user's price so we alert
  // once per crossing, not on every subsequent drop (dedupe covers the
  // rest).
  if (
    product.groupId &&
    input.previousPrice !== null &&
    input.newPrice < input.previousPrice
  ) {
    const mine = await findLinkedOwnProduct(product);
    if (
      mine &&
      mine.price !== null &&
      input.newPrice < mine.price &&
      input.previousPrice >= mine.price
    ) {
      const myTitle = mine.title;
      const myPrice = mine.price;
      events.push({
        kind: "undercut",
        build: () =>
          undercutEmail({
            competitor: product,
            myTitle,
            myPrice,
            theirPrice: input.newPrice,
            currency: input.currency,
          }),
      });
    }
  }

  if (events.length === 0) return;

  // Per-user lookup — recipients live on the owning user's app_settings.
  const settings = await getSettings(product.userId);
  if (settings.notificationEmails.length === 0) return;

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

/**
 * Find the user's own product in the same group as this competitor
 * product, with its latest observed price. "Own" = the product sits on a
 * domain the user has marked as their store in user_store_prefs.
 */
async function findLinkedOwnProduct(
  competitor: TrackedProduct,
): Promise<{ title: string; price: number | null } | null> {
  const rows = await db.execute<{
    title: string | null;
    handle: string;
    price: string | null;
  }>(sql`
    SELECT p.title, p.handle, lp.price
    FROM tracked_products p
    JOIN user_store_prefs usp
      ON usp.user_id = p.user_id
     AND usp.domain = p.store_domain
     AND usp.is_my_store = true
    LEFT JOIN LATERAL (
      SELECT price FROM price_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) lp ON true
    WHERE p.group_id = ${competitor.groupId}::uuid
      AND p.user_id = ${competitor.userId}::uuid
      AND p.id != ${competitor.id}::uuid
    LIMIT 1
  `);
  const row = Array.from(rows)[0];
  if (!row) return null;
  return {
    title: row.title ?? row.handle,
    price: row.price !== null ? Number(row.price) : null,
  };
}

async function getSettings(userId: string) {
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, userId))
    .limit(1);
  return row ?? { notificationEmails: [] as string[] };
}
