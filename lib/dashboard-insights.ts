import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getPlanForUser, PLAN_FEATURES, CADENCE_COOLDOWN_MS } from "@/lib/plan";

export interface DashboardInsights {
  priceRaisedCount24h: number;
  priceDroppedCount24h: number;
  newStockOuts24h: number;
  newRestocks24h: number;
  pendingSuggestions: number;
  /** Competitor products overdue for a check by a wide margin — an
   *  indicator of crawler health. Own-store products are excluded:
   *  they are refreshed in bulk rather than crawled individually, so
   *  their last_crawled_at never advances and counting them would keep
   *  this warning permanently lit. */
  staleCount: number;
  /** Hours behind schedule that staleCount is measured against, derived
   *  from the user's plan cadence so the copy can state it. */
  staleThresholdHours: number;
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
export async function getDashboardInsights(
  userId: string,
): Promise<DashboardInsights> {
  // "Behind schedule" only means anything relative to how often this
  // user's plan is due a check. A fixed two-hour threshold dated from
  // when an hourly cadence existed; on today's daily and 6-hourly
  // cadences it flagged every product on every plan, permanently.
  // Twice the cadence is late enough to be worth saying.
  const plan = await getPlanForUser(userId);
  const staleThresholdHours = Math.round(
    (CADENCE_COOLDOWN_MS[PLAN_FEATURES[plan].cadence] * 2) / 3_600_000,
  );
  type R = {
    price_raised_24h: number;
    price_dropped_24h: number;
    new_stock_outs_24h: number;
    new_restocks_24h: number;
    pending_suggestions: number;
    stale_count: number;
  };

  const countsQuery = db.execute<R>(sql`
    WITH user_products AS (
      -- Scope the observation scans to this user's products up front;
      -- these CTEs previously walked every user's last-24h observations
      -- with a per-row LATERAL, which crawled as history accumulated.
      SELECT id FROM tracked_products WHERE user_id = ${userId}::uuid
    ),
    price_window AS (
      -- Single bounded scan + LAG instead of a correlated prev-lookup
      -- per row. The extra day feeds LAG a prior value for rows near
      -- the 24h boundary.
      SELECT
        product_id, observed_at, price,
        LAG(price) OVER (PARTITION BY product_id ORDER BY observed_at) AS prev_price
      FROM price_observations
      WHERE product_id IN (SELECT id FROM user_products)
        AND observed_at >= NOW() - INTERVAL '48 hours'
    ),
    price_pairs AS (
      SELECT product_id, price::numeric AS new_price, prev_price::numeric AS prev_price
      FROM price_window
      WHERE observed_at >= NOW() - INTERVAL '24 hours'
        AND prev_price IS NOT NULL
    ),
    stock_window AS (
      SELECT
        product_id, observed_at, available,
        LAG(available) OVER (PARTITION BY product_id ORDER BY observed_at) AS prev_avail
      FROM stock_observations
      WHERE product_id IN (SELECT id FROM user_products)
        AND observed_at >= NOW() - INTERVAL '48 hours'
    ),
    stock_pairs AS (
      SELECT product_id, available AS new_avail, prev_avail
      FROM stock_window
      WHERE observed_at >= NOW() - INTERVAL '24 hours'
        AND prev_avail IS NOT NULL
    )
    SELECT
      (SELECT COUNT(DISTINCT pp.product_id)::int FROM price_pairs pp
        JOIN tracked_products tp ON tp.id = pp.product_id AND tp.user_id = ${userId}::uuid
        WHERE pp.new_price > pp.prev_price) AS price_raised_24h,
      (SELECT COUNT(DISTINCT pp.product_id)::int FROM price_pairs pp
        JOIN tracked_products tp ON tp.id = pp.product_id AND tp.user_id = ${userId}::uuid
        WHERE pp.new_price < pp.prev_price) AS price_dropped_24h,
      (SELECT COUNT(DISTINCT sp.product_id)::int FROM stock_pairs sp
        JOIN tracked_products tp ON tp.id = sp.product_id AND tp.user_id = ${userId}::uuid
        WHERE sp.prev_avail = true AND sp.new_avail = false) AS new_stock_outs_24h,
      (SELECT COUNT(DISTINCT sp.product_id)::int FROM stock_pairs sp
        JOIN tracked_products tp ON tp.id = sp.product_id AND tp.user_id = ${userId}::uuid
        WHERE sp.prev_avail = false AND sp.new_avail = true) AS new_restocks_24h,
      (SELECT COUNT(*)::int FROM link_suggestions
        WHERE user_id = ${userId}::uuid AND status = 'pending') AS pending_suggestions,
      (SELECT COUNT(*)::int FROM tracked_products tp
       WHERE tp.user_id = ${userId}::uuid
         AND tp.active = true
         AND NOT EXISTS (
           SELECT 1 FROM user_store_prefs usp
           WHERE usp.user_id = tp.user_id
             AND usp.domain = tp.store_domain
             AND usp.is_my_store = true
         )
         AND (tp.last_crawled_at IS NULL
              OR tp.last_crawled_at < NOW() - MAKE_INTERVAL(hours => ${staleThresholdHours}))) AS stale_count
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

  const moversQuery = db.execute<Mover>(sql`
    WITH latest AS (
      SELECT DISTINCT ON (po.product_id)
        po.product_id, po.price::numeric AS new_price, po.observed_at
      FROM price_observations po
      JOIN tracked_products tp
        ON tp.id = po.product_id AND tp.user_id = ${userId}::uuid
      WHERE po.observed_at >= NOW() - INTERVAL '24 hours'
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
    )
    SELECT
      p.id AS product_id, p.title, p.store_domain, p.currency,
      (pr.new_price - pr.prev_price)::text AS delta,
      ((pr.new_price - pr.prev_price) / pr.prev_price * 100)::text AS pct
    FROM prev pr
    JOIN tracked_products p ON p.id = pr.product_id AND p.user_id = ${userId}::uuid
    WHERE pr.prev_price IS NOT NULL AND pr.new_price != pr.prev_price
    ORDER BY ABS(pr.new_price - pr.prev_price) DESC
    LIMIT 10
  `);

  const [[counts], movers] = await Promise.all([countsQuery, moversQuery]);

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
    staleThresholdHours,
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
