import { db, schema } from "@/lib/db";
import { sql, and, eq, gt } from "drizzle-orm";
import { sendEmail } from "./send";
import { daysCoverWarningEmail } from "./templates";

/**
 * Daily check for competitors about to go out of stock. Fires one email
 * per qualifying competitor product, deduped within 7 days (we don't
 * want to nag every morning when stock is consistently low).
 *
 * Threshold reads from app_settings.days_cover_threshold (default 7).
 * Ignores own-store products since "you're about to run out" of your
 * own thing isn't a competitive intel signal.
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
  const [settings] = await db.select().from(schema.appSettings).limit(1);
  if (!settings || settings.notificationEmails.length === 0) {
    return { qualifying: 0, sent: 0, skipped: 0 };
  }
  const threshold = settings.daysCoverThreshold ?? 7;

  // Same query as /opportunities's "About to go dark" section.
  const rows = Array.from(
    await db.execute<DaysCoverRow>(sql`
      WITH qty_changes AS (
        SELECT product_id, observed_at, quantity,
          LAG(quantity) OVER (PARTITION BY product_id ORDER BY observed_at) AS prev_qty
        FROM stock_observations
        WHERE quantity IS NOT NULL AND observed_at >= NOW() - INTERVAL '30 days'
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
      LEFT JOIN stores st ON st.domain = p.store_domain
      JOIN sold_30d_calc s ON s.product_id = p.id
      JOIN LATERAL (
        SELECT quantity FROM stock_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) ls ON ls.quantity IS NOT NULL
      WHERE p.active = true
        AND COALESCE(st.is_my_store, false) = false
        AND s.sold_30d > 0
        AND (ls.quantity::numeric / (s.sold_30d::numeric / 30.0)) < ${threshold}
      ORDER BY (ls.quantity::numeric / (s.sold_30d::numeric / 30.0)) ASC
      LIMIT 50
    `),
  );

  if (rows.length === 0) return { qualifying: 0, sent: 0, skipped: 0 };

  // Dedupe — products that already got a days_cover_warning in the last 7d
  // are skipped this run.
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
    // Pull the full product row so the template has all the context.
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
      to: settings.notificationEmails,
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
