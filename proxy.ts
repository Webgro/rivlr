import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Phase 1 password gate.
 *
 * This is a temporary single-password lock so the owner can use Rivlr before
 * real user accounts exist. Phase 2 replaces this with Better Auth.
 *
 * - Public paths: /login, /api/auth/*, Vercel cron endpoints, _next assets
 * - Everything else requires the `rivlr_session` cookie to match SESSION_TOKEN.
 *
 * In Next.js 16, this file is `proxy.ts` (renamed from `middleware.ts`) and
 * the function is named `proxy`. Runtime is Node.js.
 */

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static / Next internals — let through.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // Cron endpoints authenticated by Vercel's CRON_SECRET, not by the cookie.
  if (pathname.startsWith("/api/crawl/")) {
    return NextResponse.next();
  }

  // Public auth paths.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Everything else: must have a valid session cookie.
  const session = request.cookies.get("rivlr_session")?.value;
  const expected = process.env.SESSION_TOKEN;
  const authed = !!session && !!expected && session === expected;

  if (!authed) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Authed visit to root → take them straight to /dashboard.
  // Phase 5 will replace this when the marketing landing lands at /.
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
