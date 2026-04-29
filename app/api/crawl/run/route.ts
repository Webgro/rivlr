import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import {
  fetchShopifyProduct,
  fetchShopifyCurrency,
  penceToDecimal,
  summariseProduct,
} from "@/lib/crawler/shopify";

/**
 * Worker endpoint — processes a batch of crawl_jobs IDs serially.
 *
 * Per-store politeness: throttle requests to the same store_domain to
 * 1 req/sec. Cheap and effective at this scale.
 */

export const maxDuration = 60; // Vercel Pro = 60s. We aim for ~30s/batch.

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { jobIds?: string[] }
    | null;
  const jobIds = body?.jobIds ?? [];
  if (jobIds.length === 0) {
    return NextResponse.json({ error: "no jobIds" }, { status: 400 });
  }

  // Load jobs + their products.
  const jobs = await db
    .select({
      job: schema.crawlJobs,
      product: schema.trackedProducts,
    })
    .from(schema.crawlJobs)
    .innerJoin(
      schema.trackedProducts,
      eq(schema.crawlJobs.productId, schema.trackedProducts.id),
    )
    .where(inArray(schema.crawlJobs.id, jobIds));

  // Mark all as running.
  await db
    .update(schema.crawlJobs)
    .set({ status: "running", attemptedAt: new Date() })
    .where(inArray(schema.crawlJobs.id, jobIds));

  const results: Array<{ jobId: string; ok: boolean; error?: string }> = [];
  const lastHitByStore = new Map<string, number>();
  // Re-detect currency once per store per batch — Shopify Markets stores
  // can flip currencies between crawls, so we don't trust the stored value.
  const currencyByStore = new Map<string, string>();

  for (const { job, product } of jobs) {
    try {
      // Per-store throttle — wait until 1s has elapsed since last hit.
      const now = Date.now();
      const last = lastHitByStore.get(product.storeDomain) ?? 0;
      const wait = Math.max(0, 1000 - (now - last));
      if (wait > 0) await sleep(wait);
      lastHitByStore.set(product.storeDomain, Date.now());

      // Refresh currency for this store (cached per-batch).
      let currency = currencyByStore.get(product.storeDomain);
      if (!currency) {
        try {
          currency = await fetchShopifyCurrency(product.storeDomain);
        } catch {
          currency = product.currency; // fall back to stored
        }
        currencyByStore.set(product.storeDomain, currency);
      }

      const productJsUrl = `https://${product.storeDomain}/products/${product.handle}.js`;
      const fetched = await fetchShopifyProduct(productJsUrl);
      const snapshot = summariseProduct(fetched);

      // Write observations.
      await db.insert(schema.priceObservations).values({
        productId: product.id,
        price: penceToDecimal(snapshot.price),
        currency,
      });
      await db.insert(schema.stockObservations).values({
        productId: product.id,
        available: snapshot.available,
        quantity: snapshot.quantity,
      });

      // Update product metadata + last_crawled_at + currency.
      await db
        .update(schema.trackedProducts)
        .set({
          title: snapshot.title,
          imageUrl: snapshot.imageUrl,
          currency,
          lastCrawledAt: new Date(),
        })
        .where(eq(schema.trackedProducts.id, product.id));

      // Mark job ok.
      await db
        .update(schema.crawlJobs)
        .set({ status: "ok", completedAt: new Date() })
        .where(eq(schema.crawlJobs.id, job.id));

      results.push({ jobId: job.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(schema.crawlJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          error: message.slice(0, 500),
          attempts: job.attempts + 1,
        })
        .where(eq(schema.crawlJobs.id, job.id));

      // Set last_crawled_at to NOW() even on failure so the dispatcher's 23h
      // cooldown applies — otherwise dead URLs queue up every cron run forever.
      // Will retry tomorrow; if it fails repeatedly the user can pause/delete.
      await db
        .update(schema.trackedProducts)
        .set({ lastCrawledAt: new Date() })
        .where(eq(schema.trackedProducts.id, product.id));

      results.push({ jobId: job.id, ok: false, error: message });
    }
  }

  return NextResponse.json({
    processed: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
