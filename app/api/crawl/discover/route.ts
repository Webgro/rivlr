import { NextResponse } from "next/server";
import { discoverNewProducts } from "@/lib/crawler/discover";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily discovery cron. Triggered by Vercel Cron at 05:00 GMT (staggered
 * from the main /api/crawl/dispatch hourly job to avoid contention).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await discoverNewProducts();
  return NextResponse.json(result);
}
