"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bulkDelete } from "../products/actions";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stop watching the selected rival listings.
 *
 * The ids arrive from the browser, so before anything is deleted they
 * are re-read here and any row that is not a rival — anything on a shop
 * the user has marked as their own — is dropped. That makes it
 * impossible for a hand-crafted request to take out the user's own
 * catalogue through this action.
 *
 * The delete itself is the Watchlist's bulkDelete: chunked, with the
 * heavy child tables cleared explicitly, which is what stopped a big
 * selection from timing out mid-cascade and crashing the page.
 */
export async function stopWatchingRivals(
  ids: string[],
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const clean = ids.filter((id) => UUID.test(id));
  if (clean.length === 0) return { ok: true, count: 0 };

  const rivals = await db.execute<{ id: string }>(sql`
    SELECT c.id
    FROM tracked_products c
    LEFT JOIN user_store_prefs own
      ON own.user_id = ${user.id}::uuid
     AND own.domain = c.store_domain
     AND own.is_my_store = true
    WHERE c.user_id = ${user.id}::uuid
      -- sql.param, not a bare array: drizzle expands a plain JS array in a
      -- SQL template into a placeholder list, which Postgres reads as a
      -- record and refuses to cast to uuid[].
      AND c.id = ANY(${sql.param(clean)}::uuid[])
      AND own.domain IS NULL
  `);

  const rivalIds = Array.from(rivals).map((r) => r.id);
  if (rivalIds.length === 0) return { ok: true, count: 0 };

  const result = await bulkDelete(rivalIds);
  revalidatePath("/stock");
  revalidatePath("/my-products");
  return result;
}
