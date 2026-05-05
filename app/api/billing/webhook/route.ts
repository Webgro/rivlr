import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  isStripeEventProcessed,
  markStripeEventProcessed,
  upsertSubscriptionFromStripe,
  removeSubscriptionByStripeId,
} from "@/lib/billing";

/**
 * POST /api/billing/webhook
 *
 * Stripe webhook receiver. Source of truth for subscription state:
 * Checkout doesn't update our DB — webhooks do, after Stripe confirms
 * the payment. Same for plan changes, cancellations, and failed
 * invoices.
 *
 * Three guarantees:
 *  1. Signature verification — every event is HMAC-checked against
 *     STRIPE_WEBHOOK_SECRET before any DB write.
 *  2. Idempotency — event ids are recorded in processed_stripe_events;
 *     redeliveries become no-ops.
 *  3. Retry-safe — handlers are upserts. If our DB call fails after
 *     the signature check, we return 5xx so Stripe retries. The next
 *     attempt re-runs the same upsert; result converges.
 *
 * Returning 2xx tells Stripe "got it, don't retry". Returning 4xx
 * during signature failure is correct — that event is malformed and
 * retrying won't help. Returning 5xx during a transient DB error is
 * what we want; Stripe will retry with exponential backoff up to ~3d.
 */

// Force the Node runtime — webhooks need raw body access for signature
// verification, which doesn't work cleanly on the Edge runtime in
// Next.js 16.
export const runtime = "nodejs";

// Don't run any caching/static logic on this route. It's strictly an
// in-flight RPC handler.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!stripe) {
    return new NextResponse("Stripe not configured.", { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("Webhook secret not set.", { status: 503 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse("Missing Stripe-Signature header.", {
      status: 400,
    });
  }

  // Stripe's constructEvent needs the raw, untouched request body.
  // request.text() returns it verbatim.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn("[stripe webhook] signature verification failed:", msg);
    return new NextResponse(`Signature verification failed: ${msg}`, {
      status: 400,
    });
  }

  // Idempotency — skip if we've already processed this event id. Cheap
  // single-row index lookup.
  if (await isStripeEventProcessed(event.id)) {
    return NextResponse.json({ received: true, alreadyProcessed: true });
  }

  try {
    await dispatch(event);
    await markStripeEventProcessed(event.id, event.type);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(
      `[stripe webhook] handler failed for ${event.type} (${event.id}):`,
      err,
    );
    // Don't mark processed — Stripe will retry, our handler is idempotent
    // so the next attempt converges.
    return new NextResponse("Handler failed.", { status: 500 });
  }
}

async function dispatch(event: Stripe.Event): Promise<void> {
  if (!stripe) return; // narrowed by caller, redundant for TS

  switch (event.type) {
    case "checkout.session.completed": {
      // First-time signup. The session contains a subscription id; fetch
      // the full subscription and reconcile.
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.subscription) return;
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      await upsertSubscriptionFromStripe(sub);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await upsertSubscriptionFromStripe(sub);
      return;
    }

    case "customer.subscription.deleted": {
      // Subscription has fully ended (cancellation took effect).
      const sub = event.data.object as Stripe.Subscription;
      await removeSubscriptionByStripeId(sub.id);
      return;
    }

    case "invoice.payment_failed": {
      // Subscription.updated fires too, but be defensive — re-fetch and
      // reconcile so the status flips to past_due even if the other
      // event didn't arrive yet.
      const invoice = event.data.object as Stripe.Invoice;
      // @ts-expect-error — present on subscription invoices
      const subRef = invoice.subscription;
      if (!subRef) return;
      const subId = typeof subRef === "string" ? subRef : subRef.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      await upsertSubscriptionFromStripe(sub);
      return;
    }

    default:
      // Other events arrive (we subscribe to a small set, but Stripe
      // sometimes sends related ones). Ignore quietly — the
      // markStripeEventProcessed call still records that we saw it.
      return;
  }
}
