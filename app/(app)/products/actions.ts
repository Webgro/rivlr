"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray, and, sql } from "drizzle-orm";
import { requireUser, getCurrentUser } from "@/lib/auth/current-user";
import { dispatchCrawl } from "@/lib/crawler/dispatch";
import { probeVariantInventory } from "@/lib/crawler/cart-probe";

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
  totalQuantity: number | null;
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
      variants: [],
      written: false,
      error: "unauthorized",
    };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
    return {
      ok: false,
      totalQuantity: null,
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
      variants: [],
      written: false,
      error: "no variants — wait for the next crawl",
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

  let totalQuantity: number | null = 0;
  let anyExact = false;
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
      anyExact = true;
      q = probe.quantity;
      anyAvailable = anyAvailable || probe.quantity > 0;
      if (totalQuantity !== null) totalQuantity += probe.quantity;
    } else if (probe.kind === "soldout") {
      q = 0;
    } else if (probe.kind === "unbounded") {
      anyAvailable = true;
      totalQuantity = null;
    } else {
      totalQuantity = null;
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

  let written = false;
  if (anyExact || totalQuantity !== null) {
    await db.insert(schema.stockObservations).values({
      productId: product.id,
      available: anyAvailable || (totalQuantity !== null && totalQuantity > 0),
      quantity: totalQuantity,
      quantitySource: "probed",
    });
    await db
      .update(schema.trackedProducts)
      .set({ lastInventoryProbedAt: new Date() })
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
    totalQuantity: anyExact ? totalQuantity : null,
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
        target: schema.discoveredProducts.url,
        set: { status: "dismissed" as const },
      });
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/discover");
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

  await db
    .delete(schema.trackedProducts)
    .where(
      and(
        inArray(schema.trackedProducts.id, ids),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );

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
        target: schema.discoveredProducts.url,
        set: { status: "dismissed" as const },
      });
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/discover");
  return { ok: true as const, count: ids.length };
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

export async function linkProducts(formData: FormData) {
  const user = await requireUser();
  const aId = String(formData.get("a") ?? "");
  const bId = String(formData.get("b") ?? "");
  if (!aId || !bId || aId === bId) return;

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
  if (!a || !b) return;

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
