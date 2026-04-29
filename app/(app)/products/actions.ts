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

  for (const row of existing) {
    const merged = Array.from(new Set([...(row.tags ?? []), ...newTags]));
    await db
      .update(schema.trackedProducts)
      .set({ tags: merged })
      .where(eq(schema.trackedProducts.id, row.id));
  }

  revalidatePath("/dashboard");
  return {
    ok: true as const,
    count: existing.length,
    tagsAdded: newTags,
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
