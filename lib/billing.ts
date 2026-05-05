import { db, schema, type User } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe, PRICE_IDS, type PaidPlan } from "./stripe";

/**
 * Billing helpers — wraps the Stripe SDK calls used by Checkout, the
 * Customer Portal, and webhook reconciliation. Centralised so the
 * route handlers stay thin.
 */

/**
 * Returns the user's Stripe customer id, creating a Customer record on
 * first call. Stores the id back on the users row so subsequent calls
 * skip the API round-trip.
 */
export async function getOrCreateStripeCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  if (!stripe) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
  }

  const customer = await stripe.customers.create({
    email: user.email,
    // Stamp the user id so the webhook handler can resolve a Stripe
    // event back to a Rivlr user without an extra DB lookup.
    metadata: { userId: user.id },
  });

  await db
    .update(schema.users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(schema.users.id, user.id));

  return customer.id;
}

/**
 * Create a Checkout Session for a subscription upgrade. Returns the
 * hosted Checkout URL the caller should redirect the user to.
 */
export async function createCheckoutSession({
  user,
  customerId,
  plan,
  successUrl,
  cancelUrl,
}: {
  user: User;
  customerId: string;
  plan: PaidPlan;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }
  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    throw new Error(`Price ID for plan "${plan}" is not configured.`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    // Surface promo code field on the Checkout page — useful for early
    // adopter discounts without rewriting the page when one launches.
    allow_promotion_codes: true,
    // Both redirected back here. We don't trust the redirect to update
    // entitlement state — the webhook handler (Stage 4) is the source
    // of truth.
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Belt-and-braces: stamp the user id on the session itself in case
    // the customer record's metadata is missing for any reason.
    client_reference_id: user.id,
    metadata: { userId: user.id },
    subscription_data: {
      metadata: { userId: user.id },
    },
  });

  if (!session.url) {
    throw new Error("Stripe Checkout session created without a URL.");
  }
  return session.url;
}

/**
 * Create a Customer Portal session — Stripe's hosted "manage your
 * subscription" page where customers update their card, change plan,
 * download invoices, and cancel.
 *
 * Configure once in the Stripe dashboard:
 *   Settings → Billing → Customer portal
 * (set allowed actions, business info, branding, return URL fallback).
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  if (!session.url) {
    throw new Error("Stripe Portal session created without a URL.");
  }
  return session.url;
}
