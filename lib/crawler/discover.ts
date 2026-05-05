import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { fetchShopifyCollection, inferMarketFromDomain } from "./shopify";

/**
 * Daily 'new product' discovery scan. For each store with at least one
 * active tracked product (across any user), paginate /products.json once
 * and then fan the result out across every user who tracks that store.
 *
 * Per-user fan-out:
 *  - We dedupe against THIS user's tracked + discovered handles only.
 *  - Auto-track decision is per-user via user_store_prefs (is_my_store
 *    OR auto_track_new). Different users on the same store can disagree.
 *  - Inserts always set user_id so the data stays scoped.
 *
 * Polite request budget unchanged: one storefront fetch per store, then
 * fan-out is pure SQL.
 */

const PER_STORE_CAP = 1000;
const PER_STORE_DELAY_MS = 1000;

interface DiscoverResult {
  storesScanned: number;
  newDiscoveries: number;
  autoTracked: number;
  imagesBackfilled: number;
  errors: number;
}

export async function discoverNewProducts(): Promise<DiscoverResult> {
  // Find every distinct (store_domain, user_id) pair so we know who
  // tracks what. One fetch per store, fan-out per user inside the loop.
  const pairRows = await db.execute<{
    store_domain: string;
    user_id: string;
  }>(sql`
    SELECT DISTINCT store_domain, user_id
    FROM tracked_products
    WHERE active = true AND user_id IS NOT NULL
  `);
  const usersByStore = new Map<string, string[]>();
  for (const r of pairRows) {
    const arr = usersByStore.get(r.store_domain) ?? [];
    arr.push(r.user_id);
    usersByStore.set(r.store_domain, arr);
  }
  const stores = Array.from(usersByStore.keys());

  // Per-(user, domain) auto-track flags. Build a lookup once so the
  // inner loop is a Map.get() rather than a query per user.
  const prefRows = await db
    .select({
      userId: schema.userStorePrefs.userId,
      domain: schema.userStorePrefs.domain,
      isMyStore: schema.userStorePrefs.isMyStore,
      autoTrackNew: schema.userStorePrefs.autoTrackNew,
    })
    .from(schema.userStorePrefs);
  const autoTrackKey = (userId: string, domain: string) =>
    `${userId}::${domain}`;
  const autoTrackSet = new Set<string>();
  for (const p of prefRows) {
    if (p.isMyStore || p.autoTrackNew) {
      autoTrackSet.add(autoTrackKey(p.userId, p.domain));
    }
  }

  let newDiscoveries = 0;
  let autoTracked = 0;
  let imagesBackfilled = 0;
  let errors = 0;

  for (const storeDomain of stores) {
    try {
      const products = await fetchShopifyCollection(storeDomain, "all", {
        maxProducts: PER_STORE_CAP,
      });

      if (products.length === 0) continue;

      // Handle → CDN imageUrl map for inserts and backfill.
      const imageByHandle = new Map<string, string | null>();
      for (const p of products) imageByHandle.set(p.handle, p.imageUrl);

      const market = inferMarketFromDomain(storeDomain);
      const usersForStore = usersByStore.get(storeDomain) ?? [];

      for (const userId of usersForStore) {
        // What this user already tracks on this store.
        const trackedRows = await db.execute<{ handle: string }>(sql`
          SELECT handle FROM tracked_products
          WHERE store_domain = ${storeDomain}
            AND user_id = ${userId}::uuid
        `);
        const tracked = new Set(Array.from(trackedRows).map((r) => r.handle));

        // What this user has already had staged in /discover (any status —
        // we don't want to re-surface dismissed items either).
        const discoveredRows = await db.execute<{
          handle: string;
          image_url: string | null;
        }>(sql`
          SELECT handle, image_url FROM discovered_products
          WHERE store_domain = ${storeDomain}
            AND user_id = ${userId}::uuid
        `);
        const discoveredHandles = new Set<string>();
        const handlesMissingImage: string[] = [];
        for (const r of discoveredRows) {
          discoveredHandles.add(r.handle);
          if (!r.image_url) handlesMissingImage.push(r.handle);
        }

        const fresh = products.filter(
          (p) => !tracked.has(p.handle) && !discoveredHandles.has(p.handle),
        );

        if (fresh.length > 0) {
          if (autoTrackSet.has(autoTrackKey(userId, storeDomain))) {
            // Per-user auto-track — opted in via user_store_prefs.
            await db
              .insert(schema.trackedProducts)
              .values(
                fresh.map((p) => ({
                  userId,
                  url: `https://${storeDomain}/products/${p.handle}`,
                  handle: p.handle,
                  storeDomain,
                  title: p.title,
                  imageUrl: p.imageUrl,
                  currency: market.currency,
                  marketCountry: market.country,
                  marketCurrency: market.currency,
                })),
              )
              .onConflictDoNothing();
            autoTracked += fresh.length;
          } else {
            // Standard staging — surface in /discover for this user.
            await db
              .insert(schema.discoveredProducts)
              .values(
                fresh.map((p) => ({
                  userId,
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
        }

        // Backfill: rows previously stored with NULL image_url get the
        // CDN URL from this scan. Per-user scoped so we don't touch other
        // users' rows.
        for (const handle of handlesMissingImage) {
          const url = imageByHandle.get(handle);
          if (!url) continue;
          await db.execute(sql`
            UPDATE discovered_products
               SET image_url = ${url}
             WHERE store_domain = ${storeDomain}
               AND user_id = ${userId}::uuid
               AND handle = ${handle}
               AND image_url IS NULL
          `);
          imagesBackfilled += 1;
        }
      }
    } catch {
      errors += 1;
    }

    await new Promise((r) => setTimeout(r, PER_STORE_DELAY_MS));
  }

  return {
    storesScanned: stores.length,
    newDiscoveries,
    autoTracked,
    imagesBackfilled,
    errors,
  };
}

export async function getNewDiscoveryCount(userId: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM discovered_products
    WHERE status = 'new' AND user_id = ${userId}::uuid
  `);
  return row?.n ?? 0;
}

export async function refreshDiscoveryImage(id: string): Promise<void> {
  // Future: fetch the product's image lazily on first display. Not used
  // yet — for now the catalogue scan stores no image; we render a coloured
  // placeholder. This avoids one extra HTTP per product during scanning.
  void id;
}
