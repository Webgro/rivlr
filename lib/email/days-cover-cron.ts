import { db, schema } from "@/lib/db";
import { sql, and, eq, gt } from "drizzle-orm";
import { sendEmail } from "./send";
import { daysCoverWarningEmail } from "./templates";

/**
 * Daily check for competitors about to go out of stock. Fires one email
 * per qualifying competitor product, deduped within 7 days (we don't
 * want to nag every morning when stock is consistently low).
 *
 * Per-user iteration:
 *  - Reads each user's app_settings (notification_emails, threshold).
 *  - Scopes the candidates query to that user's tracked_products.
 *  - Excludes the user's own store via user_store_prefs.is_my_store.
 *  - Dedupe stays product-keyed (alert_log) — one warning per product
 *    in a 7-day window, regardless of which user(s) own it.
 */

const DEDUPE_WINDOW_DAYS = 7;

type DaysCoverRow = {
  id: string;
  url: string;
  handle: string;
  store_domain: string;
  title: string | null;
  current_qty: number;
  daily_rate: string;
  days_cover: string;
};

export async function sendDaysCoverWarnings(): Promise<{
  qualifying: number;
  sent: number;
  skipped: number;
}> {
  // Anyone with at least one notification email configured.
  const userRows = await db.execute<{
    user_id: string;
    notification_emails: string[];
    days_cover_threshold: number;
  }>(sql`
    SELECT user_id, notification_emails, days_cover_threshold
    FROM app_settings
    WHERE user_id IS NOT NULL
      AND array_length(notification_emails, 1) > 0
  `);

  let qualifying = 0;
  let sent = 0;
  let skipped = 0;

  for (const u of userRows) {
    const result = await sendForUser(
      u.user_id,
      u.notification_emails,
      u.days_cover_threshold ?? 7,
    );
    qualifying += result.qualifying;
    sent += result.sent;
    skipped += result.skipped;
  }

  return { qualifying, sent, skipped };
}

async function sendForUser(
  userId: string,
  notificationEmails: string[],
  threshold: number,
): Promise<{ qualifying: number; sent: number; skipped: number }> {
  // Same query shape as /opportunities's "About to go dark" — scoped to
  // this user's products, excluding stores they've marked as their own.
  const rows = Array.from(
    await db.execute<DaysCoverRow>(sql`
      WITH qty_changes AS (
        SELECT po.product_id, po.observed_at, po.quantity,
          LAG(po.quantity) OVER (PARTITION BY po.product_id ORDER BY po.observed_at) AS prev_qty
        FROM stock_observations po
        JOIN tracked_products tp ON tp.id = po.product_id AND tp.user_id = ${userId}::uuid
        WHERE po.quantity IS NOT NULL AND po.observed_at >= NOW() - INTERVAL '30 days'
      ),
      sold_30d_calc AS (
        SELECT product_id,
          SUM(CASE WHEN prev_qty IS NOT NULL AND prev_qty > quantity
              THEN prev_qty - quantity ELSE 0 END)::int AS sold_30d
        FROM qty_changes GROUP BY product_id
      )
      SELECT
        p.id, p.url, p.handle, p.store_domain, p.title,
        ls.quantity AS current_qty,
        (s.sold_30d::numeric / 30.0)::text AS daily_rate,
        (ls.quantity::numeric / NULLIF(s.sold_30d::numeric / 30.0, 0))::text AS days_cover
      FROM tracked_products p
      LEFT JOIN user_store_prefs usp
        ON usp.user_id = ${userId}::uuid AND usp.domain = p.store_domain
      JOIN sold_30d_calc s ON s.product_id = p.id
      JOIN LATERAL (
        SELECT quantity, available FROM stock_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) ls ON ls.quantity IS NOT NULL
      WHERE p.user_id = ${userId}::uuid
        AND p.active = true
        AND COALESCE(usp.is_my_store, false) = false
        -- Only items currently in stock; already-OOS products don't need
        -- a warning (they're already dark). Positive quantity guards
        -- against stale 0-qty observations triggering false positives.
        AND ls.available = true
        AND ls.quantity > 0
        AND s.sold_30d > 0
        AND (ls.quantity::numeric / (s.sold_30d::numeric / 30.0)) < ${threshold}
      ORDER BY (ls.quantity::numeric / (s.sold_30d::numeric / 30.0)) ASC
      LIMIT 50
    `),
  );

  if (rows.length === 0) return { qualifying: 0, sent: 0, skipped: 0 };

  // Product-keyed dedupe — alerts are noise either way regardless of which
  // user(s) own the product, so one row per product per window.
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ productId: schema.alertLog.productId })
    .from(schema.alertLog)
    .where(
      and(
        eq(schema.alertLog.kind, "days_cover_warning"),
        gt(schema.alertLog.sentAt, cutoff),
      ),
    );
  const recentSet = new Set(recent.map((r) => r.productId));
  const fresh = rows.filter((r) => !recentSet.has(r.id));

  let sent = 0;
  let skipped = 0;
  for (const r of fresh) {
    const [product] = await db
      .select()
      .from(schema.trackedProducts)
      .where(eq(schema.trackedProducts.id, r.id))
      .limit(1);
    if (!product) continue;

    const built = daysCoverWarningEmail(
      product,
      Number(r.days_cover),
      r.current_qty,
      Number(r.daily_rate),
    );
    const result = await sendEmail({
      to: notificationEmails,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });
    if (result.sent > 0) {
      await db.insert(schema.alertLog).values({
        productId: r.id,
        kind: "days_cover_warning",
        sentAt: new Date(),
      });
      sent++;
    } else {
      skipped++;
    }
  }

  return { qualifying: rows.length, sent, skipped };
}
