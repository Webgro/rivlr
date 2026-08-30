import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * How many units a product has sold, inferred from its stock falling.
 *
 * Shopify storefronts do not publish sales figures, but the cart
 * endpoint gives an exact remaining quantity per variant. Watch that
 * number over time and every drop is a sale. Summing the drops over a
 * window gives "sold 87 in the last 7 days", which is the difference
 * between knowing a competitor stocks something and knowing it moves.
 *
 * Increases are ignored rather than subtracted: a restock is not a
 * negative sale, and netting them off would report a busy product that
 * was replenished as having sold nothing.
 *
 * Two things this cannot see, both of which make it an UNDER-count, so
 * it is safe to present as "at least this many":
 *  - Sales and a restock between two readings cancel out in the numbers.
 *  - Anything sold while we were not reading exact counts at all.
 *
 * It is therefore a floor, not a measurement, and the UI should not
 * imply more precision than that.
 */

export interface Velocity {
  unitsSold: number;
  /** Readings the figure is built from. Two is the minimum for a delta. */
  readings: number;
  /** Whether there is enough history to be worth showing. */
  reliable: boolean;
}

/** Below this many readings the number is too thin to publish. */
const MIN_READINGS = 3;

/**
 * Units sold per product over the last `days`, for the given products.
 *
 * Batched deliberately: the pages that need this need it for a page of
 * products at a time, and doing it per product would be one window
 * function per row.
 */
export async function getVelocity(
  productIds: string[],
  days = 7,
): Promise<Map<string, Velocity>> {
  const out = new Map<string, Velocity>();
  if (productIds.length === 0) return out;

  const rows = await db.execute<{
    product_id: string;
    units_sold: number;
    readings: number;
  }>(sql`
    WITH readings AS (
      SELECT
        so.product_id,
        so.quantity,
        LAG(so.quantity) OVER (
          PARTITION BY so.product_id ORDER BY so.observed_at
        ) AS prev
      FROM stock_observations so
      WHERE so.product_id = ANY(${productIds}::uuid[])
        AND so.quantity IS NOT NULL
        AND so.observed_at > now() - MAKE_INTERVAL(days => ${days})
    )
    SELECT
      product_id,
      -- Only downward moves count. GREATEST clamps restocks to zero
      -- rather than letting them cancel out real sales.
      COALESCE(SUM(GREATEST(prev - quantity, 0)), 0)::int AS units_sold,
      COUNT(*)::int AS readings
    FROM readings
    WHERE prev IS NOT NULL
    GROUP BY product_id
  `);

  for (const r of rows) {
    out.set(r.product_id, {
      unitsSold: r.units_sold,
      readings: r.readings,
      reliable: r.readings >= MIN_READINGS,
    });
  }
  return out;
}

/**
 * Phrase a velocity for display, or null when there is nothing worth
 * saying. Kept here so every page words it the same way, and so the
 * "we can only see a floor" caveat is expressed once.
 */
export function velocityLabel(v: Velocity | undefined, days = 7): string | null {
  if (!v || !v.reliable || v.unitsSold <= 0) return null;
  return `${v.unitsSold.toLocaleString()} sold in ${days} days`;
}
