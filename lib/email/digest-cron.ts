import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { sendEmail } from "./send";
import { weeklyDigestEmail, type DigestPayload } from "./templates";

/**
 * Weekly digest. Fires Monday 09:00 UTC (when most people open inbox
 * for the working week). Iterates users — each gets a digest computed
 * from their own tracked products only, sent to their own
 * notification_emails recipients.
 *
 * One email per user (with their addresses as recipients). No per-product
 * dedupe needed; the digest IS the dedupe (one email per week regardless
 * of activity).
 */

interface DigestResult {
  ok: boolean;
  recipients: number;
  sent: number;
}

export async function sendWeeklyDigest(): Promise<DigestResult> {
  const userRows = await db.execute<{
    user_id: string;
    notification_emails: string[];
  }>(sql`
    SELECT user_id, notification_emails
    FROM app_settings
    WHERE user_id IS NOT NULL
      AND array_length(notification_emails, 1) > 0
  `);

  let totalRecipients = 0;
  let totalSent = 0;

  for (const u of userRows) {
    const r = await sendForUser(u.user_id, u.notification_emails);
    totalRecipients += r.recipients;
    totalSent += r.sent;
  }

  return { ok: true, recipients: totalRecipients, sent: totalSent };
}

async function sendForUser(
  userId: string,
  notificationEmails: string[],
): Promise<{ recipients: number; sent: number }> {
  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const [stats] = await db.execute<{
    total_active: number;
    price_changes: number;
    stock_changes: number;
    new_discoveries: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM tracked_products
        WHERE active = true AND user_id = ${userId}::uuid) AS total_active,
      (SELECT COUNT(*)::int FROM alert_log al
        JOIN tracked_products tp ON tp.id = al.product_id AND tp.user_id = ${userId}::uuid
        WHERE al.kind = 'price_drop' AND al.sent_at >= NOW() - INTERVAL '7 days') AS price_changes,
      (SELECT COUNT(*)::int FROM alert_log al
        JOIN tracked_products tp ON tp.id = al.product_id AND tp.user_id = ${userId}::uuid
        WHERE al.kind IN ('stock_in','stock_out') AND al.sent_at >= NOW() - INTERVAL '7 days') AS stock_changes,
      (SELECT COUNT(*)::int FROM discovered_products
        WHERE first_seen >= NOW() - INTERVAL '7 days'
          AND user_id = ${userId}::uuid) AS new_discoveries
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
      JOIN tracked_products tp ON tp.id = po.product_id AND tp.user_id = ${userId}::uuid
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
    LEFT JOIN user_store_prefs usp
      ON usp.user_id = ${userId}::uuid AND usp.domain = tp.store_domain
    WHERE tp.active = true
      AND tp.user_id = ${userId}::uuid
      AND COALESCE(usp.is_my_store, false) = false
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
        so.product_id, so.observed_at, so.available,
        SUM(CASE WHEN so.available THEN 1 ELSE 0 END)
          OVER (PARTITION BY so.product_id ORDER BY so.observed_at DESC) AS run_grp
      FROM stock_observations so
      JOIN tracked_products tp ON tp.id = so.product_id AND tp.user_id = ${userId}::uuid
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
    LEFT JOIN user_store_prefs usp
      ON usp.user_id = ${userId}::uuid AND usp.domain = tp.store_domain
    WHERE tp.active = true
      AND tp.user_id = ${userId}::uuid
      AND COALESCE(usp.is_my_store, false) = false
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
    return { recipients: notificationEmails.length, sent: 0 };
  }

  const built = weeklyDigestEmail(payload);
  const result = await sendEmail({
    to: notificationEmails,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });

  return {
    recipients: notificationEmails.length,
    sent: result.sent,
  };
}
