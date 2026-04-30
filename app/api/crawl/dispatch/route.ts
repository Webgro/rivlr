import { NextResponse } from "next/server";
import { dispatchCrawl } from "@/lib/crawler/dispatch";

export const dynamic = "force-dynamic";
// Pro plan allows up to 800s; 300 is plenty for a 200-product dispatch even
// with stores that respond slowly.
export const maxDuration = 300;

/**
 * Cron entry — Vercel Cron sends Authorization: Bearer ${CRON_SECRET}.
 * The actual work lives in lib/crawler/dispatch.ts so it can also be
 * called directly from server actions without an HTTP roundtrip.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("force") === "1";
  const result = await dispatchCrawl({ force });
  return NextResponse.json(result);
}
