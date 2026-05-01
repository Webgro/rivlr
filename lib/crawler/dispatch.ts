import { db, schema } from "@/lib/db";
import { eq, isNull, lt, or, and, inArray } from "drizzle-orm";
import {
  fetchShopifyProduct,
  fetchShopifyCurrency,
  fetchShopifyProductMeta,
  normaliseShopifyTags,
  scrapePdp,
  summariseProduct,
  penceToDecimal,
  type ShopifyProduct,
} from "./shopify";
import { sendAlertsForChange } from "./alerts";

/**
 * 24h cooldown for the richer-but-less-time-sensitive endpoints (meta JSON
 * and PDP scrape). Prevents doubling/tripling our request volume on every
 * hourly crawl while still keeping these fields fresh enough to act on.
 */
const META_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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

// Tuned for Vercel Pro (300s function budget, more concurrent invocations).
// 20 parallel batches × 10 products = 200 products per dispatch invocation.
// Combined with the every-5-min cron in vercel.json, that's ~57k crawls/day
// of capacity — comfortably above an hourly cadence on a few thousand
// products.
const BATCH_SIZE = 10;
const PARALLEL_BATCHES = 20;
const MAX_PRODUCTS_PER_DISPATCH = BATCH_SIZE * PARALLEL_BATCHES;
const PER_STORE_MS = 1000;
// Re-crawl any product older than this. 55min so the every-5-min cron will
// pick each product up at least once per hour.
const COOLDOWN_MS = 55 * 60 * 1000;
// Auto-pause a product after this many consecutive crawl failures so dead
// URLs (deleted competitor products) don't infinite-retry. User can manually
// resume from the detail page if it was a transient issue.
const AUTO_PAUSE_THRESHOLD = 3;

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
  const cutoff = new Date(now.getTime() - COOLDOWN_MS);

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
 * Crawl a single product right now, ignoring the cooldown. Used by the
 * per-product 'Crawl now' button on the detail page. Reuses the same
 * processBatch logic so observations, alerts, and variant snapshots all
 * fire correctly.
 */
export async function crawlProductOnce(
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [job] = await db
    .insert(schema.crawlJobs)
    .values({
      productId,
      scheduledFor: new Date(),
      status: "pending",
    })
    .returning({ id: schema.crawlJobs.id });
  const result = await processBatch([job.id]);
  if (result.ok > 0) return { ok: true };
  return { ok: false, error: "Crawl failed. See product detail for the last error message." };
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

      // Tier 1: refresh meta JSON if >24h stale (vendor, tags, type, etc.)
      const metaStale =
        !product.lastMetaCrawledAt ||
        Date.now() - new Date(product.lastMetaCrawledAt).getTime() >
          META_COOLDOWN_MS;
      const meta = metaStale
        ? await fetchShopifyProductMeta(product.storeDomain, product.handle)
        : null;

      // Tier 2: PDP scrape (JSON-LD + review widgets) if >24h stale.
      const pdpStale =
        !product.lastPdpCrawledAt ||
        Date.now() - new Date(product.lastPdpCrawledAt).getTime() >
          META_COOLDOWN_MS;
      const pdp = pdpStale
        ? await scrapePdp(product.storeDomain, product.handle)
        : null;

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

      // compare_at_price comes through .js — store latest, NULL when none.
      const compareAtPrice =
        typeof fetched.compare_at_price === "number" &&
        fetched.compare_at_price > 0
          ? penceToDecimal(fetched.compare_at_price)
          : null;

      await db
        .update(schema.trackedProducts)
        .set({
          title: snapshot.title,
          imageUrl: snapshot.imageUrl,
          description: snapshot.description,
          currency,
          variantsSnapshot,
          compareAtPrice,
          lastCrawledAt: new Date(),
          // Reset failure counter on success.
          consecutiveFailures: 0,
          autoPausedAt: null,
          lastError: null,
          // Tier 1 meta — only updated when we fetched it.
          ...(meta
            ? {
                shopifyTags: normaliseShopifyTags(meta.tags),
                vendor: meta.vendor ?? null,
                productType: meta.product_type ?? null,
                shopifyCreatedAt: meta.created_at
                  ? new Date(meta.created_at)
                  : null,
                shopifyUpdatedAt: meta.updated_at
                  ? new Date(meta.updated_at)
                  : null,
                imageCount: Array.isArray(meta.images) ? meta.images.length : 0,
                lastMetaCrawledAt: new Date(),
              }
            : {}),
          // Tier 2 PDP — only when we scraped.
          ...(pdp
            ? {
                gtin: pdp.gtin,
                mpn: pdp.mpn,
                brand: pdp.brand,
                reviewCount: pdp.reviewCount,
                reviewScore:
                  pdp.reviewScore !== null
                    ? pdp.reviewScore.toFixed(2)
                    : null,
                priceValidUntil: pdp.priceValidUntil,
                socialProofWidget: pdp.socialProofWidget,
                lastPdpCrawledAt: new Date(),
              }
            : {}),
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

      // Increment consecutive_failures; auto-pause if we've hit the threshold.
      const newFailures = product.consecutiveFailures + 1;
      const shouldPause = newFailures >= AUTO_PAUSE_THRESHOLD;
      await db
        .update(schema.trackedProducts)
        .set({
          lastCrawledAt: new Date(),
          consecutiveFailures: newFailures,
          lastError: message.slice(0, 500),
          ...(shouldPause
            ? { active: false, autoPausedAt: new Date() }
            : {}),
        })
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
