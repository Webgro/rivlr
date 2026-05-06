import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stopImpersonation } from "@/lib/admin";

/**
 * POST /api/admin/stop-impersonating
 *
 * Destroys the impersonation session, creates a fresh session for the
 * original admin. Lands on /admin/users/[id] of the user that was
 * being impersonated so the admin can verify what happened during
 * the session.
 *
 * No requireAdmin check here — stopImpersonation throws if there's no
 * impersonator on the current session, which is itself the right gate
 * (a regular user can't reach this state).
 */
export async function POST() {
  let result: Awaited<ReturnType<typeof stopImpersonation>>;
  try {
    result = await stopImpersonation();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Couldn't stop.";
    const origin = await getOrigin();
    return NextResponse.redirect(
      `${origin}/dashboard?reason=stop-impersonation-failed&message=${encodeURIComponent(msg)}`,
      { status: 303 },
    );
  }

  const origin = await getOrigin();
  return NextResponse.redirect(`${origin}/admin/users`, { status: 303 });
  void result; // silence unused
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  return `${proto}://${host}`;
}
