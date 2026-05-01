import { NextResponse } from "next/server";
import { scanAllStores } from "@/lib/crawler/store-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily store-level scan cron. Hits each tracked store's `/`, /products.json,
 * /collections.json, /blogs.json. Populates `stores` + appends one row to
 * `store_snapshots` per store per day. Triggered by Vercel Cron at 05:30 GMT
 * (staggered after /api/crawl/discover at 05:00).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await scanAllStores();
  return NextResponse.json(result);
}
