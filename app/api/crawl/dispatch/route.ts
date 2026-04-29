import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, isNull, lt, or, and } from "drizzle-orm";

/**
 * Vercel Cron entry point. Runs daily at 04:00 GMT.
 *
 * Strategy:
 *   1. Find all active products that haven't been crawled in the last 23h
 *      (or never crawled).
 *   2. Insert pending crawl_jobs rows for them.
 *   3. Fan out to /api/crawl/run in batches of 20 via fire-and-forget fetch.
 *      Each batch invocation completes within ~30s.
 *
 * Auth: Vercel Cron sends Authorization: Bearer $CRON_SECRET. We also accept
 * manual triggering with the same header for testing.
 */

// Smaller batches stay comfortably under Vercel's 60s function limit even
// when a worker hits stores with slow response times. 10 × ~2s = ~20s.
const BATCH_SIZE = 10;

export async function GET(request: Request) {
  // Auth check — Vercel Cron sends this header automatically.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 23 * 60 * 60 * 1000); // 23h ago
  const force = new URL(request.url).searchParams.get("force") === "1";

  // Active products needing a crawl.
  // ?force=1 re-crawls everything regardless of last_crawled_at — used after
  // schema or crawler changes to refresh stale data.
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
    );

  if (due.length === 0) {
    return NextResponse.json({ scheduled: 0, batches: 0 });
  }

  // Insert pending jobs.
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

  // Batch up + fan out.
  const batches: string[][] = [];
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE).map((j) => j.id));
  }

  const baseUrl =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : new URL(request.url).origin;

  // Fire and forget. We don't await — each batch runs as its own invocation.
  for (const jobIds of batches) {
    fetch(`${baseUrl}/api/crawl/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ jobIds }),
    }).catch(() => {
      // Swallow — failed batches are detected via stale 'pending' jobs in
      // the next cron run.
    });
  }

  return NextResponse.json({
    scheduled: jobs.length,
    batches: batches.length,
  });
}
