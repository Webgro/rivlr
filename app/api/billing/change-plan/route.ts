import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/current-user";
import { isStripeConfigured, type PaidPlan } from "@/lib/stripe";
import { changePlan } from "@/lib/billing";
import { getProductQuota, PLAN_FEATURES } from "@/lib/plan";

/**
 * POST /api/billing/change-plan
 *
 * In-app plan switch for an existing subscriber. Replaces the prior
 * "redirect to Stripe Checkout" flow for plan changes — Checkout is now
 * used only for first-time signups. Charges proration immediately
 * (always_invoice + error_if_incomplete).
 *
 * Downgrade safeguard: if the target plan can't fit the user's current
 * product count, we bounce them to /billing with a banner instead of
 * proceeding. Stripe doesn't enforce this — it's a Rivlr policy so we
 * never silently lose data.
 */
const VALID: PaidPlan[] = ["starter", "growth", "pro"];

export async function POST(request: Request) {
  const user = await requireUser();
  if (!isStripeConfigured()) {
    return new NextResponse("Billing not configured.", { status: 503 });
  }

  const formData = await request.formData();
  const planRaw = String(formData.get("plan") ?? "");
  if (!VALID.includes(planRaw as PaidPlan)) {
    return new NextResponse("Unknown plan.", { status: 400 });
  }
  const newPlan = planRaw as PaidPlan;

  // Downgrade gate. Compare current product count to the *base* limit
  // of the new plan (overage is only on Pro and the change strips
  // overage when leaving Pro, so base is the right comparison).
  const quota = await getProductQuota(user.id);
  const newBase = PLAN_FEATURES[newPlan].productLimit;
  if (newBase !== null && quota.current > newBase) {
    const origin = await getOrigin();
    return NextResponse.redirect(
      `${origin}/billing?reason=downgrade-blocked&current=${quota.current}&target=${newPlan}&limit=${newBase}`,
      { status: 303 },
    );
  }

  try {
    await changePlan({ userId: user.id, newPlan });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Plan change failed.";
    const origin = await getOrigin();
    return NextResponse.redirect(
      `${origin}/billing?reason=change-failed&message=${encodeURIComponent(msg)}`,
      { status: 303 },
    );
  }

  const origin = await getOrigin();
  return NextResponse.redirect(`${origin}/billing?status=plan-updated`, {
    status: 303,
  });
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  return `${proto}://${host}`;
}
