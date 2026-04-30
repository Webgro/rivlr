import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 60; // cache for 60s — fresh enough to feel live

/**
 * Public feed of recent price/stock changes for the marketing ticker.
 * Anonymises to (store_domain, product title, change kind) — no user
 * attribution, no internal IDs. Cached for 60s to avoid hammering Postgres.
 *
 * When multi-user lands this should become an opt-in (per-account flag
 * 'show my changes in public marketing'). For v1 single-user it's fine
 * — the user's own tracked-product changes power their own landing page.
 */

type Row = {
  product_id: string;
  title: string | null;
  store_domain: string;
  currency: string;
  kind: "price_drop" | "price_rise" | "stock_in" | "stock_out";
  observed_at: string;
  prev_price: string | null;
  new_price: string | null;
};

export async function GET() {
  const result = await db.execute<Row>(sql`
    WITH price_changes AS (
      SELECT
        po.product_id,
        po.observed_at,
        po.price AS new_price,
        prev.price AS prev_price
      FROM price_observations po
      LEFT JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = po.product_id AND observed_at < po.observed_at
        ORDER BY observed_at DESC LIMIT 1
      ) prev ON true
      WHERE po.observed_at >= NOW() - INTERVAL '7 days'
        AND prev.price IS NOT NULL
        AND prev.price::numeric != po.price::numeric
    ),
    stock_changes AS (
      SELECT
        so.product_id,
        so.observed_at,
        so.available AS new_avail,
        prev.available AS prev_avail
      FROM stock_observations so
      LEFT JOIN LATERAL (
        SELECT available FROM stock_observations
        WHERE product_id = so.product_id AND observed_at < so.observed_at
        ORDER BY observed_at DESC LIMIT 1
      ) prev ON true
      WHERE so.observed_at >= NOW() - INTERVAL '7 days'
        AND prev.available IS NOT NULL
        AND prev.available != so.available
    )
    SELECT
      pc.product_id,
      p.title,
      p.store_domain,
      p.currency,
      CASE WHEN pc.new_price::numeric < pc.prev_price::numeric
           THEN 'price_drop' ELSE 'price_rise' END AS kind,
      pc.observed_at,
      pc.prev_price::text AS prev_price,
      pc.new_price::text AS new_price
    FROM price_changes pc
    JOIN tracked_products p ON p.id = pc.product_id
    UNION ALL
    SELECT
      sc.product_id,
      p.title,
      p.store_domain,
      p.currency,
      CASE WHEN sc.new_avail = false THEN 'stock_out' ELSE 'stock_in' END AS kind,
      sc.observed_at,
      NULL AS prev_price,
      NULL AS new_price
    FROM stock_changes sc
    JOIN tracked_products p ON p.id = sc.product_id
    ORDER BY observed_at DESC
    LIMIT 30
  `);

  const items = Array.from(result).map((r) => ({
    title: r.title ?? "(untitled)",
    storeDomain: r.store_domain,
    currency: r.currency,
    kind: r.kind,
    observedAt: r.observed_at,
    prevPrice: r.prev_price,
    newPrice: r.new_price,
  }));

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
