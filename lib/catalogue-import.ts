import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  fetchShopifyCollection,
  inferMarketFromDomain,
} from "@/lib/crawler/shopify";

/**
 * Bulk catalogue imports, shared by the store actions and guided setup.
 *
 * Both callers pull the same `/collections/all/products.json` pages; the
 * only difference is where the rows land. Importing your own store
 * writes straight to `tracked_products` (you already sell these, so
 * there is nothing to confirm), while a competitor's catalogue is
 * staged in `discovered_products` until the user chooses what to track.
 *
 * `onProgress` exists because guided setup runs these inside `after()`,
 * where the request has already returned and the browser can only learn
 * how far along the import is by polling something the import itself
 * wrote down.
 */

const IMPORT_MAX_PRODUCTS = 5000;
const CHUNK_SIZE = 500;

export interface ImportOptions {
  /** Called once the catalogue size is known, then after each chunk. */
  onProgress?: (imported: number, expected: number) => Promise<void>;
  maxProducts?: number;
}

/**
 * Import the user's own catalogue as tracked products, and refresh the
 * prices of anything already imported.
 *
 * Safe to re-run, which it has to be: it is both the first-time import
 * and the ongoing price refresh for the user's own store. Products
 * already present are updated in place rather than inserted again.
 *
 * That matters more than it sounds. This table used to have no unique
 * constraint beyond its primary key, so `onConflictDoNothing()` never
 * fired — every insert generates a fresh UUID — and each re-import
 * silently duplicated the whole catalogue, to the tune of 1,758 rows
 * and 819k orphaned observations before it was caught. There is now a
 * unique index on (user_id, store_domain, handle) as a backstop, but
 * existing handles are still read and filtered explicitly: the index
 * turns a duplicate into a thrown error, and skipping the row is what
 * we actually want.
 *
 * The refresh updates `latest_*` only and writes no price observations.
 * Own-store products are excluded from per-product crawling (see
 * lib/crawler/dispatch.ts), so this is what keeps the user's own side
 * of every comparison current, at one request per 250 products instead
 * of one per product. The cost is that the user's own price history
 * stops accumulating new points; competitor history, which is what the
 * charts and alerts are about, is unaffected.
 *
 * Any rows already staged as discoveries for this store are dropped at
 * the end: once a product is in `tracked_products` it must not also sit
 * in the "found on a competitor, do you want it?" queue.
 */
export async function importOwnStoreCatalogue(
  userId: string,
  domain: string,
  opts: ImportOptions = {},
): Promise<number> {
  const products = await fetchShopifyCollection(domain, "all", {
    maxProducts: opts.maxProducts ?? IMPORT_MAX_PRODUCTS,
  });
  await opts.onProgress?.(0, products.length);
  if (products.length === 0) return 0;

  const market = inferMarketFromDomain(domain);

  const existingRows = await db.execute<{ handle: string }>(sql`
    SELECT handle FROM tracked_products
    WHERE user_id = ${userId}::uuid AND store_domain = ${domain}
  `);
  const existing = new Set(Array.from(existingRows).map((r) => r.handle));

  const fresh = products.filter((p) => !existing.has(p.handle));
  const known = products.filter((p) => existing.has(p.handle));

  let imported = 0;
  for (let i = 0; i < fresh.length; i += CHUNK_SIZE) {
    const slice = fresh.slice(i, i + CHUNK_SIZE);
    await db.insert(schema.trackedProducts).values(
      slice.map((p) => ({
        userId,
        skus: p.skus,
        latestPrice: p.price !== null ? p.price.toFixed(2) : null,
        latestAvailable: p.available,
        latestObservedAt: new Date(),
        url: `https://${domain}/products/${p.handle}`,
        handle: p.handle,
        storeDomain: domain,
        title: p.title,
        imageUrl: p.imageUrl,
        currency: market.currency,
        marketCountry: market.country,
        marketCurrency: market.currency,
      })),
    ).onConflictDoNothing();
    imported += slice.length;
    await opts.onProgress?.(imported, products.length);
  }

  // Refresh prices on products we already hold. unnest() keeps this to
  // one statement per chunk rather than one per product.
  for (let i = 0; i < known.length; i += CHUNK_SIZE) {
    const slice = known.slice(i, i + CHUNK_SIZE);
    await db.execute(sql`
      UPDATE tracked_products tp
         SET latest_price = d.price,
             latest_available = d.available,
             latest_observed_at = now()
        FROM (
          SELECT * FROM unnest(
            ${slice.map((p) => p.handle)}::text[],
            ${slice.map((p) => (p.price !== null ? p.price.toFixed(2) : null))}::numeric[],
            ${slice.map((p) => p.available)}::boolean[]
          ) AS t(handle, price, available)
        ) d
       WHERE tp.user_id = ${userId}::uuid
         AND tp.store_domain = ${domain}
         AND tp.handle = d.handle
    `);
    imported += slice.length;
    await opts.onProgress?.(imported, products.length);
  }

  await db.execute(sql`
    DELETE FROM discovered_products
    WHERE user_id = ${userId}::uuid
      AND store_domain = ${domain}
      AND status = 'new'
  `);

  return imported;
}

/**
 * Stage a competitor's catalogue in `discovered_products` so it can be
 * matched against the user's own products.
 *
 * Handles the user already tracks, or already has staged, are skipped
 * rather than re-inserted, so re-running is safe and does not resurrect
 * products the user has already decided about. As with the own-store
 * import the filtering is explicit, with the unique index only as a
 * backstop against two imports racing for the same store.
 */
export async function importCompetitorCatalogue(
  userId: string,
  domain: string,
  opts: ImportOptions = {},
): Promise<number> {
  const products = await fetchShopifyCollection(domain, "all", {
    maxProducts: opts.maxProducts ?? IMPORT_MAX_PRODUCTS,
  });
  await opts.onProgress?.(0, products.length);
  if (products.length === 0) return 0;

  // Anything this user already tracks, or has already been offered, is
  // not a new discovery. Staged rows of any status are excluded so a
  // dismissed product stays dismissed.
  const seenRows = await db.execute<{ handle: string }>(sql`
    SELECT handle FROM tracked_products
    WHERE user_id = ${userId}::uuid AND store_domain = ${domain}
    UNION
    SELECT handle FROM discovered_products
    WHERE user_id = ${userId}::uuid AND store_domain = ${domain}
  `);
  const seen = new Set(Array.from(seenRows).map((r) => r.handle));
  const fresh = products.filter((p) => !seen.has(p.handle));

  let imported = 0;
  for (let i = 0; i < fresh.length; i += CHUNK_SIZE) {
    const slice = fresh.slice(i, i + CHUNK_SIZE);
    await db
      .insert(schema.discoveredProducts)
      .values(
        slice.map((p) => ({
          userId,
          storeDomain: domain,
          handle: p.handle,
          title: p.title,
          imageUrl: p.imageUrl,
          skus: p.skus,
          price: p.price !== null ? p.price.toFixed(2) : null,
          available: p.available,
          url: `https://${domain}/products/${p.handle}`,
          status: "new" as const,
        })),
      )
      .onConflictDoNothing();
    imported += slice.length;
    await opts.onProgress?.(imported, products.length);
  }

  return imported;
}
