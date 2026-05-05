import { NextResponse } from "next/server";
import { scanAllStores } from "@/lib/crawler/store-scan";
import { scanMultiMarketPrices } from "@/lib/crawler/multi-market";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily 05:30 UTC scan cron. Two passes:
 *   1. scanAllStores — store-level intel (apps, theme, catalogue size,
 *      free-shipping, stockout count, snapshots).
 *   2. scanMultiMarketPrices — per-product price/stock under configured
 *      markets. Powers the "Across markets" panel on product detail.
 *
 * The cart-probe inventory pass used to live here too but it was being
 * starved of runtime by the multi-market scan eating the full 300s
 * budget on stores with many products. It now runs in its own dedicated
 * cron at /api/cron/inventory at 06:30 UTC.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const stores = await scanAllStores();
  const multiMarket = await scanMultiMarketPrices();
  return NextResponse.json({ stores, multiMarket });
}
