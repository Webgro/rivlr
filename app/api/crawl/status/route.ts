import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

/**
 * Polled by the dashboard's progress widget. Returns counts of crawl jobs
 * in each status (across all users — the crawler is shared infra) plus
 * how many of THIS user's products are still awaiting their first crawl.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
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

  // Own-store products are refreshed in bulk, never crawled one by one,
  // so their last_crawled_at stays null for good. Counting them here
  // would park the progress widget on "552 waiting" permanently.
  const [pendingFirstCrawl] = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM tracked_products tp
    WHERE tp.user_id = ${user.id}::uuid
      AND tp.last_crawled_at IS NULL
      AND tp.active = true
      AND NOT EXISTS (
        SELECT 1 FROM user_store_prefs usp
        WHERE usp.user_id = tp.user_id
          AND usp.domain = tp.store_domain
          AND usp.is_my_store = true
      )
  `);

  const c = counts[0] ?? { pending: 0, running: 0, ok: 0, failed: 0 };
  return NextResponse.json({
    ...c,
    pendingFirstCrawl: pendingFirstCrawl?.count ?? 0,
  });
}
