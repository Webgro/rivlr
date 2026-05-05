import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth/session";

/**
 * Clears the active session row and the rivlr_auth cookie, then redirects
 * to /login.
 */
export async function POST(request: Request) {
  await destroyCurrentSession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
