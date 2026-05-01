import { NextResponse } from "next/server";
import { scanAllStores } from "@/lib/crawler/store-scan";
import { scanMultiMarketPrices } from "@/lib/crawler/multi-market";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily 05:30 UTC scan cron. Two passes:
 *   1. scanAllStores — store-level intel (apps, theme, catalogue size,
 *      free-shipping, stockout count, snapshots).
 *   2. scanMultiMarketPrices — per-product price/stock under GB, IE, US,
 *      DE, AU, CA, JP markets. Powers the "Across markets" panel on
 *      product detail.
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
