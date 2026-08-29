import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOnboardingState } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/**
 * Polled by the setup progress screen while the two catalogue imports
 * run. Returns the same state the page computes on the server, so the
 * bar keeps moving without a full page reload.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const state = await getOnboardingState(session.user.id);
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
