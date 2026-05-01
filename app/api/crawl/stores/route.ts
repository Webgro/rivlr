import { NextResponse } from "next/server";
import { scanAllStores } from "@/lib/crawler/store-scan";
import { scanMultiMarketPrices } from "@/lib/crawler/multi-market";
import { probeInventoryAcrossActive } from "@/lib/crawler/inventory-probe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily 05:30 UTC scan cron. Three passes:
 *   1. scanAllStores — store-level intel (apps, theme, catalogue size,
 *      free-shipping, stockout count, snapshots).
 *   2. scanMultiMarketPrices — per-product price/stock under configured
 *      markets. Powers the "Across markets" panel on product detail.
 *   3. probeInventoryAcrossActive — cart-add probe for exact inventory
 *      on products where the public endpoints don't expose quantity.
 *      Polite, opt-outable, store-level back-off on bot-protection 4xx.
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
  const inventoryProbe = await probeInventoryAcrossActive();
  return NextResponse.json({ stores, multiMarket, inventoryProbe });
}
