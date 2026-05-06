import type Stripe from "stripe";
import { db, schema, type User } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  stripe,
  PRICE_IDS,
  planFromPriceId,
  isOveragePriceId,
  MAX_OVERAGE_PACKS,
  type PaidPlan,
} from "./stripe";

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

  // Walk the items: one is the base plan, optional second is overage.
  let plan: PaidPlan | null = null;
  let overagePacks = 0;
  for (const item of sub.items.data) {
    const priceId = item.price?.id;
    if (!priceId) continue;
    if (isOveragePriceId(priceId)) {
      overagePacks = item.quantity ?? 0;
    } else {
      const candidate = planFromPriceId(priceId);
      if (candidate) plan = candidate;
    }
  }
  if (!plan) {
    console.warn(
      `[stripe webhook] no recognised base price on subscription ${sub.id}`,
    );
    return;
  }
  // Defensive — overage on non-Pro shouldn't exist, but if Stripe
  // somehow has both we ignore the packs to keep our resolver safe.
  if (plan !== "pro") overagePacks = 0;

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
      overagePacks,
    })
    .onConflictDoUpdate({
      target: schema.subscriptions.userId,
      set: {
        stripeSubscriptionId: sub.id,
        plan,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        overagePacks,
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

/* ─── In-app subscription operations ──────────────────────────────── */

interface SubscriptionItems {
  baseItem: Stripe.SubscriptionItem | null;
  overageItem: Stripe.SubscriptionItem | null;
}

/** Find the base-plan and overage line items on a subscription. Returns
 *  nulls when missing — caller decides whether that's an error. */
function splitItems(sub: Stripe.Subscription): SubscriptionItems {
  let baseItem: Stripe.SubscriptionItem | null = null;
  let overageItem: Stripe.SubscriptionItem | null = null;
  for (const item of sub.items.data) {
    const id = item.price?.id;
    if (!id) continue;
    if (isOveragePriceId(id)) {
      overageItem = item;
    } else if (planFromPriceId(id)) {
      baseItem = item;
    }
  }
  return { baseItem, overageItem };
}

/** Load the user's persisted subscription row + the live Stripe
 *  subscription object. Throws if either is missing — billing actions
 *  always need both. */
async function loadStripeSub(userId: string): Promise<{
  stripeSub: Stripe.Subscription;
  row: typeof schema.subscriptions.$inferSelect;
}> {
  if (!stripe) throw new Error("Stripe is not configured.");
  const [row] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);
  if (!row?.stripeSubscriptionId) {
    throw new Error("No active subscription on this account.");
  }
  const stripeSub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
  return { stripeSub, row };
}

/**
 * In-app plan switch (upgrade or downgrade). Always invoices immediately
 * for the proration delta so the customer pays for what they're getting.
 *
 * Downgrade gating: if the target plan's effective limit is smaller than
 * the user's current product count, throws — the caller surfaces the
 * "remove products first" message.
 *
 * Drops any overage items when switching to a tier that doesn't sell
 * overage (Starter / Growth). Stripe credits the unused portion.
 */
export async function changePlan({
  userId,
  newPlan,
}: {
  userId: string;
  newPlan: PaidPlan;
}): Promise<void> {
  if (!stripe) throw new Error("Stripe is not configured.");
  const newPriceId = PRICE_IDS[newPlan];
  if (!newPriceId) {
    throw new Error(`Plan "${newPlan}" is not configured.`);
  }

  const { stripeSub, row } = await loadStripeSub(userId);
  const { baseItem, overageItem } = splitItems(stripeSub);
  if (!baseItem) {
    throw new Error("Subscription has no recognised base plan item.");
  }

  // No-op if they're already on this plan and no overage cleanup needed.
  if (row.plan === newPlan && !(newPlan !== "pro" && overageItem)) {
    return;
  }

  // Build the items update. Switch the base item's price; remove the
  // overage item if the new plan doesn't carry overage (everything but
  // Pro).
  const items: Stripe.SubscriptionUpdateParams.Item[] = [
    { id: baseItem.id, price: newPriceId },
  ];
  if (overageItem && newPlan !== "pro") {
    items.push({ id: overageItem.id, deleted: true });
  }

  await stripe.subscriptions.update(stripeSub.id, {
    items,
    // Pre-billed: invoice the proration delta immediately.
    proration_behavior: "always_invoice",
    // Surface failures fast — if the immediate proration invoice can't
    // be paid, error here instead of silently leaving the subscription
    // in an incomplete state.
    payment_behavior: "error_if_incomplete",
  });
  // Webhook will reconcile the DB row.
}

/**
 * Schedule a cancellation that takes effect at the end of the current
 * billing cycle. Customer keeps access until then; no immediate refund.
 */
export async function cancelAtPeriodEnd(userId: string): Promise<void> {
  if (!stripe) throw new Error("Stripe is not configured.");
  const { stripeSub } = await loadStripeSub(userId);
  await stripe.subscriptions.update(stripeSub.id, {
    cancel_at_period_end: true,
  });
}

/** Reverse a scheduled cancellation while there's still time. */
export async function resumeSubscription(userId: string): Promise<void> {
  if (!stripe) throw new Error("Stripe is not configured.");
  const { stripeSub } = await loadStripeSub(userId);
  if (!stripeSub.cancel_at_period_end) return;
  await stripe.subscriptions.update(stripeSub.id, {
    cancel_at_period_end: false,
  });
}

/**
 * Set the overage pack quantity on a Pro subscription. Pre-billed —
 * Stripe immediately invoices the prorated delta and charges the card.
 *
 * Throws when:
 *  - User isn't on Pro (overage not sold elsewhere).
 *  - Requested quantity exceeds MAX_OVERAGE_PACKS.
 *  - Pro overage Price ID isn't configured.
 */
export async function setOveragePacks({
  userId,
  packs,
}: {
  userId: string;
  packs: number;
}): Promise<void> {
  if (!stripe) throw new Error("Stripe is not configured.");
  const overagePriceId = PRICE_IDS.proOverage;
  if (!overagePriceId) {
    throw new Error("Pro overage SKU is not configured on this deployment.");
  }
  if (!Number.isInteger(packs) || packs < 0) {
    throw new Error("Pack count must be a non-negative integer.");
  }
  if (packs > MAX_OVERAGE_PACKS) {
    throw new Error(
      `Maximum ${MAX_OVERAGE_PACKS} packs per subscription. Email support to discuss higher allowances.`,
    );
  }

  const { stripeSub, row } = await loadStripeSub(userId);
  if (row.plan !== "pro") {
    throw new Error("Overage packs are only available on the Pro plan.");
  }

  const { overageItem } = splitItems(stripeSub);

  // Three transitions:
  //   - 0 → N: add a new overage item with quantity N.
  //   - N → 0: delete the existing overage item.
  //   - N → M (both > 0): update the existing item's quantity.
  let items: Stripe.SubscriptionUpdateParams.Item[];
  if (!overageItem && packs > 0) {
    items = [{ price: overagePriceId, quantity: packs }];
  } else if (overageItem && packs === 0) {
    items = [{ id: overageItem.id, deleted: true }];
  } else if (overageItem && packs !== overageItem.quantity) {
    items = [{ id: overageItem.id, quantity: packs }];
  } else {
    return; // no-op
  }

  await stripe.subscriptions.update(stripeSub.id, {
    items,
    proration_behavior: "always_invoice",
    payment_behavior: "error_if_incomplete",
  });
  // Webhook reconciles overage_packs in the DB.
}

/**
 * Read the user's default payment method as { brand, last4, expMonth,
 * expYear }. Returns null when no card is on file or the customer
 * hasn't been created yet. Used by the /billing UI to render a
 * read-only "Card: •••• 4242 12/29" line.
 */
export async function getDefaultPaymentMethod(
  customerId: string | null,
): Promise<{
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
} | null> {
  if (!stripe || !customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    const defaultPmId =
      typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id;
    if (!defaultPmId) return null;
    const pm = await stripe.paymentMethods.retrieve(defaultPmId);
    if (pm.type !== "card" || !pm.card) return null;
    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    };
  } catch {
    return null;
  }
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
 * subscription" page. With our hybrid billing model we use the Portal
 * only for the actions that need it (card update, invoice history) and
 * deep-link via `flow` so the customer lands directly on the right step
 * rather than the Portal home page.
 *
 * Configure once in the Stripe dashboard:
 *   Settings → Billing → Customer portal
 * (set allowed actions, business info, branding, return URL fallback).
 */
export async function createPortalSession({
  customerId,
  returnUrl,
  flow,
  subscriptionId,
}: {
  customerId: string;
  returnUrl: string;
  /** Deep-link to a specific Portal step rather than the landing page. */
  flow?: "update-card" | "invoices";
  /** Required when flow needs subscription context. */
  subscriptionId?: string | null;
}): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  let flowData:
    | Stripe.BillingPortal.SessionCreateParams["flow_data"]
    | undefined;
  if (flow === "update-card") {
    flowData = {
      type: "payment_method_update",
      after_completion: { type: "redirect", redirect: { return_url: returnUrl } },
    };
  }
  // No native "invoice list" flow type yet — we land them on the Portal
  // home with `subscription_cancel.subscription` unset; the invoices tab
  // is one click away. Future Stripe API versions may add this.

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    ...(flowData ? { flow_data: flowData } : {}),
  });
  if (!session.url) {
    throw new Error("Stripe Portal session created without a URL.");
  }
  // Touch subscriptionId so TS doesn't whinge about an unused param.
  void subscriptionId;
  return session.url;
}
