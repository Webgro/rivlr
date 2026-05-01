import { db, schema } from "@/lib/db";
import { sql, eq } from "drizzle-orm";
import {
  fetchShopifyProduct,
  penceToDecimal,
  type Market,
} from "./shopify";

/**
 * Daily multi-market price snapshot. For every active tracked product,
 * fetches the same /products/{handle}.js endpoint under N different
 * Shopify Markets cookies (GB, IE, US, DE, AU, CA, JP) and stores one
 * snapshot per market into `multi_market_observations`.
 *
 * Cost model: 7 fetches per product per day. With per-store throttling
 * (1s gap), this stretches to ~1min per store with 8+ products. Runs as
 * part of the existing 05:30 UTC store-scan cron, so no new schedule
 * needed.
 *
 * The product's primary currency tracking (hourly cadence in dispatch.ts)
 * is unaffected — that still uses the per-product market override.
 */

const MARKETS_TO_SCAN: Market[] = [
  { country: "GB", currency: "GBP" },
  { country: "IE", currency: "EUR" },
  { country: "US", currency: "USD" },
  { country: "DE", currency: "EUR" },
  { country: "AU", currency: "AUD" },
  { country: "CA", currency: "CAD" },
  { country: "JP", currency: "JPY" },
];

const PER_REQUEST_GAP_MS = 800;
const RETENTION_DAYS = 30;

interface MultiMarketResult {
  productsScanned: number;
  observationsWritten: number;
  pruned: number;
  failed: number;
}

export async function scanMultiMarketPrices(): Promise<MultiMarketResult> {
  // Pull active tracked products with their store + handle.
  const products = await db
    .select({
      id: schema.trackedProducts.id,
      storeDomain: schema.trackedProducts.storeDomain,
      handle: schema.trackedProducts.handle,
    })
    .from(schema.trackedProducts)
    .where(eq(schema.trackedProducts.active, true));

  let observationsWritten = 0;
  let failed = 0;

  for (const p of products) {
    const productJsUrl = `https://${p.storeDomain}/products/${p.handle}.js`;
    const observedAt = new Date();

    for (const market of MARKETS_TO_SCAN) {
      try {
        const fetched = await fetchShopifyProduct(productJsUrl, market);

        // Shopify still echoes the .js price as pence regardless of market,
        // and the currency we asked for is the one returned via Markets
        // routing. The price itself reflects that market's pricing.
        const priceDecimal = penceToDecimal(fetched.price);

        await db.insert(schema.multiMarketObservations).values({
          productId: p.id,
          observedAt,
          country: market.country,
          currency: market.currency,
          price: priceDecimal,
          available: fetched.available,
        });
        observationsWritten++;
      } catch {
        failed++;
      }
      // Polite gap before next market for the SAME store/product.
      await new Promise((r) => setTimeout(r, PER_REQUEST_GAP_MS));
    }
  }

  // Prune anything older than the retention window.
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const pruneResult = await db.execute(sql`
    DELETE FROM multi_market_observations
    WHERE observed_at < ${cutoff}
  `);
  const pruned =
    typeof pruneResult === "object" && pruneResult !== null && "count" in pruneResult
      ? Number((pruneResult as { count: number }).count)
      : 0;

  return {
    productsScanned: products.length,
    observationsWritten,
    pruned,
    failed,
  };
}

/**
 * Latest snapshot per market for a product, for rendering on the detail
 * page. Returns the most recent observation per country, ordered by the
 * MARKETS_TO_SCAN list above so the UI is consistent.
 */
export async function getLatestMultiMarketForProduct(productId: string) {
  const rows = await db.execute<{
    country: string;
    currency: string;
    price: string | null;
    available: boolean | null;
    observed_at: string;
  }>(sql`
    SELECT DISTINCT ON (country)
      country, currency, price, available, observed_at
    FROM multi_market_observations
    WHERE product_id = ${productId}::uuid
    ORDER BY country, observed_at DESC
  `);
  const byCountry = new Map<string, (typeof rows extends Iterable<infer R> ? R : never)>();
  for (const r of rows) byCountry.set(r.country, r);

  // Return in the canonical scan order; missing markets become nulls.
  return MARKETS_TO_SCAN.map((m) => {
    const row = byCountry.get(m.country);
    return {
      country: m.country,
      currency: m.currency,
      price: row?.price ?? null,
      available: row?.available ?? null,
      observedAt: row?.observed_at ?? null,
    };
  });
}
