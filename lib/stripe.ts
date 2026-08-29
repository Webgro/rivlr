import Stripe from "stripe";
import {
  MAX_OVERAGE_PACKS,
  PRODUCTS_PER_OVERAGE_PACK,
} from "./pricing";

/**
 * Stripe client singleton + price-id lookup.
 *
 * The client is null when STRIPE_SECRET_KEY isn't set (e.g. local dev
 * without billing configured) so the rest of the app can keep building.
 * Code that actually needs Stripe must guard via `isStripeConfigured()`
 * and fail with a clear error rather than crashing on import.
 */

const apiKey = process.env.STRIPE_SECRET_KEY;

export const stripe: Stripe | null = apiKey
  ? new Stripe(apiKey, {
      // Pin the API version so Stripe doesn't auto-roll us onto a new
      // schema mid-flight. Bump deliberately when upgrading the SDK.
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
      appInfo: {
        name: "Rivlr",
        url: "https://rivlr.app",
      },
    })
  : null;

/**
 * Price IDs for each paid tier + the Scale extra-pack SKU. NULL when the env var
 * is missing — the /billing page will hide the corresponding control
 * to keep the UI honest.
 *
 * `scaleOverage` is the Scale extra pack (1 pack = +100 products, £10
 * a month). Only Scale carries packs; Starter and Growth buyers move
 * up a tier rather than buying volume at the small-plan price.
 */
export const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER ?? null,
  growth: process.env.STRIPE_PRICE_GROWTH ?? null,
  scale: process.env.STRIPE_PRICE_SCALE ?? null,
  scaleOverage: process.env.STRIPE_PRICE_SCALE_OVERAGE ?? null,
} as const;

export type PaidPlan = "starter" | "growth" | "scale";

// Pack sizing and ceiling live in lib/pricing.ts (no imports, safe for
// client components). Re-exported here so billing code can keep taking
// everything Stripe-related from one module.
export { MAX_OVERAGE_PACKS, PRODUCTS_PER_OVERAGE_PACK };

export function isStripeConfigured(): boolean {
  return (
    !!stripe &&
    !!PRICE_IDS.starter &&
    !!PRICE_IDS.growth &&
    !!PRICE_IDS.scale
  );
}

/**
 * True only when the overage SKU is also configured. /billing falls back
 * to a "coming soon" pill on the overage control if this is false.
 */
export function isOverageConfigured(): boolean {
  return isStripeConfigured() && !!PRICE_IDS.scaleOverage;
}

/**
 * Map a Stripe Price ID back to our internal plan name. Used by the
 * webhook handler to translate subscription items into our plan
 * column. Overage packs return null (they're not a tier change).
 */
export function planFromPriceId(priceId: string): PaidPlan | null {
  if (priceId === PRICE_IDS.starter) return "starter";
  if (priceId === PRICE_IDS.growth) return "growth";
  if (priceId === PRICE_IDS.scale) return "scale";
  return null;
}

/** True when this Price ID is an overage SKU (so the webhook handler
 *  knows to read its quantity into subscriptions.overage_packs rather
 *  than treating it as the base plan price). */
export function isOveragePriceId(priceId: string): boolean {
  return priceId === PRICE_IDS.scaleOverage;
}
