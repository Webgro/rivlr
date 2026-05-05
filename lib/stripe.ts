import Stripe from "stripe";

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
 * Price IDs for each paid tier. NULL when the env var is missing — the
 * /billing page will hide the corresponding upgrade card to keep the UI
 * honest.
 */
export const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER ?? null,
  growth: process.env.STRIPE_PRICE_GROWTH ?? null,
  pro: process.env.STRIPE_PRICE_PRO ?? null,
} as const;

export type PaidPlan = "starter" | "growth" | "pro";

export function isStripeConfigured(): boolean {
  return (
    !!stripe &&
    !!PRICE_IDS.starter &&
    !!PRICE_IDS.growth &&
    !!PRICE_IDS.pro
  );
}

/**
 * Map a Stripe Price ID back to our internal plan name. Used by the
 * webhook handler in Stage 4 to translate subscription items into our
 * plan column.
 */
export function planFromPriceId(priceId: string): PaidPlan | null {
  if (priceId === PRICE_IDS.starter) return "starter";
  if (priceId === PRICE_IDS.growth) return "growth";
  if (priceId === PRICE_IDS.pro) return "pro";
  return null;
}
