import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/current-user";
import { isStripeConfigured } from "@/lib/stripe";
import { resumeSubscription } from "@/lib/billing";

/**
 * POST /api/billing/resume
 *
 * Reverse a scheduled cancellation. No-op when no cancellation is
 * pending. Useful for "wait, don't go" UX after a customer cancels and
 * has second thoughts before the period ends.
 */
export async function POST() {
  const user = await requireUser();
  if (!isStripeConfigured()) {
    return new NextResponse("Billing not configured.", { status: 503 });
  }

  try {
    await resumeSubscription(user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Resume failed.";
    const origin = await getOrigin();
    return NextResponse.redirect(
      `${origin}/billing?reason=resume-failed&message=${encodeURIComponent(msg)}`,
      { status: 303 },
    );
  }

  const origin = await getOrigin();
  return NextResponse.redirect(`${origin}/billing?status=resumed`, {
    status: 303,
  });
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  return `${proto}://${host}`;
}
