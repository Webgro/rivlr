"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray, and, sql } from "drizzle-orm";
import { requireUser, getCurrentUser } from "@/lib/auth/current-user";
import { dispatchCrawl } from "@/lib/crawler/dispatch";
import { probeVariantInventory } from "@/lib/crawler/cart-probe";
import { trackMatchedProducts } from "./track-matched";

/**
 * All product-level server actions. Per-Phase-3-part-3 every action is
 * scoped to the current user — both the auth gate (requireUser →
 * redirect to /login on miss) AND every WHERE / INSERT explicitly
 * includes userId so a malicious request constructed against another
 * user's product id fails silently rather than mutating their data.
 */

// ─── Single-product actions ─────────────────────────────────────────────

/**
 * Diagnostic on-demand inventory probe for a single product. Returns
 * per-variant probe results + raw error messages for debugging.
 */
export async function probeInventoryNow(productId: string): Promise<{
  ok: boolean;
  /** Sum of variants we got an exact reading for. Null only when NO
   *  variants returned exact data (i.e. all blocked / unbounded /
   *  unknown). When some-but-not-all variants are exact this is the
   *  partial sum and `incomplete` is true. */
  totalQuantity: number | null;
  /** True when at least one variant is blocked / unknown / unbounded —
   *  the total reflects only the variants we could read. UI shows
   *  "X+ units" rather than "X units" when this is set. */
  incomplete: boolean;
  /** Number of variants we got an exact reading for. Lets the UI say
   *  "X+ units across 4 of 5 variants". */
  exactCount: number;
  /** Total variants probed. */
  totalCount: number;
  variants: Array<{
    id: string;
    title: string;
    kind: string;
    quantity: number | null;
    status: number;
    message: string | null;
  }>;
  written: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      totalQuantity: null,
      incomplete: false,
      exactCount: 0,
      totalCount: 0,
      variants: [],
      written: false,
      error: "unauthorized",
    };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
    return {
      ok: false,
      totalQuantity: null,
      incomplete: false,
      exactCount: 0,
      totalCount: 0,
      variants: [],
      written: false,
      error: "invalid id",
    };
  }

  const [product] = await db
    .select()
    .from(schema.trackedProducts)
    .where(
      and(
        eq(schema.trackedProducts.id, productId),
        eq(schema.trackedProducts.userId, user.id),
      ),
    )
    .limit(1);
  if (!product) {
    return {
      ok: false,
      totalQuantity: null,
      incomplete: false,
      exactCount: 0,
      totalCount: 0,
      variants: [],
      written: false,
      error: "not found",
    };
  }

  const market =
    product.marketCountry && product.marketCurrency
      ? { country: product.marketCountry, currency: product.marketCurrency }
      : undefined;

  const variantsToProbe = (product.variantsSnapshot ?? []).slice(0, 12);
  if (variantsToProbe.length === 0) {
    return {
      ok: false,
      totalQuantity: null,
      incomplete: false,
      exactCount: 0,
      totalCount: 0,
      variants: [],
      written: false,
      error: "No sizes or options found yet. Try again after the next check.",
    };
  }

  const results: Array<{
    id: string;
    title: string;
    kind: string;
    quantity: number | null;
    status: number;
    message: string | null;
  }> = [];

  // We track three things separately so the summary can say "X+ units
  // across 4 of 5 variants probed" rather than collapsing to null when
  // a single variant is blocked.
  let exactSum = 0; // running total for variants we have exact data on
  let exactCount = 0;
  let unboundedSeen = false; // any variant has effectively-unlimited stock
  let blockedOrUnknown = 0;
  let anyAvailable = false;

  for (let i = 0; i < variantsToProbe.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000));
    const v = variantsToProbe[i];
    const probe = await probeVariantInventory(
      product.storeDomain,
      v.id,
      market,
    );
    let q: number | null = null;
    if (probe.kind === "exact") {
      exactCount++;
      exactSum += probe.quantity;
      q = probe.quantity;
      anyAvailable = anyAvailable || probe.quantity > 0;
    } else if (probe.kind === "soldout") {
      // Sold-out is a known reading: contributes 0 to the sum but
      // doesn't invalidate the total. Counted as exact for UI purposes.
      exactCount++;
      q = 0;
    } else if (probe.kind === "unbounded") {
      // Variant has no cart-add limit — true total is meaningless.
      anyAvailable = true;
      unboundedSeen = true;
    } else {
      // blocked / unknown — we don't have data on this variant.
      blockedOrUnknown++;
    }
    results.push({
      id: String(v.id),
      title: v.title,
      kind: probe.kind,
      quantity: q,
      status: probe.debug.status,
      message: probe.debug.message,
    });
  }

  // Final reporting:
  //   - Any unbounded → totalQuantity = null (no meaningful sum).
  //   - Otherwise → exactSum if we got at least one exact reading,
  //     else null.
  //   - incomplete = some variants weren't readable, so the sum is a
  //     lower bound rather than a true total.
  const totalQuantity =
    unboundedSeen || exactCount === 0 ? null : exactSum;
  const incomplete = blockedOrUnknown > 0 || unboundedSeen;

  let written = false;
  if (totalQuantity !== null || anyAvailable) {
    await db.insert(schema.stockObservations).values({
      productId: product.id,
      available: anyAvailable || (totalQuantity !== null && totalQuantity > 0),
      quantity: totalQuantity,
      quantitySource: "probed",
    });
    await db
      .update(schema.trackedProducts)
      .set({
        lastInventoryProbedAt: new Date(),
        latestAvailable:
          anyAvailable || (totalQuantity !== null && totalQuantity > 0),
        latestQuantity: totalQuantity,
        latestObservedAt: new Date(),
      })
      .where(
        and(
          eq(schema.trackedProducts.id, product.id),
          eq(schema.trackedProducts.userId, user.id),
        ),
      );
    written = true;
  }

  revalidatePath(`/products/${productId}`);

  return {
    ok: true,
    totalQuantity,
    incomplete,
    exactCount,
    totalCount: variantsToProbe.length,
    variants: results,
    written,
  };
}

/**
 * Update the market this product is crawled under. Affects the hourly
 * dispatch (uses these as Shopify Markets cookies). Existing price
 * history retains its original currency on each row.
 */
export async function setProductMarket(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const country = String(formData.get("country") ?? "").trim().toUpperCase();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (!id || !/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) return;
  await db
    .update(schema.trackedProducts)
    .set({
      marketCountry: country,
      marketCurrency: currency,
      currency,
    })
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");
}

export async function toggleFavourite(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("value") ?? "") === "true";
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ isFavourite: next })
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath(`/products/${id}`);
}

export async function pauseProduct(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ active: false })
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath(`/products/${id}`);
}

export async function resumeProduct(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ active: true })
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath(`/products/${id}`);
}

export async function deleteProduct(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Capture identity BEFORE deletion so we can write a tombstone into
  // discovered_products. Without this, the daily catalogue scan re-finds
  // the product and re-suggests it.
  const [doomed] = await db
    .select({
      url: schema.trackedProducts.url,
      handle: schema.trackedProducts.handle,
      storeDomain: schema.trackedProducts.storeDomain,
      title: schema.trackedProducts.title,
      imageUrl: schema.trackedProducts.imageUrl,
    })
    .from(schema.trackedProducts)
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    )
    .limit(1);

  await db
    .delete(schema.trackedProducts)
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );

  if (doomed) {
    await db
      .insert(schema.discoveredProducts)
      .values({
        userId: user.id,
        storeDomain: doomed.storeDomain,
        handle: doomed.handle,
        title: doomed.title,
        imageUrl: doomed.imageUrl,
        url: doomed.url,
        status: "dismissed" as const,
      })
      .onConflictDoUpdate({
        // (user, store, handle), not url: there is no unique index on url,
        // so this threw "no unique or exclusion constraint matching the ON
        // CONFLICT specification" every time — after the products had
        // already been deleted, so the rows vanished while the UI
        // reported a failure.
        target: [
          schema.discoveredProducts.userId,
          schema.discoveredProducts.storeDomain,
          schema.discoveredProducts.handle,
        ],
        set: { status: "dismissed" as const },
      });
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/discovery");
  redirect("/products");
}

export async function toggleStockNotify(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const value = formData.get("value") === "true";
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ notifyStockChanges: value })
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function togglePriceDropNotify(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const value = formData.get("value") === "true";
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ notifyPriceDrops: value })
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

// ─── Bulk actions ───────────────────────────────────────────────────────

export async function bulkPause(ids: string[]) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ active: false })
    .where(
      and(
        inArray(schema.trackedProducts.id, ids),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkResume(ids: string[]) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ active: true })
    .where(
      and(
        inArray(schema.trackedProducts.id, ids),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkDelete(ids: string[]) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };

  const doomed = await db
    .select({
      id: schema.trackedProducts.id,
      url: schema.trackedProducts.url,
      handle: schema.trackedProducts.handle,
      storeDomain: schema.trackedProducts.storeDomain,
      title: schema.trackedProducts.title,
      imageUrl: schema.trackedProducts.imageUrl,
    })
    .from(schema.trackedProducts)
    .where(
      and(
        inArray(schema.trackedProducts.id, ids),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );

  // Deleting a product cascades into price_observations,
  // stock_observations, crawl_jobs, multi_market_observations, and
  // alert_log. On hourly-crawled products that's thousands of child
  // rows each; a single DELETE for 50 products was one giant cascade
  // that blew the action's time budget and crashed the page. Instead:
  // small chunks, heavy child tables cleared explicitly per chunk so
  // every statement stays bounded, and any failure reports partial
  // progress instead of throwing at the error boundary.
  const ownedIds = doomed.map((d) => d.id);
  const CHUNK = 10;
  let deleted = 0;
  try {
    for (let i = 0; i < ownedIds.length; i += CHUNK) {
      const slice = ownedIds.slice(i, i + CHUNK);
      // inArray, not `ANY(${slice}::uuid[])`. Drizzle expands a JS
      // array in a sql`` template into a comma-separated parameter
      // list, so that form reached Postgres as ANY(($1, $2, …)::uuid[])
      // — a row constructor rather than an array, which fails to parse.
      // Every bulk delete errored on its first statement, and the catch
      // below reported it as a timeout.
      await db
        .delete(schema.priceObservations)
        .where(inArray(schema.priceObservations.productId, slice));
      await db
        .delete(schema.stockObservations)
        .where(inArray(schema.stockObservations.productId, slice));
      await db
        .delete(schema.multiMarketObservations)
        .where(inArray(schema.multiMarketObservations.productId, slice));
      await db
        .delete(schema.crawlJobs)
        .where(inArray(schema.crawlJobs.productId, slice));
      await db
        .delete(schema.alertLog)
        .where(inArray(schema.alertLog.productId, slice));
      await db
        .delete(schema.trackedProducts)
        .where(
          and(
            inArray(schema.trackedProducts.id, slice),
            eq(schema.trackedProducts.userId, user.id),
          ),
        );
      deleted += slice.length;
    }
  } catch (err) {
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return {
      ok: false as const,
      // Don't name a cause we haven't established — this said "database
      // timeout" for every failure, which sent the last one entirely
      // the wrong way. Partial progress is real and worth reporting;
      // the reason is whatever the error actually says.
      error: `Deleted ${deleted} of ${ownedIds.length}, then hit an error. Run delete again for the rest. (${err instanceof Error ? err.message.slice(0, 160) : "unknown error"})`,
    };
  }

  if (doomed.length > 0) {
    await db
      .insert(schema.discoveredProducts)
      .values(
        doomed.map((d) => ({
          userId: user.id,
          storeDomain: d.storeDomain,
          handle: d.handle,
          title: d.title,
          imageUrl: d.imageUrl,
          url: d.url,
          status: "dismissed" as const,
        })),
      )
      .onConflictDoUpdate({
        // (user, store, handle), not url: there is no unique index on url,
        // so this threw "no unique or exclusion constraint matching the ON
        // CONFLICT specification" every time — after the products had
        // already been deleted, so the rows vanished while the UI
        // reported a failure.
        target: [
          schema.discoveredProducts.userId,
          schema.discoveredProducts.storeDomain,
          schema.discoveredProducts.handle,
        ],
        set: { status: "dismissed" as const },
      });
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/discovery");
  return { ok: true as const, count: deleted };
}

export async function bulkSetStockNotify(ids: string[], value: boolean) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ notifyStockChanges: value })
    .where(
      and(
        inArray(schema.trackedProducts.id, ids),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkSetPriceDropNotify(ids: string[], value: boolean) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ notifyPriceDrops: value })
    .where(
      and(
        inArray(schema.trackedProducts.id, ids),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

/**
 * Add tag(s) to multiple products. Read-then-write per product to avoid
 * SQL-side array merge gymnastics. Tags must be pre-registered.
 */
export async function bulkAddTags(ids: string[], rawTags: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };

  const newTags = Array.from(
    new Set(
      rawTags
        .split(/[,]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .filter((t) => t.length <= 32),
    ),
  );
  if (newTags.length === 0) return { ok: true as const, count: 0 };

  const existing = await db
    .select({
      id: schema.trackedProducts.id,
      tags: schema.trackedProducts.tags,
    })
    .from(schema.trackedProducts)
    .where(
      and(
        inArray(schema.trackedProducts.id, ids),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );

  // Tags must exist in this user's tags table.
  const registered = await db
    .select({ name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.userId, user.id));
  const registeredNames = new Set(registered.map((r) => r.name));
  const validTags = newTags.filter((t) => registeredNames.has(t));

  if (validTags.length === 0) {
    return {
      ok: false as const,
      error: "Tag does not exist. Create it on /tags first.",
    };
  }

  for (const row of existing) {
    const merged = Array.from(new Set([...(row.tags ?? []), ...validTags]));
    await db
      .update(schema.trackedProducts)
      .set({ tags: merged })
      .where(
        and(
          eq(schema.trackedProducts.id, row.id),
          eq(schema.trackedProducts.userId, user.id),
        ),
      );
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return {
    ok: true as const,
    count: existing.length,
    tagsAdded: validTags,
  };
}

export async function bulkRemoveTag(ids: string[], tag: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  const cleanTag = tag.trim().toLowerCase();
  if (ids.length === 0 || !cleanTag) return { ok: true as const, count: 0 };

  const existing = await db
    .select({
      id: schema.trackedProducts.id,
      tags: schema.trackedProducts.tags,
    })
    .from(schema.trackedProducts)
    .where(
      and(
        inArray(schema.trackedProducts.id, ids),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );

  for (const row of existing) {
    const filtered = (row.tags ?? []).filter((t) => t !== cleanTag);
    await db
      .update(schema.trackedProducts)
      .set({ tags: filtered })
      .where(
        and(
          eq(schema.trackedProducts.id, row.id),
          eq(schema.trackedProducts.userId, user.id),
        ),
      );
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const, count: existing.length };
}

// ─── Linking products ──────────────────────────────────────────────────

/**
 * Put two products in the same comparison group.
 *
 * `b` isn't necessarily tracked: the picker also offers rows straight out of
 * the discovery queue, and `source` says which table its id belongs to. An
 * untracked candidate is promoted through trackMatchedProducts first, so the
 * plan limit, the group wiring and the initial crawl all behave exactly as
 * they do in the discovery flow.
 */
export async function linkProducts(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const aId = String(formData.get("a") ?? "");
  const bId = String(formData.get("b") ?? "");
  const source = String(formData.get("source") ?? "tracked");
  if (!aId || !bId || aId === bId) {
    return { ok: false, error: "Nothing to link." };
  }

  if (source === "discovered") {
    // Check ownership before promoting. The id comes from the client, and
    // trackMatchedProducts would silently no-op on another user's row rather
    // than telling us it refused.
    const [candidate] = await db
      .select({ id: schema.discoveredProducts.id })
      .from(schema.discoveredProducts)
      .where(
        and(
          eq(schema.discoveredProducts.id, bId),
          eq(schema.discoveredProducts.userId, user.id),
        ),
      )
      .limit(1);
    if (!candidate) {
      return { ok: false, error: "That product is no longer available to link." };
    }

    // This tracks the product AND puts it in aId's group, so there's no
    // separate link step to run afterwards.
    const result = await trackMatchedProducts([
      { discoveredId: bId, myProductId: aId },
    ]);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? "Couldn't track that product just now.",
      };
    }
    if (result.tracked === 0) {
      return { ok: false, error: "Couldn't link that product. Try again." };
    }
    revalidatePath(`/products/${aId}`);
    return { ok: true };
  }

  const both = await db
    .select()
    .from(schema.trackedProducts)
    .where(
      and(
        inArray(schema.trackedProducts.id, [aId, bId]),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  const a = both.find((p) => p.id === aId);
  const b = both.find((p) => p.id === bId);
  if (!a || !b) {
    return { ok: false, error: "That product is no longer available to link." };
  }

  let groupId = a.groupId ?? b.groupId;
  if (!groupId) {
    const [created] = await db
      .insert(schema.productGroups)
      .values({ userId: user.id, name: a.title ?? a.handle })
      .returning();
    groupId = created.id;
  }

  await db
    .update(schema.trackedProducts)
    .set({ groupId })
    .where(
      and(
        inArray(schema.trackedProducts.id, [aId, bId]),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );

  revalidatePath(`/products/${aId}`);
  revalidatePath(`/products/${bId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function unlinkProduct(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ groupId: null })
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

// ─── Per-product notes ─────────────────────────────────────────────────

export async function saveProductNotes(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const notesRaw = String(formData.get("notes") ?? "");
  const notes = notesRaw.trim().slice(0, 10_000) || null;
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ notes })
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  revalidatePath(`/products/${id}`);
}

// ─── Crawl triggers ────────────────────────────────────────────────────

export async function runCrawlForProduct(productId: string) {
  const user = await requireUser();
  // Verify ownership before scheduling work.
  const [owned] = await db
    .select({ id: schema.trackedProducts.id })
    .from(schema.trackedProducts)
    .where(
      and(
        eq(schema.trackedProducts.id, productId),
        eq(schema.trackedProducts.userId, user.id),
      ),
    )
    .limit(1);
  if (!owned) return { ok: false as const };

  after(async () => {
    try {
      const { crawlProductOnce } = await import("@/lib/crawler/dispatch");
      await crawlProductOnce(productId);
    } catch {
      /* surfaced via product's lastError column on next render */
    }
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return { ok: true as const };
}

/**
 * Trigger a global crawl. Uses after() so the dispatch runs in the
 * background — client gets immediate ack, CrawlProgress widget picks up
 * activity within 3s.
 */
export async function runCrawlNow(_force = false) {
  await requireUser();
  after(async () => {
    try {
      await dispatchCrawl({});
    } catch {
      /* widget will surface failure indirectly */
    }
  });
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const, scheduled: 0, batches: 0, ok_count: 0, failed: 0 };
}

// suppress sql-import linter complaint when not all paths use it
void sql;
