import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { sql, isNull } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Polled by the dashboard's progress widget. Returns counts of crawl jobs in
 * each status, plus how many products are still awaiting their first crawl
 * (last_crawled_at IS NULL). Cheap query — runs many times per second when
 * the widget is open.
 */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const counts = await db.execute<{
    pending: number;
    running: number;
    ok: number;
    failed: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'running')::int AS running,
      COUNT(*) FILTER (WHERE status = 'ok' AND completed_at >= NOW() - INTERVAL '15 minutes')::int AS ok,
      COUNT(*) FILTER (WHERE status = 'failed' AND completed_at >= NOW() - INTERVAL '15 minutes')::int AS failed
    FROM crawl_jobs
    WHERE scheduled_for >= NOW() - INTERVAL '1 hour'
  `);

  const [pendingFirstCrawl] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.trackedProducts)
    .where(isNull(schema.trackedProducts.lastCrawledAt));

  const c = counts[0] ?? { pending: 0, running: 0, ok: 0, failed: 0 };
  return NextResponse.json({
    ...c,
    pendingFirstCrawl: pendingFirstCrawl?.count ?? 0,
  });
}
