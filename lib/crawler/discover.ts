import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { fetchShopifyCollection } from "./shopify";

/**
 * Daily 'new product' discovery scan. For each store we have at least one
 * active tracked product on, paginate /products.json (via the existing
 * fetchShopifyCollection helper, which works on `/collections/all`) and
 * insert any product handles we don't already track or know about.
 *
 * Designed to be cheap to run daily even for many stores:
 *  - Only stores with active tracked products are scanned (no point on
 *    pruned ones).
 *  - 1s polite delay between page fetches inside the helper.
 *  - 1s extra delay between stores in the loop below.
 *  - Per-store cap at 1000 products so a giant catalogue doesn't blow up.
 */

const PER_STORE_CAP = 1000;
const PER_STORE_DELAY_MS = 1000;

interface DiscoverResult {
  storesScanned: number;
  newDiscoveries: number;
  imagesBackfilled: number;
  errors: number;
}

export async function discoverNewProducts(): Promise<DiscoverResult> {
  // Find every distinct store with at least one active tracked product.
  const storeRows = await db.execute<{ store_domain: string }>(sql`
    SELECT DISTINCT store_domain
    FROM tracked_products
    WHERE active = true
  `);
  const stores = Array.from(storeRows).map((r) => r.store_domain);

  let newDiscoveries = 0;
  let imagesBackfilled = 0;
  let errors = 0;

  for (const storeDomain of stores) {
    try {
      // Fetch the full catalogue via /collections/all/products.json.
      // Shopify exposes this on every store with no auth.
      const products = await fetchShopifyCollection(storeDomain, "all", {
        maxProducts: PER_STORE_CAP,
      });

      if (products.length === 0) continue;

      // Build a handle → CDN imageUrl map from this scan, for both new
      // inserts and the backfill below.
      const imageByHandle = new Map<string, string | null>();
      for (const p of products) imageByHandle.set(p.handle, p.imageUrl);

      // Get the set of handles we already track on this store.
      const trackedRows = await db.execute<{ handle: string }>(sql`
        SELECT handle FROM tracked_products
        WHERE store_domain = ${storeDomain}
      `);
      const tracked = new Set(Array.from(trackedRows).map((r) => r.handle));

      // And the set of handles already discovered (regardless of status —
      // we don't want to surface dismissed items again, and we don't want
      // to duplicate 'new' rows).
      const discoveredRows = await db.execute<{
        handle: string;
        image_url: string | null;
      }>(sql`
        SELECT handle, image_url FROM discovered_products
        WHERE store_domain = ${storeDomain}
      `);
      const discoveredHandles = new Set<string>();
      const handlesMissingImage: string[] = [];
      for (const r of discoveredRows) {
        discoveredHandles.add(r.handle);
        if (!r.image_url) handlesMissingImage.push(r.handle);
      }

      // The new ones — on the store, not tracked, not previously discovered.
      const fresh = products.filter(
        (p) => !tracked.has(p.handle) && !discoveredHandles.has(p.handle),
      );

      if (fresh.length > 0) {
        // Bulk insert. URL has a unique constraint to prevent duplicates
        // even under race conditions. Image URL is just the Shopify CDN
        // link — never proxied or locally hosted.
        await db
          .insert(schema.discoveredProducts)
          .values(
            fresh.map((p) => ({
              storeDomain,
              handle: p.handle,
              title: p.title,
              imageUrl: p.imageUrl,
              url: `https://${storeDomain}/products/${p.handle}`,
              status: "new" as const,
            })),
          )
          .onConflictDoNothing();
        newDiscoveries += fresh.length;
      }

      // Backfill: existing rows we previously stored with NULL image_url
      // (from the old image-shape bug). Update each one with the CDN URL
      // we just pulled. One UPDATE per handle keeps the SQL straightforward
      // and the volume is naturally bounded by per-store catalogue size.
      for (const handle of handlesMissingImage) {
        const url = imageByHandle.get(handle);
        if (!url) continue;
        await db.execute(sql`
          UPDATE discovered_products
             SET image_url = ${url}
           WHERE store_domain = ${storeDomain}
             AND handle = ${handle}
             AND image_url IS NULL
        `);
        imagesBackfilled += 1;
      }
    } catch {
      errors += 1;
    }

    // Polite gap between stores.
    await new Promise((r) => setTimeout(r, PER_STORE_DELAY_MS));
  }

  return {
    storesScanned: stores.length,
    newDiscoveries,
    imagesBackfilled,
    errors,
  };
}

export async function getNewDiscoveryCount(): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM discovered_products WHERE status = 'new'
  `);
  return row?.n ?? 0;
}

export async function refreshDiscoveryImage(id: string): Promise<void> {
  // Future: fetch the product's image lazily on first display. Not used
  // yet — for now the catalogue scan stores no image; we render a coloured
  // placeholder. This avoids one extra HTTP per product during scanning.
  void id;
}
