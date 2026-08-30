"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bulkDelete, bulkAddTags } from "../products/actions";

/**
 * Bulk actions for the Prices page.
 *
 * The rows on that page are the shop owner's OWN products. Those come
 * back from the overnight catalogue import for free, so nothing here
 * ever deletes one — re-importing them is not something the user should
 * have to think about, and losing one silently loses its price history
 * too. The only destructive action offered is removing the RIVAL
 * listings attached to a selected product, and the query below is the
 * single place that decides which rows those are.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stop watching the rival listings attached to the selected own-shop
 * products. `shop` narrows it to one rival shop, so the action matches
 * the filter the user is looking at rather than quietly reaching past it.
 *
 * Deletion itself is delegated to the Watchlist's bulkDelete: it chunks
 * the work and clears the heavy child tables explicitly, which is what
 * stopped a big selection from timing out mid-cascade and crashing the
 * page.
 */
export async function stopWatchingRivals(
  myProductIds: string[],
  shop?: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const ids = myProductIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return { ok: true, count: 0 };

  const rivals = await db.execute<{ id: string }>(sql`
    SELECT DISTINCT c.id
    FROM tracked_products mine
    -- Only start from products on a shop this user has marked as theirs.
    -- user_store_prefs.is_my_store is the per-user source of truth;
    -- stores.is_my_store is a stale global flag and is never read.
    JOIN user_store_prefs my_shop
      ON my_shop.user_id = ${user.id}::uuid
     AND my_shop.domain = mine.store_domain
     AND my_shop.is_my_store = true
    JOIN tracked_products c
      ON c.group_id = mine.group_id
     AND c.id <> mine.id
     AND c.user_id = ${user.id}::uuid
    -- ...and never a row on one of the user's own shops.
    LEFT JOIN user_store_prefs own
      ON own.user_id = ${user.id}::uuid
     AND own.domain = c.store_domain
     AND own.is_my_store = true
    WHERE mine.user_id = ${user.id}::uuid
      AND mine.group_id IS NOT NULL
      -- sql.param, not a bare array: drizzle expands a plain JS array in a
      -- SQL template into a placeholder list, which Postgres reads as a
      -- record and refuses to cast to uuid[].
      AND mine.id = ANY(${sql.param(ids)}::uuid[])
      AND own.domain IS NULL
      ${shop ? sql`AND c.store_domain = ${shop}` : sql.empty()}
  `);

  const rivalIds = Array.from(rivals).map((r) => r.id);
  if (rivalIds.length === 0) return { ok: true, count: 0 };

  const result = await bulkDelete(rivalIds);
  revalidatePath("/my-products");
  revalidatePath("/stock");
  return result;
}

/**
 * Add a tag to the selected own-shop products. Thin wrapper over the
 * Watchlist action so tagging behaves identically in both places (tags
 * must already exist on /tags); this only adds the Prices page to the
 * paths that get refreshed.
 */
export async function tagMyProducts(
  ids: string[],
  tag: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const result = await bulkAddTags(ids, tag);
  revalidatePath("/my-products");
  return result;
}
