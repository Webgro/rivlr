"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import { getProductQuota } from "@/lib/plan";
import { crawlProductOnce } from "@/lib/crawler/dispatch";
import { inferMarketFromDomain } from "@/lib/crawler/shopify";

/**
 * Track competitor products that we already know match one of the user's
 * own, and link them in the same step.
 *
 * The linking is the point. Tracking and linking used to be two separate
 * chores, and the second one never got done: the suggestion queue sits
 * at hundreds pending against a handful accepted. Here the match is
 * already known at the moment of tracking, so the group is set as the
 * row is written and the price comparison works immediately.
 */
export async function trackMatchedProducts(
  pairs: Array<{ discoveredId: string; myProductId: string }>,
): Promise<{ ok: boolean; tracked: number; error?: string }> {
  const user = await requireUser();
  if (pairs.length === 0) return { ok: true, tracked: 0 };

  // Plan limit applies exactly as it does anywhere else.
  const quota = await getProductQuota(user.id);
  let toAdd = pairs;
  if (quota.limit !== null) {
    const capacity = Math.max(0, quota.limit - quota.current);
    if (capacity === 0) {
      return {
        ok: false,
        tracked: 0,
        error: `You're at your plan's limit of ${quota.limit} products. Upgrade or remove some to track more.`,
      };
    }
    toAdd = pairs.slice(0, capacity);
  }

  const discovered = await db
    .select()
    .from(schema.discoveredProducts)
    .where(
      and(
        eq(schema.discoveredProducts.userId, user.id),
        inArray(
          schema.discoveredProducts.id,
          toAdd.map((p) => p.discoveredId),
        ),
      ),
    );
  if (discovered.length === 0) return { ok: true, tracked: 0 };

  const myIds = Array.from(new Set(toAdd.map((p) => p.myProductId)));
  const mine = await db
    .select({
      id: schema.trackedProducts.id,
      groupId: schema.trackedProducts.groupId,
      title: schema.trackedProducts.title,
      handle: schema.trackedProducts.handle,
    })
    .from(schema.trackedProducts)
    .where(
      and(
        eq(schema.trackedProducts.userId, user.id),
        inArray(schema.trackedProducts.id, myIds),
      ),
    );
  const myById = new Map(mine.map((m) => [m.id, m]));

  // Each of the user's products needs a group before we can attach a
  // competitor to it. Products that are already in one keep it, so
  // tracking a second competitor for the same item joins the existing
  // group rather than starting a rival one.
  const groupIdByMyProduct = new Map<string, string>();
  for (const m of mine) {
    if (m.groupId) {
      groupIdByMyProduct.set(m.id, m.groupId);
      continue;
    }
    const [group] = await db
      .insert(schema.productGroups)
      .values({ userId: user.id, name: m.title ?? m.handle })
      .returning({ id: schema.productGroups.id });
    await db
      .update(schema.trackedProducts)
      .set({ groupId: group.id })
      .where(
        and(
          eq(schema.trackedProducts.id, m.id),
          eq(schema.trackedProducts.userId, user.id),
        ),
      );
    groupIdByMyProduct.set(m.id, group.id);
  }

  const pairByDiscovered = new Map(
    toAdd.map((p) => [p.discoveredId, p.myProductId]),
  );

  const rows = discovered
    .map((d) => {
      const myProductId = pairByDiscovered.get(d.id);
      if (!myProductId || !myById.has(myProductId)) return null;
      const market = inferMarketFromDomain(d.storeDomain);
      return {
        userId: user.id,
        groupId: groupIdByMyProduct.get(myProductId) ?? null,
        url: d.url,
        handle: d.handle,
        storeDomain: d.storeDomain,
        title: d.title,
        imageUrl: d.imageUrl,
        skus: d.skus,
        // Carry the catalogue reading straight over so the comparison
        // has numbers before the first individual check lands.
        latestPrice: d.price,
        latestAvailable: d.available,
        latestObservedAt: d.price !== null ? new Date() : null,
        currency: market.currency,
        marketCountry: market.country,
        marketCurrency: market.currency,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return { ok: true, tracked: 0 };

  const inserted = await db
    .insert(schema.trackedProducts)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: schema.trackedProducts.id });

  // Clear them out of the discovery queue so they don't get offered again.
  await db.delete(schema.discoveredProducts).where(
    and(
      eq(schema.discoveredProducts.userId, user.id),
      inArray(
        schema.discoveredProducts.id,
        discovered.map((d) => d.id),
      ),
    ),
  );

  after(async () => {
    // Crawl exactly what was just added, rather than running a global
    // dispatch. A dispatch sweeps every tenant's due products, up to
    // 450 of them at a second apiece, which is wildly out of proportion
    // to a click that added five and kept the whole flow waiting on it.
    // These rows already carry a price from the catalogue scan, so this
    // is topping up stock detail, not filling a blank.
    for (const row of inserted) {
      try {
        await crawlProductOnce(row.id);
      } catch {
        // The hourly cron picks up anything missed.
      }
    }
  });

  revalidatePath("/products");
  revalidatePath("/my-products");
  revalidatePath("/dashboard");
  revalidatePath("/discover");

  return { ok: true, tracked: rows.length };
}
