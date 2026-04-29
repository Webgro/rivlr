"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, inArray, sql } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";

// ─── Single-product actions ─────────────────────────────────────────────

export async function pauseProduct(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.trackedProducts)
    .set({ active: false })
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
  revalidatePath(`/products/${id}`);
}

export async function deleteProduct(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .delete(schema.trackedProducts)
    .where(eq(schema.trackedProducts.id, id));
  revalidatePath("/dashboard");
  redirect("/dashboard");
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
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
}

// ─── Bulk actions ───────────────────────────────────────────────────────

export async function bulkPause(ids: string[]) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ active: false })
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkResume(ids: string[]) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ active: true })
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkDelete(ids: string[]) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .delete(schema.trackedProducts)
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkSetStockNotify(ids: string[], value: boolean) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ notifyStockChanges: value })
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

export async function bulkSetPriceDropNotify(ids: string[], value: boolean) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.trackedProducts)
    .set({ notifyPriceDrops: value })
    .where(inArray(schema.trackedProducts.id, ids));
  revalidatePath("/dashboard");
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

  revalidatePath("/dashboard");
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

  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
}

// ─── Manual crawl trigger ──────────────────────────────────────────────

export async function runCrawlNow(force = false) {
  if (!(await isAuthed())) redirect("/login");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { ok: false, error: "CRON_SECRET not set" } as const;
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const path = force ? "/api/crawl/dispatch?force=1" : "/api/crawl/dispatch";

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `dispatch returned ${res.status}`,
      } as const;
    }
    const data = (await res.json()) as { scheduled?: number; batches?: number };
    revalidatePath("/dashboard");
    return {
      ok: true,
      scheduled: data.scheduled ?? 0,
      batches: data.batches ?? 0,
    } as const;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } as const;
  }
}
