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

/** Whitelist of markets we know how to scan, with the currency that
 *  Shopify Markets routes to for that country. Only these countries can
 *  be selected in Settings. */
export const KNOWN_MARKETS: Record<string, { currency: string; label: string }> =
  {
    GB: { currency: "GBP", label: "United Kingdom" },
    IE: { currency: "EUR", label: "Ireland" },
    US: { currency: "USD", label: "United States" },
    DE: { currency: "EUR", label: "Germany" },
    FR: { currency: "EUR", label: "France" },
    ES: { currency: "EUR", label: "Spain" },
    IT: { currency: "EUR", label: "Italy" },
    NL: { currency: "EUR", label: "Netherlands" },
    AU: { currency: "AUD", label: "Australia" },
    NZ: { currency: "NZD", label: "New Zealand" },
    CA: { currency: "CAD", label: "Canada" },
    JP: { currency: "JPY", label: "Japan" },
    SE: { currency: "SEK", label: "Sweden" },
    NO: { currency: "NOK", label: "Norway" },
    DK: { currency: "DKK", label: "Denmark" },
    CH: { currency: "CHF", label: "Switzerland" },
    SG: { currency: "SGD", label: "Singapore" },
    ZA: { currency: "ZAR", label: "South Africa" },
    BR: { currency: "BRL", label: "Brazil" },
    MX: { currency: "MXN", label: "Mexico" },
    IN: { currency: "INR", label: "India" },
    AE: { currency: "AED", label: "UAE" },
  };

const DEFAULT_COUNTRIES = ["GB", "IE", "US", "DE", "AU", "CA", "JP"];

const PER_REQUEST_GAP_MS = 800;
const RETENTION_DAYS = 30;

interface MultiMarketResult {
  productsScanned: number;
  observationsWritten: number;
  pruned: number;
  failed: number;
}

export async function scanMultiMarketPrices(): Promise<MultiMarketResult> {
  // Pick the configured markets from settings; fall back to defaults.
  const [settings] = await db
    .select({ countries: schema.appSettings.multiMarketCountries })
    .from(schema.appSettings)
    .limit(1);
  const countries =
    settings?.countries && settings.countries.length > 0
      ? settings.countries
      : DEFAULT_COUNTRIES;

  const marketsToScan: Market[] = countries
    .filter((c) => KNOWN_MARKETS[c])
    .map((c) => ({ country: c, currency: KNOWN_MARKETS[c].currency }));

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

    for (const market of marketsToScan) {
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
 * page. Returns the most recent observation per country found in the DB,
 * regardless of whether it's in the current settings list — that way
 * historical data isn't dropped when the user reduces the scan list.
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
  return Array.from(rows).map((r) => ({
    country: r.country,
    currency: r.currency,
    price: r.price,
    available: r.available,
    observedAt: r.observed_at,
  }));
}
