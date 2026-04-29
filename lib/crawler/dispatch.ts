import { db, schema } from "@/lib/db";
import { eq, isNull, lt, or, and, inArray } from "drizzle-orm";
import {
  fetchShopifyProduct,
  fetchShopifyCurrency,
  summariseProduct,
  penceToDecimal,
  type ShopifyProduct,
} from "./shopify";
import { sendAlertsForChange } from "./alerts";

/**
 * In-process crawl dispatch. Replaces the old HTTP-fetch-fan-out approach
 * which was hitting 401s on Vercel's deployment-URL protection.
 *
 * This function:
 *  1. Picks up to MAX_PRODUCTS_PER_DISPATCH active products that need a crawl.
 *  2. Inserts pending crawl_jobs rows for them.
 *  3. Runs all batches CONCURRENTLY in the same Node process (no separate
 *     Vercel function invocations — just async tasks).
 *  4. Awaits all batches before returning.
 *
 * Concurrency: 5 parallel batches × 10 products = 50 products per call.
 * Each batch runs serially within itself with per-store throttling.
 *
 * I/O bound (network fetches), so concurrency is limited by per-store rate
 * limits, not CPU. Comfortably under the 60s function budget.
 */

const BATCH_SIZE = 10;
const PARALLEL_BATCHES = 5;
const MAX_PRODUCTS_PER_DISPATCH = BATCH_SIZE * PARALLEL_BATCHES;
const PER_STORE_MS = 1000;

interface DispatchResult {
  scheduled: number;
  processed: number;
  ok: number;
  failed: number;
}

export async function dispatchCrawl(opts: {
  force?: boolean;
}): Promise<DispatchResult> {
  const { force = false } = opts;
  const now = new Date();
  const cutoff = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  const due = await db
    .select({ id: schema.trackedProducts.id })
    .from(schema.trackedProducts)
    .where(
      force
        ? eq(schema.trackedProducts.active, true)
        : and(
            eq(schema.trackedProducts.active, true),
            or(
              isNull(schema.trackedProducts.lastCrawledAt),
              lt(schema.trackedProducts.lastCrawledAt, cutoff),
            ),
          ),
    )
    .limit(MAX_PRODUCTS_PER_DISPATCH);

  if (due.length === 0) {
    return { scheduled: 0, processed: 0, ok: 0, failed: 0 };
  }

  const jobs = await db
    .insert(schema.crawlJobs)
    .values(
      due.map((p) => ({
        productId: p.id,
        scheduledFor: now,
        status: "pending" as const,
      })),
    )
    .returning({ id: schema.crawlJobs.id });

  const batches: string[][] = [];
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE).map((j) => j.id));
  }

  const results = await Promise.all(batches.map((b) => processBatch(b)));

  const ok = results.reduce((s, r) => s + r.ok, 0);
  const failed = results.reduce((s, r) => s + r.failed, 0);

  return { scheduled: jobs.length, processed: ok + failed, ok, failed };
}

/**
 * Process one batch of crawl_jobs. Hits each product's /products/{handle}.js
 * endpoint with per-store throttling, writes observations, fires email alerts
 * for stock changes / price drops.
 */
async function processBatch(
  jobIds: string[],
): Promise<{ ok: number; failed: number }> {
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

  await db
    .update(schema.crawlJobs)
    .set({ status: "running", attemptedAt: new Date() })
    .where(inArray(schema.crawlJobs.id, jobIds));

  const lastHitByStore = new Map<string, number>();
  const currencyByStore = new Map<string, string>();
  let ok = 0;
  let failed = 0;

  for (const { job, product } of jobs) {
    try {
      const wait = Math.max(
        0,
        PER_STORE_MS -
          (Date.now() - (lastHitByStore.get(product.storeDomain) ?? 0)),
      );
      if (wait > 0) await sleep(wait);
      lastHitByStore.set(product.storeDomain, Date.now());

      let currency = currencyByStore.get(product.storeDomain);
      if (!currency) {
        try {
          currency = await fetchShopifyCurrency(product.storeDomain);
        } catch {
          currency = product.currency;
        }
        currencyByStore.set(product.storeDomain, currency);
      }

      const productJsUrl = `https://${product.storeDomain}/products/${product.handle}.js`;
      const fetched = await fetchShopifyProduct(productJsUrl);
      const snapshot = summariseProduct(fetched);

      // Pull previous latest observations for change detection.
      const [prevPrice] = await db
        .select({ price: schema.priceObservations.price })
        .from(schema.priceObservations)
        .where(eq(schema.priceObservations.productId, product.id))
        .orderBy(schema.priceObservations.observedAt)
        .limit(1);
      const [prevStock] = await db
        .select({
          available: schema.stockObservations.available,
          quantity: schema.stockObservations.quantity,
        })
        .from(schema.stockObservations)
        .where(eq(schema.stockObservations.productId, product.id))
        .orderBy(schema.stockObservations.observedAt)
        .limit(1);

      const newPrice = Number(penceToDecimal(snapshot.price));

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

      // Variant snapshot — overwrites the previous; we keep latest only for
      // now (history of variant prices = future feature).
      const variants = fetched.variants ?? [];
      const variantsSnapshot = variants.map((v) => ({
        id: String(v.id),
        title: v.title,
        price: typeof v.price === "string" ? Number(v.price) : v.price / 100,
        available: v.available,
        quantity:
          v.inventory_management === "shopify" &&
          typeof v.inventory_quantity === "number"
            ? v.inventory_quantity
            : null,
      }));

      await db
        .update(schema.trackedProducts)
        .set({
          title: snapshot.title,
          imageUrl: snapshot.imageUrl,
          currency,
          variantsSnapshot,
          lastCrawledAt: new Date(),
        })
        .where(eq(schema.trackedProducts.id, product.id));

      await db
        .update(schema.crawlJobs)
        .set({ status: "ok", completedAt: new Date() })
        .where(eq(schema.crawlJobs.id, job.id));

      // Fire alerts (best-effort — failures here don't fail the crawl).
      try {
        await sendAlertsForChange({
          product,
          previousPrice: prevPrice ? Number(prevPrice.price) : null,
          newPrice,
          previousAvailable: prevStock?.available ?? null,
          newAvailable: snapshot.available,
          currency,
        });
      } catch {
        // swallow
      }

      ok += 1;
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

      // Even on failure, set last_crawled_at so the 23h cooldown applies and
      // dead URLs don't infinite-retry.
      await db
        .update(schema.trackedProducts)
        .set({ lastCrawledAt: new Date() })
        .where(eq(schema.trackedProducts.id, product.id));

      failed += 1;
    }
  }

  return { ok, failed };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Re-export for tests / clarity. */
export type { ShopifyProduct };
