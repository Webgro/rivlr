import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/current-user";
import { isStripeConfigured } from "@/lib/stripe";
import { createPortalSession } from "@/lib/billing";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for the current user and
 * 303-redirects them into it. The Portal handles plan changes, card
 * updates, invoice history, and cancellation — all on Stripe's hosted
 * pages, so card details never touch our servers.
 *
 * Requires the user to already have a Stripe customer record (i.e. they
 * went through Checkout at least once). Pre-Checkout users hitting this
 * endpoint get a clear 400 — the /billing UI gates the button so this
 * shouldn't happen, but we defend the API anyway.
 */
export async function POST(request: Request) {
  const user = await requireUser();

  if (!isStripeConfigured()) {
    return new NextResponse(
      "Billing is not configured on this deployment yet.",
      { status: 503 },
    );
  }

  if (!user.stripeCustomerId) {
    return new NextResponse(
      "No Stripe customer record yet — pick a plan first.",
      { status: 400 },
    );
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  const origin = `${proto}://${host}`;

  // Optional deep-link target. The /billing page uses these to land
  // the user directly on the right Portal step (e.g. card update)
  // rather than the Portal home page. Anything unrecognised falls
  // through to the home page.
  const formData = await request.formData().catch(() => null);
  const flowRaw = formData ? String(formData.get("flow") ?? "") : "";
  const flow =
    flowRaw === "update-card" || flowRaw === "invoices" ? flowRaw : undefined;

  const url = await createPortalSession({
    customerId: user.stripeCustomerId,
    returnUrl: `${origin}/billing`,
    flow,
  });

  return NextResponse.redirect(url, { status: 303 });
}
