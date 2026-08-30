"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, sql, inArray, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import { scanBestsellerCollections, scanStoreNow } from "@/lib/crawler/store-scan";
import { dispatchCrawl } from "@/lib/crawler/dispatch";
import { inferMarketFromDomain } from "@/lib/crawler/shopify";
import { importOwnStoreCatalogue } from "@/lib/catalogue-import";
import { getCompetitorQuota } from "@/lib/plan";

/**
 * Per-user store actions. Per-user attributes (is_my_store, auto_track_new)
 * live in user_store_prefs since Phase 3 part 3 — the global stores table
 * keeps store-level intel (apps, theme, etc) but no longer holds per-user
 * flags.
 */

async function upsertStorePref(
  userId: string,
  domain: string,
  patch: Partial<typeof schema.userStorePrefs.$inferInsert>,
) {
  // Drizzle doesn't expose composite-PK upsert cleanly, so do
  // SELECT-then-INSERT-or-UPDATE manually. Cheap on a tiny table.
  const [existing] = await db
    .select()
    .from(schema.userStorePrefs)
    .where(
      and(
        eq(schema.userStorePrefs.userId, userId),
        eq(schema.userStorePrefs.domain, domain),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(schema.userStorePrefs)
      .set({ ...patch, setAt: new Date() })
      .where(
        and(
          eq(schema.userStorePrefs.userId, userId),
          eq(schema.userStorePrefs.domain, domain),
        ),
      );
  } else {
    await db.insert(schema.userStorePrefs).values({
      userId,
      domain,
      ...patch,
    });
  }
}

/**
 * Mark a store as the user's own. Only one store can be flagged at a time
 * per user — assigning a new one clears the flag on any other for the same
 * user. Triggers an immediate best-seller probe so /opportunities has data
 * on first navigation.
 */
export async function markStoreAsMine(formData: FormData) {
  const user = await requireUser();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;

  // Singleton-per-user: clear is_my_store on any other store for this user.
  await db
    .update(schema.userStorePrefs)
    .set({ isMyStore: false })
    .where(
      and(
        eq(schema.userStorePrefs.userId, user.id),
        eq(schema.userStorePrefs.isMyStore, true),
        ne(schema.userStorePrefs.domain, domain),
      ),
    );

  // Reset is_bestseller on every other store's products owned by this user.
  await db.execute(sql`
    UPDATE tracked_products
       SET is_bestseller = false
     WHERE user_id = ${user.id}::uuid
       AND store_domain != ${domain}
       AND is_bestseller = true
  `);

  // Set this store as mine for this user.
  await upsertStorePref(user.id, domain, { isMyStore: true });

  // Dual-write to legacy stores.is_my_store while reads still point at it.
  // Removed in the final part-3 cleanup commit once every page query
  // reads from user_store_prefs.
  await db
    .update(schema.stores)
    .set({ isMyStore: false })
    .where(and(eq(schema.stores.isMyStore, true), ne(schema.stores.domain, domain)));
  await db
    .insert(schema.stores)
    .values({ domain, isMyStore: true })
    .onConflictDoUpdate({
      target: schema.stores.domain,
      set: { isMyStore: true },
    });

  // Background work: import the catalogue, probe bestsellers, kick a crawl.
  after(async () => {
    try {
      await importOwnStoreCatalogue(user.id, domain);
    } catch {
      // best effort — daily discovery cron will catch anything we missed.
    }
    try {
      await scanBestsellerCollections(domain);
    } catch {
      // best effort
    }
    try {
      await dispatchCrawl({});
    } catch {
      // 10-min cron will pick up regardless.
    }
    revalidatePath("/opportunities");
    revalidatePath("/products");
    revalidatePath(`/stores/${domain}`);
  });

  revalidatePath("/stores");
  revalidatePath(`/stores/${domain}`);
  revalidatePath("/opportunities");
}

export async function unmarkMyStore(formData: FormData) {
  const user = await requireUser();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;
  await upsertStorePref(user.id, domain, { isMyStore: false });
  // Dual-write to legacy stores.is_my_store. Removed in part-3 cleanup.
  await db
    .update(schema.stores)
    .set({ isMyStore: false })
    .where(eq(schema.stores.domain, domain));
  await db.execute(sql`
    UPDATE tracked_products
       SET is_bestseller = false
     WHERE user_id = ${user.id}::uuid
       AND store_domain = ${domain}
  `);
  revalidatePath("/stores");
  revalidatePath(`/stores/${domain}`);
  revalidatePath("/opportunities");
}

export async function toggleAutoTrackNew(formData: FormData) {
  const user = await requireUser();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  const next = String(formData.get("value") ?? "") === "true";
  if (!domain) return;
  await upsertStorePref(user.id, domain, { autoTrackNew: next });
  // Dual-write to legacy stores.auto_track_new. Removed in part-3 cleanup.
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

export async function bulkTrackStoreDiscoveries(formData: FormData) {
  const user = await requireUser();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;

  const rows = await db
    .select()
    .from(schema.discoveredProducts)
    .where(
      and(
        eq(schema.discoveredProducts.userId, user.id),
        eq(schema.discoveredProducts.storeDomain, domain),
        eq(schema.discoveredProducts.status, "new"),
      ),
    );

  if (rows.length === 0) {
    revalidatePath(`/stores/${domain}`);
    return;
  }

  const market = inferMarketFromDomain(domain);

  await db
    .insert(schema.trackedProducts)
    .values(
      rows.map((r) => ({
        userId: user.id,
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

  await db
    .delete(schema.discoveredProducts)
    .where(
      inArray(
        schema.discoveredProducts.id,
        rows.map((r) => r.id),
      ),
    );

  after(async () => {
    try {
      await dispatchCrawl({});
    } catch {
      // 10-min cron will pick them up regardless.
    }
  });

  revalidatePath(`/stores/${domain}`);
  revalidatePath("/products");
  revalidatePath("/discovery");
  revalidatePath("/dashboard");
}

/**
 * One-shot: import every public product on a store into tracked_products
 * for the given user. Called from markStoreAsMine so the user's catalogue
 * is in /my-products within seconds of marking. Capped at 5,000 products.
 */
/**
 * Add a store to the user's store list without first tracking a
 * product. Use cases:
 *   - Adding your own store before tracking competitors (so you can
 *     mark it as "my store" and trigger catalogue auto-import).
 *   - Pre-loading a competitor store you'll explore later via the
 *     store-scan flow.
 *
 * Validates the domain looks like a Shopify storefront by doing a
 * cheap GET on /products.json?limit=1. No DB writes if that fails.
 *
 * isMyStore=true triggers the same catalogue auto-import + bestseller
 * probe path that markStoreAsMine uses, so the user lands on
 * /my-products with their products already populating.
 */
export async function addStore(formData: FormData): Promise<void> {
  const user = await requireUser();
  const rawDomain = String(formData.get("domain") ?? "");
  const isMyStore = String(formData.get("is-my-store") ?? "") === "true";

  const domain = parseStoreDomain(rawDomain);
  if (!domain) {
    redirect(`/stores/new?error=invalid-url`);
  }

  // Competitor cap. Checked before the reachability probe so someone at
  // their limit is told so immediately rather than after a round trip to
  // a shop they are not allowed to add. Marking your own store is exempt:
  // it is the thing being compared against, not a rival.
  if (!isMyStore) {
    const existing = await db
      .select({ domain: schema.userStorePrefs.domain })
      .from(schema.userStorePrefs)
      .where(
        and(
          eq(schema.userStorePrefs.userId, user.id),
          eq(schema.userStorePrefs.domain, domain),
        ),
      )
      .limit(1);
    // Re-adding a shop already on the list is not a new slot.
    if (existing.length === 0) {
      const quota = await getCompetitorQuota(user.id);
      if (quota.full) {
        redirect(`/stores/new?error=competitor-limit&limit=${quota.limit}`);
      }
    }
  }

  // Verify it's a real, reachable Shopify store. Cheap probe — one
  // page-1 request, single product.
  try {
    const res = await fetch(
      `https://${domain}/products.json?limit=1`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) {
      redirect(`/stores/new?error=unreachable&domain=${encodeURIComponent(domain)}`);
    }
    const data = (await res.json().catch(() => null)) as
      | { products?: unknown[] }
      | null;
    if (!data || !Array.isArray(data.products)) {
      redirect(`/stores/new?error=not-shopify&domain=${encodeURIComponent(domain)}`);
    }
  } catch {
    redirect(`/stores/new?error=unreachable&domain=${encodeURIComponent(domain)}`);
  }

  // Insert the store row if it doesn't exist (other users may already
  // have it — global store-level intel is shared).
  await db
    .insert(schema.stores)
    .values({ domain })
    .onConflictDoNothing();

  if (isMyStore) {
    // Reuse the markStoreAsMine plumbing — clears any other my-store
    // flag for this user, sets is_my_store, kicks off the catalogue
    // import + bestseller probe in `after()`.
    const fd = new FormData();
    fd.set("domain", domain);
    await markStoreAsMine(fd);
  } else {
    // Just a pref row so the store appears on /stores. Otherwise the
    // user can browse to /stores/[domain] and explore from there.
    await upsertStorePref(user.id, domain, {});
    // Quick metadata scan in the background so the row populates with
    // catalogue size, apps, etc.
    after(async () => {
      try {
        await scanStoreNow(domain);
      } catch {
        // best-effort — daily cron will catch anything we missed
      }
      revalidatePath(`/stores/${domain}`);
    });
  }

  revalidatePath("/stores");
  redirect(`/stores/${domain}?added=1`);
}

/**
 * Normalise a user-typed store URL down to a bare domain. Same parser
 * shape as scan-actions.ts — accepts bare domains, www., https://, and
 * URLs with paths.
 */
function parseStoreDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  let domain = trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "");
  domain = domain.split("/")[0].split("?")[0].split("#")[0];
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) return null;
  return domain;
}

/**
 * Manual "Crawl now" trigger from the store profile page. Refreshes
 * store-level intel (apps, theme, free-shipping, catalogue size) and
 * fires a forced product crawl that bypasses the cooldown.
 */
export async function crawlStoreNow(formData: FormData) {
  await requireUser();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;

  try {
    await scanStoreNow(domain);
  } catch {
    // best effort
  }

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
