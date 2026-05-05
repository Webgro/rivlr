"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray, and } from "drizzle-orm";
import { requireUser, getCurrentUser } from "@/lib/auth/current-user";
import { dispatchCrawl } from "@/lib/crawler/dispatch";
import { discoverNewProducts } from "@/lib/crawler/discover";

export async function trackDiscovered(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [d] = await db
    .select()
    .from(schema.discoveredProducts)
    .where(
      and(
        eq(schema.discoveredProducts.id, id),
        eq(schema.discoveredProducts.userId, user.id),
      ),
    )
    .limit(1);
  if (!d) return;

  await db
    .insert(schema.trackedProducts)
    .values({
      userId: user.id,
      url: d.url,
      handle: d.handle,
      storeDomain: d.storeDomain,
      title: d.title,
      imageUrl: d.imageUrl,
    })
    .onConflictDoNothing();

  await db
    .delete(schema.discoveredProducts)
    .where(
      and(
        eq(schema.discoveredProducts.id, id),
        eq(schema.discoveredProducts.userId, user.id),
      ),
    );

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
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.discoveredProducts)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(schema.discoveredProducts.id, id),
        eq(schema.discoveredProducts.userId, user.id),
      ),
    );
  revalidatePath("/discover");
}

export async function bulkTrackDiscovered(ids: string[]) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };

  const found = await db
    .select()
    .from(schema.discoveredProducts)
    .where(
      and(
        inArray(schema.discoveredProducts.id, ids),
        eq(schema.discoveredProducts.userId, user.id),
      ),
    );

  if (found.length === 0) return { ok: true as const, count: 0 };

  await db
    .insert(schema.trackedProducts)
    .values(
      found.map((d) => ({
        userId: user.id,
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
    .where(
      and(
        inArray(schema.discoveredProducts.id, ids),
        eq(schema.discoveredProducts.userId, user.id),
      ),
    );

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
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "unauthorized" };
  if (ids.length === 0) return { ok: true as const, count: 0 };
  await db
    .update(schema.discoveredProducts)
    .set({ status: "dismissed" })
    .where(
      and(
        inArray(schema.discoveredProducts.id, ids),
        eq(schema.discoveredProducts.userId, user.id),
      ),
    );
  revalidatePath("/discover");
  return { ok: true as const, count: ids.length };
}

export async function runDiscoveryNow() {
  await requireUser();
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
