import { NextResponse } from "next/server";
import { probeInventoryAcrossActive } from "@/lib/crawler/inventory-probe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily 06:30 UTC dedicated cron for the cart-probe inventory pass.
 * Originally chained behind /api/crawl/stores (store-scan + multi-market
 * scan + inventory probe in sequence) — but the multi-market scan is
 * O(products × markets × per-request-gap) and routinely consumed the
 * full 300s function budget, leaving the inventory probe with zero
 * runtime. Split out so it runs in its own function with its own budget.
 *
 * Schedule: 30 min after /api/crawl/stores so any cart_probe_blocked_at
 * flags from store-scan failures are visible by the time we run.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await probeInventoryAcrossActive();
  return NextResponse.json(result);
}
