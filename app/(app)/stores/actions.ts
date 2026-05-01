"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, ne, and, sql } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";
import { scanBestsellerCollections } from "@/lib/crawler/store-scan";

/**
 * Mark a store as the user's own. Only one store can be flagged at a time
 * — assigning a new one clears the flag on any other. Triggers an
 * immediate best-seller collection probe so the /opportunities view has
 * useful data on first navigation rather than waiting for the daily cron.
 */
export async function markStoreAsMine(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;

  // Singleton flag. Clear all others first.
  await db
    .update(schema.stores)
    .set({ isMyStore: false })
    .where(and(eq(schema.stores.isMyStore, true), ne(schema.stores.domain, domain)));

  // Reset is_bestseller on every other store's products — a flag set when
  // that store WAS marked as mine doesn't apply now.
  await db.execute(sql`
    UPDATE tracked_products
       SET is_bestseller = false
     WHERE store_domain != ${domain}
       AND is_bestseller = true
  `);

  // Upsert ownership for this store.
  await db
    .insert(schema.stores)
    .values({ domain, isMyStore: true })
    .onConflictDoUpdate({
      target: schema.stores.domain,
      set: { isMyStore: true },
    });

  // Fire the best-seller probe AFTER the response — it hits up to 11
  // collection URLs sequentially, which made the click-to-redirect feel
  // sluggish (~5–8s). after() lets the redirect happen instantly while
  // the probe runs in the background. The daily cron is a safety net.
  after(async () => {
    try {
      await scanBestsellerCollections(domain);
      revalidatePath("/opportunities");
      revalidatePath(`/stores/${domain}`);
    } catch {
      // best effort
    }
  });

  revalidatePath("/stores");
  revalidatePath(`/stores/${domain}`);
  revalidatePath("/opportunities");
}

export async function unmarkMyStore(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!domain) return;
  await db
    .update(schema.stores)
    .set({ isMyStore: false })
    .where(eq(schema.stores.domain, domain));
  await db.execute(sql`
    UPDATE tracked_products
       SET is_bestseller = false
     WHERE store_domain = ${domain}
  `);
  revalidatePath("/stores");
  revalidatePath(`/stores/${domain}`);
  revalidatePath("/opportunities");
}
