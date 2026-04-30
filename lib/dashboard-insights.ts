import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface DashboardInsights {
  priceRaisedCount24h: number;
  priceDroppedCount24h: number;
  newStockOuts24h: number;
  newRestocks24h: number;
  pendingSuggestions: number;
  /** Active products whose latest crawl is older than 2 hours. Indicator of
   * crawler health — should be near zero on hourly cadence. */
  staleCount: number;
  biggestDrop: {
    productId: string;
    title: string | null;
    storeDomain: string;
    currency: string;
    delta: number; // negative number, in product currency
    pct: number; // negative
  } | null;
  biggestRise: {
    productId: string;
    title: string | null;
    storeDomain: string;
    currency: string;
    delta: number;
    pct: number;
  } | null;
}

/**
 * One-shot aggregate query for the dashboard insights widget. Runs in
 * a single round trip via several CTEs.
 */
export async function getDashboardInsights(): Promise<DashboardInsights> {
  type R = {
    price_raised_24h: number;
    price_dropped_24h: number;
    new_stock_outs_24h: number;
    new_restocks_24h: number;
    pending_suggestions: number;
    stale_count: number;
  };

  const [counts] = await db.execute<R>(sql`
    WITH price_pairs AS (
      SELECT
        po.product_id,
        po.price::numeric AS new_price,
        prev.price::numeric AS prev_price
      FROM price_observations po
      LEFT JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = po.product_id AND observed_at < po.observed_at
        ORDER BY observed_at DESC LIMIT 1
      ) prev ON true
      WHERE po.observed_at >= NOW() - INTERVAL '24 hours'
        AND prev.price IS NOT NULL
    ),
    stock_pairs AS (
      SELECT
        so.product_id,
        so.available AS new_avail,
        prev.available AS prev_avail
      FROM stock_observations so
      LEFT JOIN LATERAL (
        SELECT available FROM stock_observations
        WHERE product_id = so.product_id AND observed_at < so.observed_at
        ORDER BY observed_at DESC LIMIT 1
      ) prev ON true
      WHERE so.observed_at >= NOW() - INTERVAL '24 hours'
        AND prev.available IS NOT NULL
    )
    SELECT
      (SELECT COUNT(DISTINCT product_id)::int FROM price_pairs WHERE new_price > prev_price) AS price_raised_24h,
      (SELECT COUNT(DISTINCT product_id)::int FROM price_pairs WHERE new_price < prev_price) AS price_dropped_24h,
      (SELECT COUNT(DISTINCT product_id)::int FROM stock_pairs WHERE prev_avail = true AND new_avail = false) AS new_stock_outs_24h,
      (SELECT COUNT(DISTINCT product_id)::int FROM stock_pairs WHERE prev_avail = false AND new_avail = true) AS new_restocks_24h,
      (SELECT COUNT(*)::int FROM link_suggestions WHERE status = 'pending') AS pending_suggestions,
      (SELECT COUNT(*)::int FROM tracked_products
       WHERE active = true
         AND (last_crawled_at IS NULL OR last_crawled_at < NOW() - INTERVAL '2 hours')) AS stale_count
  `);

  // Biggest movers — pick the single biggest drop and biggest rise in 24h.
  type Mover = {
    product_id: string;
    title: string | null;
    store_domain: string;
    currency: string;
    delta: string;
    pct: string;
  };

  const movers = await db.execute<Mover>(sql`
    WITH latest AS (
      SELECT DISTINCT ON (po.product_id)
        po.product_id, po.price::numeric AS new_price, po.observed_at
      FROM price_observations po
      ORDER BY po.product_id, po.observed_at DESC
    ),
    prev AS (
      SELECT
        l.product_id,
        l.new_price,
        (SELECT price::numeric FROM price_observations
         WHERE product_id = l.product_id AND observed_at < l.observed_at
         ORDER BY observed_at DESC LIMIT 1) AS prev_price
      FROM latest l
      WHERE l.observed_at >= NOW() - INTERVAL '24 hours'
    )
    SELECT
      p.id AS product_id, p.title, p.store_domain, p.currency,
      (pr.new_price - pr.prev_price)::text AS delta,
      ((pr.new_price - pr.prev_price) / pr.prev_price * 100)::text AS pct
    FROM prev pr
    JOIN tracked_products p ON p.id = pr.product_id
    WHERE pr.prev_price IS NOT NULL AND pr.new_price != pr.prev_price
    ORDER BY ABS(pr.new_price - pr.prev_price) DESC
    LIMIT 10
  `);

  const moversArr = Array.from(movers);
  const drops = moversArr
    .filter((m) => Number(m.delta) < 0)
    .sort((a, b) => Number(a.delta) - Number(b.delta));
  const rises = moversArr
    .filter((m) => Number(m.delta) > 0)
    .sort((a, b) => Number(b.delta) - Number(a.delta));

  return {
    priceRaisedCount24h: counts?.price_raised_24h ?? 0,
    priceDroppedCount24h: counts?.price_dropped_24h ?? 0,
    newStockOuts24h: counts?.new_stock_outs_24h ?? 0,
    newRestocks24h: counts?.new_restocks_24h ?? 0,
    pendingSuggestions: counts?.pending_suggestions ?? 0,
    staleCount: counts?.stale_count ?? 0,
    biggestDrop:
      drops.length > 0
        ? {
            productId: drops[0].product_id,
            title: drops[0].title,
            storeDomain: drops[0].store_domain,
            currency: drops[0].currency,
            delta: Number(drops[0].delta),
            pct: Number(drops[0].pct),
          }
        : null,
    biggestRise:
      rises.length > 0
        ? {
            productId: rises[0].product_id,
            title: rises[0].title,
            storeDomain: rises[0].store_domain,
            currency: rises[0].currency,
            delta: Number(rises[0].delta),
            pct: Number(rises[0].pct),
          }
        : null,
  };
}
