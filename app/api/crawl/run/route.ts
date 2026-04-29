import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import {
  fetchShopifyProduct,
  penceToDecimal,
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

  for (const { job, product } of jobs) {
    try {
      // Per-store throttle — wait until 1s has elapsed since last hit.
      const now = Date.now();
      const last = lastHitByStore.get(product.storeDomain) ?? 0;
      const wait = Math.max(0, 1000 - (now - last));
      if (wait > 0) await sleep(wait);
      lastHitByStore.set(product.storeDomain, Date.now());

      const productJsUrl = `https://${product.storeDomain}/products/${product.handle}.js`;
      const fetched = await fetchShopifyProduct(productJsUrl);

      // Write observations.
      await db.insert(schema.priceObservations).values({
        productId: product.id,
        price: penceToDecimal(fetched.price),
        currency: "GBP", // TODO Phase 5: detect currency from store
      });
      await db.insert(schema.stockObservations).values({
        productId: product.id,
        available: fetched.available,
      });

      // Update product metadata + last_crawled_at.
      await db
        .update(schema.trackedProducts)
        .set({
          title: fetched.title,
          imageUrl: fetched.featured_image,
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
