import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/current-user";
import { isOverageConfigured } from "@/lib/stripe";
import { setOveragePacks } from "@/lib/billing";

/**
 * POST /api/billing/overage
 *
 * Set the user's overage pack quantity (Pro only). Pre-billed: Stripe
 * immediately invoices the prorated delta and charges the card. If the
 * charge fails the subscription stays at the prior quantity — the
 * customer never gets capacity they haven't paid for.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!isOverageConfigured()) {
    return new NextResponse("Overage SKU not configured.", { status: 503 });
  }

  const formData = await request.formData();
  const raw = String(formData.get("packs") ?? "");
  const packs = parseInt(raw, 10);
  if (!Number.isFinite(packs) || packs < 0) {
    return new NextResponse("Pack count must be a non-negative integer.", {
      status: 400,
    });
  }

  try {
    await setOveragePacks({ userId: user.id, packs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Overage update failed.";
    const origin = await getOrigin();
    return NextResponse.redirect(
      `${origin}/billing?reason=overage-failed&message=${encodeURIComponent(msg)}`,
      { status: 303 },
    );
  }

  const origin = await getOrigin();
  return NextResponse.redirect(
    `${origin}/billing?status=overage-updated&packs=${packs}`,
    { status: 303 },
  );
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  return `${proto}://${host}`;
}
