"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray, sql } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";
import { dispatchCrawl } from "@/lib/crawler/dispatch";

// ─── Single-product actions ─────────────────────────────────────────────

/**
 * Update the market this product is crawled under. Affects the hourly
 * dispatch (uses these as Shopify Markets cookies). The next crawl will
 * pick up the new currency. Existing price history retains its original
 * currency on each row, so the chart shows a discontinuity at the
 * change-over point — that's intentional, not a bug.
 */
export async function setProductMarket(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const country = String(formData.get("country") ?? "").trim().toUpperCase();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (!id || !/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) return;
  await db
    .update(schema.trackedProducts)
    .set({
      marketCountry: country,
      marketCurrency: currency,
      // Update the displayed currency immediately so the UI doesn't lag
      // a crawl behind. Real currency is reconfirmed on next crawl.
      currency,
    })
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");
}


export async function pauseProduct(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ active: false })
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath("/products"); revalidatePath("/dashboard");
  revalidatePath(`/products/${id}`);
}

export async function resumeProduct(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ active: true })
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath("/products"); revalidatePath("/dashboard");
  revalidatePath(`/products/${id}`);
}

export async function deleteProduct(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .delete(schema.trackedProducts)
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath("/products"); revalidatePath("/dashboard");
  redirect("/products");
}

export async function toggleStockNotify(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const value = formData.get("value") === "true";
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ notifyStockChanges: value })
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath(`/products/${id}`);
  revalidatePath("/products"); revalidatePath("/dashboard");
}

export async function togglePriceDropNotify(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const value = formData.get("value") === "true";
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ notifyPriceDrops: value })
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath(`/products/${id}`);
  revalidatePath("/products"); revalidatePath("/dashboard");
}

// ─── Bulk actions ───────────────────────────────────────────────────────

export async function bulkPause(ids: string[]) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ active: false })
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/products"); revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkResume(ids: string[]) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ active: true })
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/products"); revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkDelete(ids: string[]) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .delete(schema.trackedProducts)
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/products"); revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkSetStockNotify(ids: string[], value: boolean) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ notifyStockChanges: value })
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/products"); revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkSetPriceDropNotify(ids: string[], value: boolean) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ notifyPriceDrops: value })
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/products"); revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

/**
 * Add tag(s) to multiple products. Tags are normalised to lowercase, trimmed,
 * and de-duplicated. Multiple tags can be passed comma-separated.
 *
 * Implementation: read-then-write per product. Avoids the SQL gymnastics of
 * deduplicating an array merge inside one UPDATE (Postgres can do it but the
 * subquery against the same UPDATE target was crashing). N+1 queries are
 * fine at v1 scale.
 */
export async function bulkAddTags(ids: string[], rawTags: string) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
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
    .where(inArray(schema.trackedProducts.id, ids));

  // Tags must be pre-registered in the tags metadata table — refuse names
  // that don't exist there. Forces users to create + colour tags via /tags
  // first, which keeps the tag taxonomy clean.
  const registered = await db
    .select({ name: schema.tags.name })
    .from(schema.tags);
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
      .where(eq(schema.trackedProducts.id, row.id));
  }

  revalidatePath("/products"); revalidatePath("/dashboard");
  return {
    ok: true as const,
    count: existing.length,
    tagsAdded: validTags,
  };
}

export async function bulkRemoveTag(ids: string[], tag: string) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  const cleanTag = tag.trim().toLowerCase();
  if (ids.length === 0 || !cleanTag) return { ok: true as const, count: 0 };

  const existing = await db
    .select({
      id: schema.trackedProducts.id,
      tags: schema.trackedProducts.tags,
    })
    .from(schema.trackedProducts)
    .where(inArray(schema.trackedProducts.id, ids));

  for (const row of existing) {
    const filtered = (row.tags ?? []).filter((t) => t !== cleanTag);
    await db
      .update(schema.trackedProducts)
      .set({ tags: filtered })
      .where(eq(schema.trackedProducts.id, row.id));
  }

  revalidatePath("/products"); revalidatePath("/dashboard");
  return { ok: true as const, count: existing.length };
}

// ─── Linking products ──────────────────────────────────────────────────

/**
 * Link two tracked products into the same group (creating a group if neither
 * has one). Used when the same item is sold across multiple stores. After
 * linking, the detail page shows side-by-side pricing for all members.
 */
export async function linkProducts(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const aId = String(formData.get("a") ?? "");
  const bId = String(formData.get("b") ?? "");
  if (!aId || !bId || aId === bId) return;

  const both = await db
    .select()
    .from(schema.trackedProducts)
    .where(inArray(schema.trackedProducts.id, [aId, bId]));
  const a = both.find((p) => p.id === aId);
  const b = both.find((p) => p.id === bId);
  if (!a || !b) return;

  // If either already has a group, reuse it. Otherwise create one named
  // after the first product's title.
  let groupId = a.groupId ?? b.groupId;
  if (!groupId) {
    const [created] = await db
      .insert(schema.productGroups)
      .values({ name: a.title ?? a.handle })
      .returning();
    groupId = created.id;
  }

  await db
    .update(schema.trackedProducts)
    .set({ groupId })
    .where(inArray(schema.trackedProducts.id, [aId, bId]));

  revalidatePath(`/products/${aId}`);
  revalidatePath(`/products/${bId}`);
  revalidatePath("/products"); revalidatePath("/dashboard");
}

export async function unlinkProduct(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ groupId: null })
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath(`/products/${id}`);
  revalidatePath("/products"); revalidatePath("/dashboard");
}

// ─── Per-product notes ─────────────────────────────────────────────────

export async function saveProductNotes(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const notesRaw = String(formData.get("notes") ?? "");
  const notes = notesRaw.trim().slice(0, 10_000) || null;
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ notes })
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath(`/products/${id}`);
}

// ─── Single-product crawl trigger ─────────────────────────────────────

export async function runCrawlForProduct(productId: string) {
  if (!(await isAuthed())) redirect("/login");
  // Background — same reasoning as runCrawlNow: don't block navigation. The
  // client should refresh after a delay to pick up the new observation.
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

// ─── Manual crawl trigger ──────────────────────────────────────────────

/**
 * Trigger a crawl. Uses after() so the actual work runs after this server
 * action returns — the client gets an immediate ack and can navigate, the
 * CrawlProgress widget picks up the activity within 3s.
 *
 * Without after(), Next.js holds the navigation behind the in-flight action
 * (server actions block soft nav until they resolve), which made clicking
 * 'Run crawl now' feel like a freeze for 30s.
 */
export async function runCrawlNow(_force = false) {
  if (!(await isAuthed())) redirect("/login");
  after(async () => {
    try {
      await dispatchCrawl({});
    } catch {
      /* widget will surface the failure indirectly */
    }
  });
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const, scheduled: 0, batches: 0, ok_count: 0, failed: 0 };
}
