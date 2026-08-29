/**
 * Pricing constants, in one place, with no imports.
 *
 * This module deliberately pulls in nothing: no database, no Stripe SDK.
 * Client components (the store-scan plan recommendation, the pack
 * picker) and server components (billing, the marketing page) both read
 * from here, so prices can never drift between what we advertise and
 * what we charge.
 *
 * Whole pounds throughout. No .99 pricing.
 */

/** Monthly price in GBP. Scale is the base only; packs are extra. */
export const PLAN_PRICE_GBP = {
  free: 0,
  starter: 19,
  growth: 29,
  scale: 49,
} as const;

/** Product allowance included in each plan's base price. */
export const PLAN_PRODUCTS = {
  free: 5,
  starter: 50,
  growth: 100,
  scale: 250,
} as const;

/** Monthly cost of one extra pack on Scale. */
export const PACK_PRICE_GBP = 10;

/** Products added by one pack. */
export const PRODUCTS_PER_OVERAGE_PACK = 100;

/**
 * Most packs a Scale subscription can carry. 23 packs on top of the
 * 250-product base gives a 2,550 ceiling, so the advertised 2,500 is
 * always reachable with a little headroom. Beyond this is a bespoke
 * conversation rather than a self-serve slider, partly for pricing and
 * partly because crawl volume per account has to stay bounded.
 */
export const MAX_OVERAGE_PACKS = 23;

/** Products included at the Scale base price. */
export const SCALE_BASE_PRODUCTS = PLAN_PRODUCTS.scale;

/** The Scale ceiling we advertise. Real cap is slightly above this. */
export const SCALE_ADVERTISED_MAX = 2500;

/** How many packs are needed to cover `total` products on Scale. */
export function packsNeededFor(total: number): number {
  if (total <= SCALE_BASE_PRODUCTS) return 0;
  return Math.ceil((total - SCALE_BASE_PRODUCTS) / PRODUCTS_PER_OVERAGE_PACK);
}

/** Monthly Scale cost in GBP for a given product count. */
export function scalePriceFor(total: number): number {
  return PLAN_PRICE_GBP.scale + packsNeededFor(total) * PACK_PRICE_GBP;
}
