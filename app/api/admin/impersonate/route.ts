import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth/current-user";
import { startImpersonation } from "@/lib/admin";

/**
 * POST /api/admin/impersonate
 *
 * Drops the admin's session, creates a fresh impersonation session
 * for the target user. Cookie flips after this redirect — next page
 * load is "as" the target.
 */
export async function POST(request: Request) {
  const me = await requireAdmin();
  const formData = await request.formData();
  const targetUserId = String(formData.get("user-id") ?? "");
  if (!targetUserId) {
    return new NextResponse("Missing user id.", { status: 400 });
  }

  try {
    await startImpersonation({ actor: me, targetUserId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Couldn't start.";
    const origin = await getOrigin();
    return NextResponse.redirect(
      `${origin}/admin/users/${targetUserId}?reason=impersonate-failed&message=${encodeURIComponent(msg)}`,
      { status: 303 },
    );
  }

  // Land on the dashboard — that's where the target's day starts.
  const origin = await getOrigin();
  return NextResponse.redirect(`${origin}/dashboard`, { status: 303 });
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  return `${proto}://${host}`;
}
