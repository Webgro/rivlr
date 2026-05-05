import type Stripe from "stripe";
import { db, schema, type User } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe, PRICE_IDS, planFromPriceId, type PaidPlan } from "./stripe";

type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

/**
 * Stripe → our schema status mapping. Stripe's enum almost matches
 * ours; the only outlier is `paused` (rare; introduced for paused
 * subscription billing). We map it to past_due so entitlement drops
 * sensibly without enlarging our enum for a once-a-year code path.
 */
const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "incomplete_expired",
  unpaid: "unpaid",
  paused: "past_due",
};

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
 * Resolve a Stripe customer id back to our user. Falls back to the
 * subscription's metadata.userId when the user row doesn't have the
 * customer id stamped yet (unlikely but possible if a webhook races
 * the post-Checkout users.update).
 */
async function resolveUserFromStripe(
  customerId: string,
  fallbackUserId?: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.stripeCustomerId, customerId))
    .limit(1);
  if (row) return row;

  if (fallbackUserId) {
    const [byId] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, fallbackUserId))
      .limit(1);
    if (byId) {
      // Sync the customer id back so future events skip the fallback.
      await db
        .update(schema.users)
        .set({ stripeCustomerId: customerId })
        .where(eq(schema.users.id, byId.id));
      return byId;
    }
  }
  return null;
}

/**
 * Take a Stripe Subscription object and reconcile it into our
 * `subscriptions` table. Idempotent — safe to call repeatedly with
 * the same payload (Stripe redelivers events, sometimes out of order).
 *
 * Skips quietly when:
 *  - The subscription is on a price we don't recognise (e.g. legacy
 *    pricing). Logged so we notice in production.
 *  - We can't resolve the customer back to a user.
 */
export async function upsertSubscriptionFromStripe(
  sub: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const fallbackUserId = sub.metadata?.userId;
  const user = await resolveUserFromStripe(customerId, fallbackUserId);
  if (!user) {
    console.warn(
      `[stripe webhook] no user for customer ${customerId} on subscription ${sub.id}`,
    );
    return;
  }

  // First subscription item drives the plan. We don't currently support
  // multi-item subscriptions; if a future plan adds add-ons that'd
  // change here.
  const priceId = sub.items.data[0]?.price?.id;
  const plan: PaidPlan | null = priceId ? planFromPriceId(priceId) : null;
  if (!plan) {
    console.warn(
      `[stripe webhook] unknown price ${priceId} on subscription ${sub.id}`,
    );
    return;
  }

  const status = STATUS_MAP[sub.status];
  // Stripe's API shape: current_period_end is on subscription items in
  // newer versions, but the top-level shortcut field still exists for
  // backwards compatibility on single-item subscriptions.
  const periodEndUnix =
    // @ts-expect-error — present on single-item subs at top level
    sub.current_period_end ?? sub.items.data[0]?.current_period_end ?? null;
  const currentPeriodEnd =
    typeof periodEndUnix === "number" ? new Date(periodEndUnix * 1000) : null;

  await db
    .insert(schema.subscriptions)
    .values({
      userId: user.id,
      stripeSubscriptionId: sub.id,
      plan,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: schema.subscriptions.userId,
      set: {
        stripeSubscriptionId: sub.id,
        plan,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });
}

/**
 * Drop the local subscription row when Stripe says the subscription
 * has fully ended. Plan resolver will fall back to free on next request.
 */
export async function removeSubscriptionByStripeId(
  stripeSubscriptionId: string,
): Promise<void> {
  await db
    .delete(schema.subscriptions)
    .where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

/* ─── Webhook idempotency ─────────────────────────────────────────── */

export async function isStripeEventProcessed(
  eventId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.processedStripeEvents.id })
    .from(schema.processedStripeEvents)
    .where(eq(schema.processedStripeEvents.id, eventId))
    .limit(1);
  return !!row;
}

export async function markStripeEventProcessed(
  eventId: string,
  type: string,
): Promise<void> {
  await db
    .insert(schema.processedStripeEvents)
    .values({ id: eventId, type })
    .onConflictDoNothing();
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
