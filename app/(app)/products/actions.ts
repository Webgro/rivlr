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
 * Add a tag to multiple products. Tags are normalised to lowercase, trimmed,
 * and de-duplicated against existing tags on each product. Multiple tags can
 * be passed comma-separated in `rawTags`.
 */
export async function bulkAddTags(ids: string[], rawTags: string) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };

  const tags = Array.from(
    new Set(
      rawTags
        .split(/[,]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .filter((t) => t.length <= 32),
    ),
  );
  if (tags.length === 0) return { ok: true as const, count: 0 };

  // Use array_cat + array_distinct simulated via UNNEST/ARRAY_AGG.
  await db.execute(sql`
    UPDATE tracked_products
    SET tags = (
      SELECT ARRAY_AGG(DISTINCT tag)
      FROM UNNEST(tags || ${tags}::text[]) AS tag
    )
    WHERE id IN (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
  `);
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length, tagsAdded: tags };
}

export async function bulkRemoveTag(ids: string[], tag: string) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  const cleanTag = tag.trim().toLowerCase();
  if (ids.length === 0 || !cleanTag) return { ok: true as const, count: 0 };
  await db.execute(sql`
    UPDATE tracked_products
    SET tags = ARRAY_REMOVE(tags, ${cleanTag})
    WHERE id IN (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
  `);
  revalidatePath("/dashboard");
  return { ok: true as const, count: ids.length };
}

// ─── Manual crawl trigger ──────────────────────────────────────────────

export async function runCrawlNow() {
  if (!(await isAuthed())) redirect("/login");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { ok: false, error: "CRON_SECRET not set" } as const;
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/crawl/dispatch`, {
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
