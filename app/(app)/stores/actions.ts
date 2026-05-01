"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, ne, and, sql, inArray } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";
import { scanBestsellerCollections, scanStoreNow } from "@/lib/crawler/store-scan";
import { dispatchCrawl } from "@/lib/crawler/dispatch";
import {
  fetchShopifyCollection,
  inferMarketFromDomain,
} from "@/lib/crawler/shopify";

/**
 * Mark a store as the user's own. Only one store can be flagged at a time
 * — assigning a new one clears the flag on any other. Triggers an
 * immediate best-seller collection probe so the /opportunities view has
 * useful data on first navigation rather than waiting for the daily cron.
 */
export async function markStoreAsMine(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;

  // Singleton flag. Clear all others first.
  await db
    .update(schema.stores)
    .set({ isMyStore: false })
    .where(and(eq(schema.stores.isMyStore, true), ne(schema.stores.domain, domain)));

  // Reset is_bestseller on every other store's products — a flag set when
  // that store WAS marked as mine doesn't apply now.
  await db.execute(sql`
    UPDATE tracked_products
       SET is_bestseller = false
     WHERE store_domain != ${domain}
       AND is_bestseller = true
  `);

  // Upsert ownership for this store.
  await db
    .insert(schema.stores)
    .values({ domain, isMyStore: true })
    .onConflictDoUpdate({
      target: schema.stores.domain,
      set: { isMyStore: true },
    });

  // Fire two background jobs in parallel:
  //  1. Import the store's full catalogue into tracked_products. The user
  //     wants their own products tracked automatically — they shouldn't
  //     have to add anything manually for /my-products to populate.
  //  2. Probe best-seller collections so /opportunities has demand signal.
  // Both deferred via after() so the redirect is instant.
  after(async () => {
    try {
      await importOwnStoreCatalogue(domain);
    } catch {
      // best effort — daily discovery cron will catch anything we missed.
    }
    try {
      await scanBestsellerCollections(domain);
    } catch {
      // best effort
    }
    try {
      // Kick a crawl so the just-imported products pick up prices fast.
      await dispatchCrawl({});
    } catch {
      // 10-min cron will pick them up regardless.
    }
    revalidatePath("/opportunities");
    revalidatePath("/my-products");
    revalidatePath(`/stores/${domain}`);
  });

  revalidatePath("/stores");
  revalidatePath(`/stores/${domain}`);
  revalidatePath("/opportunities");
}

/**
 * Convert every 'new' discovered_products row for a store into a tracked
 * product. One-shot bulk action — pairs with the per-row Track button on
 * the store profile's "Not tracked yet" panel.
 *
 * Triggers a background crawl after so the new rows pick up price/stock
 * within a few seconds rather than waiting for the next 10-min dispatch.
 */
export async function bulkTrackStoreDiscoveries(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;

  // Pull every 'new' discovery for this store.
  const rows = await db
    .select()
    .from(schema.discoveredProducts)
    .where(
      and(
        eq(schema.discoveredProducts.storeDomain, domain),
        eq(schema.discoveredProducts.status, "new"),
      ),
    );

  if (rows.length === 0) {
    revalidatePath(`/stores/${domain}`);
    return;
  }

  const market = inferMarketFromDomain(domain);

  // Bulk insert into tracked_products. URL has a unique constraint so any
  // already-tracked rows just get skipped.
  await db
    .insert(schema.trackedProducts)
    .values(
      rows.map((r) => ({
        url: r.url,
        handle: r.handle,
        storeDomain: r.storeDomain,
        title: r.title,
        imageUrl: r.imageUrl,
        currency: market.currency,
        marketCountry: market.country,
        marketCurrency: market.currency,
      })),
    )
    .onConflictDoNothing();

  // Drop the discovery rows now they're tracked.
  await db
    .delete(schema.discoveredProducts)
    .where(
      inArray(
        schema.discoveredProducts.id,
        rows.map((r) => r.id),
      ),
    );

  // Fire crawl in background so the new rows have data fast.
  after(async () => {
    try {
      await dispatchCrawl({});
    } catch {
      // 10-min cron will pick them up regardless.
    }
  });

  revalidatePath(`/stores/${domain}`);
  revalidatePath("/products");
  revalidatePath("/discover");
  revalidatePath("/dashboard");
}

/**
 * Flip the auto-track-new flag on a store. When true, the daily discovery
 * cron immediately tracks every new product it finds on this store
 * instead of staging them in discovered_products for review.
 */
export async function toggleAutoTrackNew(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  const next = String(formData.get("value") ?? "") === "true";
  if (!domain) return;

  await db
    .insert(schema.stores)
    .values({ domain, autoTrackNew: next })
    .onConflictDoUpdate({
      target: schema.stores.domain,
      set: { autoTrackNew: next },
    });

  revalidatePath(`/stores/${domain}`);
  revalidatePath("/stores");
}

/**
 * One-shot: import every public product on a store into tracked_products.
 * Called from markStoreAsMine so the user's catalogue is in /my-products
 * within seconds of marking, without waiting for the daily discovery
 * cron. Capped at 5,000 products to avoid runaway imports on huge
 * catalogues — the daily cron picks up anything beyond that on its
 * normal schedule.
 *
 * Same insertion pattern as bulkTrackStoreDiscoveries — onConflictDoNothing
 * so previously-tracked URLs are skipped.
 */
async function importOwnStoreCatalogue(domain: string) {
  const products = await fetchShopifyCollection(domain, "all", {
    maxProducts: 5000,
  });
  if (products.length === 0) return;

  const market = inferMarketFromDomain(domain);

  // Chunk inserts for parameter-limit safety.
  const chunkSize = 500;
  for (let i = 0; i < products.length; i += chunkSize) {
    const slice = products.slice(i, i + chunkSize);
    await db
      .insert(schema.trackedProducts)
      .values(
        slice.map((p) => ({
          url: `https://${domain}/products/${p.handle}`,
          handle: p.handle,
          storeDomain: domain,
          title: p.title,
          imageUrl: p.imageUrl,
          currency: market.currency,
          marketCountry: market.country,
          marketCurrency: market.currency,
        })),
      )
      .onConflictDoNothing();
  }

  // If any of these are sitting in discovered_products from a previous
  // session (status='new'), drop them — they're tracked now.
  await db.execute(sql`
    DELETE FROM discovered_products
    WHERE store_domain = ${domain}
      AND status = 'new'
  `);
}

/**
 * Manual "Crawl now" trigger from the store profile page. Refreshes
 * store-level intel (apps, theme, free-shipping, catalogue size) and
 * fires a forced product crawl that bypasses the cooldown — useful when
 * the user just changed something or wants fresh numbers right now
 * without waiting for the next 10-min cron.
 */
export async function crawlStoreNow(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;

  // scanStoreNow is fast (~5 fetches), worth awaiting so the user sees
  // updated numbers on the store profile after the redirect.
  try {
    await scanStoreNow(domain);
  } catch {
    // best effort
  }

  // Force-dispatch in the background — bypasses 55min/22h cooldowns
  // and re-crawls every active product. Most useful for the user's
  // own store because that's where they want fresh numbers fastest.
  after(async () => {
    try {
      await dispatchCrawl({ force: true });
    } catch {
      // cron will pick up
    }
  });

  revalidatePath(`/stores/${domain}`);
  revalidatePath("/stores");
}

export async function unmarkMyStore(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;
  await db
    .update(schema.stores)
    .set({ isMyStore: false })
    .where(eq(schema.stores.domain, domain));
  await db.execute(sql`
    UPDATE tracked_products
       SET is_bestseller = false
     WHERE store_domain = ${domain}
  `);
  revalidatePath("/stores");
  revalidatePath(`/stores/${domain}`);
  revalidatePath("/opportunities");
}
