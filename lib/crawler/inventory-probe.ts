import { db, schema } from "@/lib/db";
import { eq, and, isNull, or, lt, sql } from "drizzle-orm";
import { probeVariantInventory } from "./cart-probe";
import { type Market } from "./shopify";

/**
 * Daily inventory-probe orchestrator. Runs alongside the existing 05:30 UTC
 * store-scan + multi-market scan from /api/crawl/stores.
 *
 * For each active product:
 *   1. Skip if cart_probe_enabled is off in settings.
 *   2. Skip if the product's store has a cart_probe_blocked_at within the
 *      last 7 days (back-off from 403/429).
 *   3. Skip if last_inventory_probed_at is < 22h old.
 *   4. Skip products where inventory is already public — no point probing
 *      what we already know.
 *   5. Probe each variant in variantsSnapshot up to MAX_VARIANTS_PER_PRODUCT.
 *      Sum the exact quantities; treat 'soldout' as 0; 'unbounded' / 'unknown'
 *      drops out of the sum (we can't be sure).
 *   6. Write a fresh stock_observation with quantitySource='probed'.
 *
 * Polite pacing: 5s gap per store, 1.5s gap between variants of the same
 * product. We're tolerant of slow stores — the cron has a 300s budget and
 * if we don't finish today's batch, tomorrow's run picks up the laggards
 * (queries naturally re-prioritise via lastInventoryProbedAt asc).
 */

const PER_STORE_GAP_MS = 5_000;
const PER_VARIANT_GAP_MS = 1_500;
const MAX_VARIANTS_PER_PRODUCT = 8;
const PROBE_COOLDOWN_MS = 22 * 60 * 60 * 1000;
const STORE_BLOCK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BUDGET_MS = 240_000; // 4 min — leaves headroom inside the 300s function budget.

interface ProbeBatchResult {
  considered: number;
  probed: number;
  exact: number;
  blocked: number;
  skipped: number;
  failed: number;
}

export async function probeInventoryAcrossActive(): Promise<ProbeBatchResult> {
  // Global on/off.
  const [settings] = await db
    .select({ enabled: schema.appSettings.cartProbeEnabled })
    .from(schema.appSettings)
    .limit(1);
  if (settings && settings.enabled === false) {
    return { considered: 0, probed: 0, exact: 0, blocked: 0, skipped: 0, failed: 0 };
  }

  const cooldownCutoff = new Date(Date.now() - PROBE_COOLDOWN_MS);
  const blockCutoff = new Date(Date.now() - STORE_BLOCK_COOLDOWN_MS);

  // Candidates: active, never-probed OR probed >22h ago, and have a variants
  // snapshot to work with. We deliberately probe even where inventory IS
  // public — the cost is negligible and it acts as a sanity check; in
  // practice this is uncommon (most public-quantity stores expose it
  // through .js).
  //
  // Filter out products on stores that hit the bot-protection backoff.
  const candidates = await db.execute<{
    id: string;
    store_domain: string;
    variants_snapshot: Array<{ id: string }>;
    market_country: string | null;
    market_currency: string | null;
  }>(sql`
    SELECT
      p.id, p.store_domain, p.variants_snapshot,
      p.market_country, p.market_currency
    FROM tracked_products p
    LEFT JOIN stores s ON s.domain = p.store_domain
    WHERE p.active = true
      AND jsonb_array_length(p.variants_snapshot) > 0
      AND (p.last_inventory_probed_at IS NULL OR p.last_inventory_probed_at < ${cooldownCutoff})
      AND (s.cart_probe_blocked_at IS NULL OR s.cart_probe_blocked_at < ${blockCutoff})
    ORDER BY p.last_inventory_probed_at ASC NULLS FIRST
  `);

  const list = Array.from(candidates);
  const result: ProbeBatchResult = {
    considered: list.length,
    probed: 0,
    exact: 0,
    blocked: 0,
    skipped: 0,
    failed: 0,
  };

  if (list.length === 0) return result;

  const lastHitByStore = new Map<string, number>();
  const blockedDomains = new Set<string>();
  const startedAt = Date.now();

  for (const p of list) {
    if (Date.now() - startedAt > MAX_BUDGET_MS) {
      result.skipped += 1;
      continue;
    }
    if (blockedDomains.has(p.store_domain)) {
      result.skipped += 1;
      continue;
    }
    const variants = (p.variants_snapshot ?? []).slice(
      0,
      MAX_VARIANTS_PER_PRODUCT,
    );
    if (variants.length === 0) {
      result.skipped += 1;
      continue;
    }

    // Per-store throttle.
    const wait = Math.max(
      0,
      PER_STORE_GAP_MS -
        (Date.now() - (lastHitByStore.get(p.store_domain) ?? 0)),
    );
    if (wait > 0) await sleep(wait);
    lastHitByStore.set(p.store_domain, Date.now());

    const market: Market | null =
      p.market_country && p.market_currency
        ? { country: p.market_country, currency: p.market_currency }
        : null;

    let totalQty: number | null = 0;
    let anyExact = false;
    let anyBlocked = false;
    let anyAvailable = false;

    for (let i = 0; i < variants.length; i++) {
      if (i > 0) await sleep(PER_VARIANT_GAP_MS);
      const variant = variants[i];
      const probe = await probeVariantInventory(
        p.store_domain,
        variant.id,
        market,
      );

      if (probe.kind === "blocked") {
        anyBlocked = true;
        break;
      }
      if (probe.kind === "exact") {
        anyExact = true;
        anyAvailable = anyAvailable || probe.quantity > 0;
        if (totalQty !== null) totalQty += probe.quantity;
      } else if (probe.kind === "soldout") {
        // contributes 0 to total; no change.
      } else if (probe.kind === "unbounded") {
        // can't sum reliably — null out the total but mark available.
        anyAvailable = true;
        totalQty = null;
      } else {
        // unknown — also unsum.
        totalQty = null;
      }
    }

    if (anyBlocked) {
      // Mark store as blocked, skip remaining of its products this run.
      await db
        .insert(schema.stores)
        .values({ domain: p.store_domain, cartProbeBlockedAt: new Date() })
        .onConflictDoUpdate({
          target: schema.stores.domain,
          set: { cartProbeBlockedAt: new Date() },
        });
      blockedDomains.add(p.store_domain);
      result.blocked += 1;
      continue;
    }

    if (!anyExact && totalQty === null) {
      // Nothing useful — bump the probed-at timestamp anyway so we don't
      // hammer the same product again tomorrow expecting a different
      // result.
      await db
        .update(schema.trackedProducts)
        .set({ lastInventoryProbedAt: new Date() })
        .where(eq(schema.trackedProducts.id, p.id));
      result.failed += 1;
      continue;
    }

    // Write a fresh stock_observation with the probed quantity.
    await db.insert(schema.stockObservations).values({
      productId: p.id,
      available: anyAvailable || (totalQty !== null && totalQty > 0),
      quantity: totalQty,
      quantitySource: "probed",
    });

    await db
      .update(schema.trackedProducts)
      .set({ lastInventoryProbedAt: new Date() })
      .where(eq(schema.trackedProducts.id, p.id));

    result.probed += 1;
    if (anyExact) result.exact += 1;
  }

  return result;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Re-export so the schema-aware bits keep their shape.
export { eq, and, isNull, or, lt };
