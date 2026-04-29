import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, isNull, lt, or, and } from "drizzle-orm";

/**
 * Cron entry. Triggered every 5 minutes (vercel.json) to drain the crawl
 * queue gradually. Strategy:
 *
 *   1. Pick up to MAX_PRODUCTS_PER_DISPATCH active products that need a
 *      crawl (last_crawled_at older than 23h, or never crawled).
 *   2. Insert pending crawl_jobs rows for them.
 *   3. Fan out to /api/crawl/run in BATCH_SIZE chunks, fired in PARALLEL
 *      and awaited so all batches complete before the dispatch returns.
 *      This guarantees the work actually happens — fire-and-forget HTTP
 *      from a Vercel function does NOT survive past function termination.
 *
 * Each cron run processes ~MAX_PRODUCTS_PER_DISPATCH products. With 5-min
 * cron that's enough headroom for ~14k products/day.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */

const BATCH_SIZE = 10;
const PARALLEL_BATCHES = 5; // 5 × 10 = 50 products per dispatch invocation
const MAX_PRODUCTS_PER_DISPATCH = BATCH_SIZE * PARALLEL_BATCHES;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 23 * 60 * 60 * 1000);
  const force = new URL(request.url).searchParams.get("force") === "1";

  // Pick up to N products needing a crawl. Subsequent cron runs pick up
  // whatever is left.
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
    return NextResponse.json({ scheduled: 0, batches: 0, processed: 0 });
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

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : new URL(request.url).origin;

  // Run all batches in parallel. Each batch is its own /api/crawl/run
  // invocation (separate function on Vercel) so they execute concurrently.
  // We AWAIT so dispatch only returns once they're done — no fire-and-forget.
  const results = await Promise.allSettled(
    batches.map((jobIds) =>
      fetch(`${baseUrl}/api/crawl/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ jobIds }),
      }).then((r) => r.json()),
    ),
  );

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - ok;

  return NextResponse.json({
    scheduled: jobs.length,
    batches: batches.length,
    processed: ok,
    failed,
  });
}
