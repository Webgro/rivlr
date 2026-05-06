import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/current-user";
import { isStripeConfigured } from "@/lib/stripe";
import { cancelAtPeriodEnd } from "@/lib/billing";

/**
 * POST /api/billing/cancel
 *
 * Schedule cancellation at the end of the current billing cycle. The
 * user keeps full access until the period ends; on Stripe's side,
 * cancel_at_period_end goes true. Webhook reconciles cancelAtPeriodEnd
 * on the DB row.
 *
 * Reversible via /api/billing/resume while there's still time.
 */
export async function POST() {
  const user = await requireUser();
  if (!isStripeConfigured()) {
    return new NextResponse("Billing not configured.", { status: 503 });
  }

  try {
    await cancelAtPeriodEnd(user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cancellation failed.";
    const origin = await getOrigin();
    return NextResponse.redirect(
      `${origin}/billing?reason=cancel-failed&message=${encodeURIComponent(msg)}`,
      { status: 303 },
    );
  }

  const origin = await getOrigin();
  return NextResponse.redirect(`${origin}/billing?status=canceling`, {
    status: 303,
  });
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  return `${proto}://${host}`;
}
