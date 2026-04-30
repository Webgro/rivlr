"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";
import { dispatchCrawl } from "@/lib/crawler/dispatch";
import { discoverNewProducts } from "@/lib/crawler/discover";

export async function trackDiscovered(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [d] = await db
    .select()
    .from(schema.discoveredProducts)
    .where(eq(schema.discoveredProducts.id, id))
    .limit(1);
  if (!d) return;

  await db
    .insert(schema.trackedProducts)
    .values({
      url: d.url,
      handle: d.handle,
      storeDomain: d.storeDomain,
      title: d.title,
      imageUrl: d.imageUrl,
    })
    .onConflictDoNothing();

  await db
    .delete(schema.discoveredProducts)
    .where(eq(schema.discoveredProducts.id, id));

  // Trigger a crawl in the background to populate price/stock immediately.
  after(async () => {
    try {
      await dispatchCrawl({});
    } catch {
      /* cron will pick up */
    }
  });

  revalidatePath("/discover");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function dismissDiscovered(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.discoveredProducts)
    .set({ status: "dismissed" })
    .where(eq(schema.discoveredProducts.id, id));
  revalidatePath("/discover");
}

export async function bulkTrackDiscovered(ids: string[]) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };

  const found = await db
    .select()
    .from(schema.discoveredProducts)
    .where(inArray(schema.discoveredProducts.id, ids));

  if (found.length === 0) return { ok: true as const, count: 0 };

  await db
    .insert(schema.trackedProducts)
    .values(
      found.map((d) => ({
        url: d.url,
        handle: d.handle,
        storeDomain: d.storeDomain,
        title: d.title,
        imageUrl: d.imageUrl,
      })),
    )
    .onConflictDoNothing();

  await db
    .delete(schema.discoveredProducts)
    .where(inArray(schema.discoveredProducts.id, ids));

  after(async () => {
    try {
      await dispatchCrawl({});
    } catch {
      /* cron will pick up */
    }
  });

  revalidatePath("/discover");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const, count: found.length };
}

export async function bulkDismissDiscovered(ids: string[]) {
  if (!(await isAuthed())) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.discoveredProducts)
    .set({ status: "dismissed" })
    .where(inArray(schema.discoveredProducts.id, ids));
  revalidatePath("/discover");
  return { ok: true as const, count: ids.length };
}

export async function runDiscoveryNow() {
  if (!(await isAuthed())) redirect("/login");
  // Run synchronously rather than via after() so the dashboard refresh
  // shows new findings immediately.
  try {
    const result = await discoverNewProducts();
    revalidatePath("/discover");
    return { ok: true as const, ...result };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
