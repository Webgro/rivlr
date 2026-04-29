"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";

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
  await db.delete(schema.trackedProducts).where(eq(schema.trackedProducts.id, id));
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * Manual "Run crawl now" — triggers the dispatcher synchronously so the
 * dashboard reflects fresh data immediately. Auth via the session cookie
 * (not CRON_SECRET) since this is initiated by the owner from the UI.
 */
export async function runCrawlNow() {
  if (!(await isAuthed())) redirect("/login");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { ok: false, error: "CRON_SECRET not set" } as const;
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  // Hit dispatch endpoint with the cron secret. We DON'T await the eventual
  // batch runs — the dispatch returns once jobs are scheduled and batches
  // are fired off. Dashboard refresh will pick up new observations.
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
