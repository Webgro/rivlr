import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroyCurrentSession } from "@/lib/auth/session";

/**
 * Destroys both the new per-user session and the legacy single-password
 * cookie. Both are cleared during the Phase 3 cutover so users can log
 * out cleanly regardless of which auth path they came in on.
 */
export async function POST(request: Request) {
  await destroyCurrentSession();
  const cookieStore = await cookies();
  cookieStore.delete("rivlr_session"); // legacy
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
