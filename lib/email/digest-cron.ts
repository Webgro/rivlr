import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { sendEmail } from "./send";
import { weeklyDigestEmail, type DigestPayload } from "./templates";

/**
 * Weekly digest. Fires Monday 09:00 UTC (when most people open inbox
 * for the working week). Pulls:
 *  - tracked product count
 *  - price + stock changes from last 7 days
 *  - new discoveries from last 7 days
 *  - top movers (biggest % swing in either direction)
 *  - currently OOS competitors (capped 5)
 *
 * One email per recipient address; no per-product dedupe needed since
 * the digest IS the dedupe (one email per week regardless of activity).
 */

export async function sendWeeklyDigest(): Promise<{
  ok: boolean;
  recipients: number;
  sent: number;
}> {
  const [settings] = await db.select().from(schema.appSettings).limit(1);
  if (!settings || settings.notificationEmails.length === 0) {
    return { ok: true, recipients: 0, sent: 0 };
  }

  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const [stats] = await db.execute<{
    total_active: number;
    price_changes: number;
    stock_changes: number;
    new_discoveries: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM tracked_products WHERE active = true) AS total_active,
      (SELECT COUNT(*)::int FROM alert_log
        WHERE kind = 'price_drop' AND sent_at >= NOW() - INTERVAL '7 days') AS price_changes,
      (SELECT COUNT(*)::int FROM alert_log
        WHERE kind IN ('stock_in','stock_out') AND sent_at >= NOW() - INTERVAL '7 days') AS stock_changes,
      (SELECT COUNT(*)::int FROM discovered_products
        WHERE first_seen >= NOW() - INTERVAL '7 days') AS new_discoveries
  `);

  const moverRows = await db.execute<{
    title: string | null;
    handle: string;
    store_domain: string;
    url: string;
    delta_pct: string;
    direction: "drop" | "rise";
  }>(sql`
    WITH price_pairs AS (
      SELECT po.product_id, po.price AS new_price, prev.price AS prev_price
      FROM price_observations po
      JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = po.product_id AND observed_at < po.observed_at
        ORDER BY observed_at DESC LIMIT 1
      ) prev ON true
      WHERE po.observed_at >= NOW() - INTERVAL '7 days'
        AND prev.price::numeric != po.price::numeric
    ),
    biggest AS (
      SELECT
        product_id,
        ABS(new_price::numeric - prev_price::numeric) / NULLIF(prev_price::numeric, 0) * 100 AS delta_pct,
        CASE WHEN new_price::numeric < prev_price::numeric THEN 'drop' ELSE 'rise' END AS direction
      FROM price_pairs
    )
    SELECT
      tp.title, tp.handle, tp.store_domain, tp.url,
      ROUND(b.delta_pct)::text AS delta_pct,
      b.direction
    FROM biggest b
    JOIN tracked_products tp ON tp.id = b.product_id
    LEFT JOIN stores st ON st.domain = tp.store_domain
    WHERE tp.active = true
      AND COALESCE(st.is_my_store, false) = false
    ORDER BY b.delta_pct DESC
    LIMIT 5
  `);

  const oosRows = await db.execute<{
    title: string | null;
    handle: string;
    store_domain: string;
    url: string;
    days_oos: number;
  }>(sql`
    WITH oos_runs AS (
      SELECT
        product_id, observed_at, available,
        SUM(CASE WHEN available THEN 1 ELSE 0 END)
          OVER (PARTITION BY product_id ORDER BY observed_at DESC) AS run_grp
      FROM stock_observations
    ),
    oos_since AS (
      SELECT product_id, MIN(observed_at) AS since
      FROM oos_runs
      WHERE run_grp = 0 AND available = false
      GROUP BY product_id
    )
    SELECT
      tp.title, tp.handle, tp.store_domain, tp.url,
      EXTRACT(DAY FROM NOW() - oos.since)::int AS days_oos
    FROM oos_since oos
    JOIN tracked_products tp ON tp.id = oos.product_id
    LEFT JOIN stores st ON st.domain = tp.store_domain
    WHERE tp.active = true
      AND COALESCE(st.is_my_store, false) = false
    ORDER BY oos.since ASC
    LIMIT 5
  `);

  const payload: DigestPayload = {
    weekStart,
    totalActive: stats?.total_active ?? 0,
    priceChanges: stats?.price_changes ?? 0,
    stockChanges: stats?.stock_changes ?? 0,
    newDiscoveries: stats?.new_discoveries ?? 0,
    topMovers: Array.from(moverRows).map((m) => ({
      title: m.title ?? m.handle,
      storeDomain: m.store_domain,
      deltaPct: parseInt(m.delta_pct, 10),
      direction: m.direction,
      url: m.url,
    })),
    oosNow: Array.from(oosRows).map((o) => ({
      title: o.title ?? o.handle,
      storeDomain: o.store_domain,
      daysOos: o.days_oos,
      url: o.url,
    })),
  };

  // Skip when there's literally nothing to report — better than sending
  // an empty digest that erodes the perceived value of opening it.
  if (
    payload.priceChanges === 0 &&
    payload.stockChanges === 0 &&
    payload.newDiscoveries === 0 &&
    payload.topMovers.length === 0 &&
    payload.oosNow.length === 0
  ) {
    return { ok: true, recipients: settings.notificationEmails.length, sent: 0 };
  }

  const built = weeklyDigestEmail(payload);
  const result = await sendEmail({
    to: settings.notificationEmails,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });

  return {
    ok: true,
    recipients: settings.notificationEmails.length,
    sent: result.sent,
  };
}
