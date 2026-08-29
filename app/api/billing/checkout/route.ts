import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/current-user";
import { isStripeConfigured, type PaidPlan } from "@/lib/stripe";
import {
  createCheckoutSession,
  getOrCreateStripeCustomer,
} from "@/lib/billing";

/**
 * POST /api/billing/checkout
 *
 * Receives a target plan via form data, creates a Stripe Checkout
 * session for it, and 303-redirects the user to Stripe's hosted page.
 *
 * Form-driven (not JSON) so the /billing page can fire it from a plain
 * <form action="/api/billing/checkout"> — no client-side JS required for
 * the upgrade flow to work.
 */

const VALID_PLANS: PaidPlan[] = ["starter", "growth", "scale"];

export async function POST(request: Request) {
  const user = await requireUser();

  if (!isStripeConfigured()) {
    return new NextResponse(
      "Billing is not configured on this deployment yet.",
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const planRaw = String(formData.get("plan") ?? "");
  if (!VALID_PLANS.includes(planRaw as PaidPlan)) {
    return new NextResponse("Unknown plan.", { status: 400 });
  }
  const plan = planRaw as PaidPlan;

  // Build absolute success/cancel URLs from the incoming request so
  // local dev (localhost:3000) and prod (rivlr.app) Just Work.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  const origin = `${proto}://${host}`;

  const customerId = await getOrCreateStripeCustomer(user);
  const url = await createCheckoutSession({
    user,
    customerId,
    plan,
    successUrl: `${origin}/billing?status=success`,
    cancelUrl: `${origin}/billing?status=canceled`,
  });

  return NextResponse.redirect(url, { status: 303 });
}
